// ---------------------------------------------------------
// 3GS Luxury Property — Stripe Checkout session creator
//
// This is a serverless function (Vercel-style: export default
// handler(req, res)). It takes the booking details from the
// front-end form and creates a Stripe Checkout Session, then
// returns the session URL for the browser to redirect to.
//
// SETUP:
// 1. npm install stripe
// 2. Set the STRIPE_SECRET_KEY environment variable in your
//    hosting provider (Vercel/Netlify/etc) — never hard-code it.
// 3. Deploy this file to /api/create-checkout-session on Vercel,
//    or adapt the handler signature for Netlify Functions / AWS
//    Lambda / your own Node+Express server (see notes at bottom).
// ---------------------------------------------------------

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const SITE_URL = process.env.SITE_URL || 'https://www.3gsluxuryproperty.co.uk';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const {
      property,
      checkin,
      checkout,
      nights,
      guests,
      totalAmount,
      currency,
      guestName,
      guestEmail,
    } = req.body;

    // Basic server-side sanity checks — never trust the client-side total alone.
    if (!checkin || !checkout || !nights || nights <= 0 || !guestEmail) {
      res.status(400).json({ error: 'Missing or invalid booking details' });
      return;
    }

    // Recompute the price server-side so it can't be tampered with in the browser.
    const NIGHTLY_RATE = 145;
    const CLEANING_FEE = 45;
    const verifiedTotal = nights * NIGHTLY_RATE + CLEANING_FEE;
    const amountInMinorUnits = verifiedTotal * 100; // Stripe uses pence/cents

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: guestEmail,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency || 'gbp',
            unit_amount: amountInMinorUnits,
            product_data: {
              name: `${property || '3GS Luxury Property stay'} — ${checkin} to ${checkout}`,
              description: `${nights} night(s), ${guests} guest(s), booked by ${guestName || 'guest'}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        property: property || '',
        checkin,
        checkout,
        nights: String(nights),
        guests: String(guests),
        guestName: guestName || '',
      },
      success_url: `${SITE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/stay.html`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe session error:', err);
    res.status(500).json({ error: 'Unable to create checkout session' });
  }
};

// ---------------------------------------------------------
// Adapting this for other hosts:
//
// Netlify Functions: rename to create-checkout-session.js in
// /netlify/functions, change `req.body` to JSON.parse(event.body),
// and return { statusCode, body: JSON.stringify(...) } instead of res.json.
//
// Plain Node/Express server: wrap this in
//   app.post('/api/create-checkout-session', handler)
// after adding express.json() middleware, and adjust
// req/res usage to Express's (it's already close to compatible).
// ---------------------------------------------------------
