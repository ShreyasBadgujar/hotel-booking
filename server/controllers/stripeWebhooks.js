import stripe from "stripe";
import Booking from "../models/Booking.js";

// API to handle Stripe Webhooks
// POST /api/stripe
export const stripeWebhooks = async (request, response) => {
  // Stripe Gateway Initialize
  const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);

  const sig = request.headers["stripe-signature"];

  let event;

  try {
    event = stripeInstance.webhooks.constructEvent(request.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    response.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Prefer checkout.session.completed for success
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { bookingId } = session.metadata || {};
    if (bookingId) {
      await Booking.findByIdAndUpdate(bookingId, { isPaid: true, paymentMethod: "Stripe" });
    }
  } else if (event.type === "payment_intent.succeeded") {
    // Fallback: resolve session by payment_intent
    const paymentIntent = event.data.object;
    const paymentIntentId = paymentIntent.id;
    const sessions = await stripeInstance.checkout.sessions.list({ payment_intent: paymentIntentId });
    const s = sessions?.data?.[0];
    if (s?.metadata?.bookingId) {
      await Booking.findByIdAndUpdate(s.metadata.bookingId, { isPaid: true, paymentMethod: "Stripe" });
    }
  } else {
    console.log("Unhandled event type :", event.type);
  }

  response.json({ received: true });
};
