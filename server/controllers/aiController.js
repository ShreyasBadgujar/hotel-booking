import Hotel from "../models/Hotel.js";
import Room from "../models/Room.js";

// POST /api/ai/vapi/token
export const createVapiClientToken = async (req, res) => {
  try {
    const apiKey = process.env.VAPI_API_KEY;
    if (!apiKey) {
      return res.status(501).json({ success: false, message: "Vapi server key not configured" });
    }
    // Minimal passthrough: forward to Vapi token endpoint
    // If Vapi provides a server SDK, replace with official method.
    const response = await fetch("https://api.vapi.ai/v1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({})
    });
    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ success: false, message: text });
    }
    const data = await response.json();
    return res.json({ success: true, token: data.token });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/ai/hotels?q=city or name
export const searchHotels = async (req, res) => {
  try {
    const { q } = req.query;
    const filter = q
      ? {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { city: { $regex: q, $options: "i" } },
            { address: { $regex: q, $options: "i" } }
          ]
        }
      : {};
    const hotels = await Hotel.find(filter).lean();
    return res.json({ success: true, hotels });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/ai/availability?hotelId=...&roomType=...
export const getAvailability = async (req, res) => {
  try {
    const { hotelId, roomType } = req.query;
    const roomFilter = { isAvailable: true };
    if (hotelId) roomFilter.hotel = hotelId;
    if (roomType) roomFilter.roomType = roomType;
    const rooms = await Room.find(roomFilter).lean();

    // Map room groups by hotel
    const hotelIds = [...new Set(rooms.map((r) => r.hotel))];
    const hotels = await Hotel.find({ _id: { $in: hotelIds } }).lean();
    const hotelById = Object.fromEntries(hotels.map((h) => [String(h._id), h]));

    const results = rooms.map((r) => ({
      hotel: hotelById[String(r.hotel)] || null,
      room: r
    }));

    return res.json({ success: true, results });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/ai/rag-search { query }
export const ragSearch = async (req, res) => {
  try {
    const { query } = req.body || {};
    if (!query || typeof query !== "string") {
      return res.status(400).json({ success: false, message: "query is required" });
    }

    const hotels = await Hotel.find({}).lean();
    const rooms = await Room.find({}).lean();

    // Build lightweight documents
    const documents = [];
    for (const h of hotels) {
      documents.push({
        id: String(h._id),
        type: "hotel",
        title: h.name,
        text: [h.name, h.address, h.city, h.contact].filter(Boolean).join(". "),
        payload: h,
      });
    }
    for (const r of rooms) {
      documents.push({
        id: String(r._id),
        type: "room",
        title: r.roomType,
        text: [r.roomType, Array.isArray(r.amenities) ? r.amenities.join(", ") : "", String(r.pricePerNight)].join(". "),
        payload: r,
      });
    }

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const scored = documents.map((d) => {
      const t = (d.text || "").toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (t.includes(term)) score += 1;
        if ((d.title || "").toLowerCase().includes(term)) score += 1.5;
      }
      return { doc: d, score };
    }).filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const sources = scored.map(({ doc, score }) => ({
      id: doc.id,
      type: doc.type,
      title: doc.title,
      score,
      payload: doc.payload,
    }));

    const context = sources.map((s, idx) => {
      if (s.type === "hotel") {
        const h = s.payload;
        return `Hotel ${idx + 1}: ${h.name} | Address: ${h.address}, ${h.city}. Contact: ${h.contact}.`;
      } else {
        const r = s.payload;
        return `Room ${idx + 1}: ${r.roomType} | PricePerNight: ${r.pricePerNight} | Amenities: ${(r.amenities || []).join(", ")}`;
      }
    }).join("\n");

    return res.json({ success: true, context, sources });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/ai/housekeeping-plan?days=7
// Computes daily cleaning workload and recommended staffing for the owner's hotel
export const getHousekeepingPlan = async (req, res) => {
  try {
    // Identify hotel by owner (Clerk user id)
    const ownerId = req.auth?.userId;
    if (!ownerId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Lazy import to avoid cycle
    const { default: Booking } = await import("../models/Booking.js");
    const { default: Hotel } = await import("../models/Hotel.js");
    const { default: Room } = await import("../models/Room.js");

    const hotel = await Hotel.findOne({ owner: ownerId }).lean();
    if (!hotel) {
      return res.json({ success: false, message: "No Hotel found for owner" });
    }

    const days = Math.max(1, Math.min(31, Number(req.query.days) || 7));
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + days);

    // Fetch bookings overlapping the range for this hotel
    const bookings = await Booking.find({
      hotel: String(hotel._id),
      checkInDate: { $lt: end },
      checkOutDate: { $gt: start },
      status: { $ne: "cancelled" }
    }).lean();

    const roomIds = [...new Set(bookings.map(b => b.room))];
    const rooms = await Room.find({ _id: { $in: roomIds } }).lean();
    const roomById = Object.fromEntries(rooms.map(r => [String(r._id), r]));

    // Parameters for workload estimation (minutes)
    const CHECKOUT_CLEAN_MIN = 60; // deep clean after checkout
    const STAYOVER_CLEAN_MIN = 20; // light clean per stay night
    const CHECKIN_PREP_MIN = 10; // final prep touch before check-in
    const STAFF_SHIFT_MIN = 8 * 60; // 8 hours per staff

    // Build per-day plan
    const plan = [];
    for (let i = 0; i < days; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const dayStart = new Date(day);
      const dayEnd = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      dayEnd.setHours(23, 59, 59, 999);

      const checkouts = bookings.filter(b => new Date(b.checkOutDate) >= dayStart && new Date(b.checkOutDate) <= dayEnd);
      const checkins = bookings.filter(b => new Date(b.checkInDate) >= dayStart && new Date(b.checkInDate) <= dayEnd);

      // Stayovers: bookings that span the day (after check-in and before checkout)
      const stayovers = bookings.filter(b => new Date(b.checkInDate) < dayStart && new Date(b.checkOutDate) > dayEnd);

      const workloadMinutes = (
        checkouts.length * CHECKOUT_CLEAN_MIN +
        stayovers.length * STAYOVER_CLEAN_MIN +
        checkins.length * CHECKIN_PREP_MIN
      );
      const staffNeeded = Math.max(1, Math.ceil(workloadMinutes / STAFF_SHIFT_MIN));

      plan.push({
        date: dayStart.toISOString().slice(0, 10),
        totals: {
          checkins: checkins.length,
          checkouts: checkouts.length,
          stayovers: stayovers.length,
          workloadMinutes,
          staffNeeded,
        },
        tasks: {
          checkouts: checkouts.map(b => ({ bookingId: String(b._id), roomId: String(b.room), roomType: roomById[String(b.room)]?.roomType })),
          checkins: checkins.map(b => ({ bookingId: String(b._id), roomId: String(b.room), roomType: roomById[String(b.room)]?.roomType })),
          stayovers: stayovers.map(b => ({ bookingId: String(b._id), roomId: String(b.room), roomType: roomById[String(b.room)]?.roomType })),
        }
      });
    }

    return res.json({ success: true, hotel: { id: String(hotel._id), name: hotel.name }, plan, params: { days, CHECKOUT_CLEAN_MIN, STAYOVER_CLEAN_MIN, CHECKIN_PREP_MIN, STAFF_SHIFT_MIN } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};



