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



