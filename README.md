# 3GS Luxury Property — website

A two-audience site: landlords considering a guaranteed-rent agreement, and guests booking the current listing directly, with real card payment via Stripe.

## What's in here

```
index.html          Home page
the-offer.html       Landlord offer, extended clause-by-clause
stay.html            Guest listing + booking widget
success.html         Post-payment confirmation page
contact.html         Enquiry form (landlords + guests)
css/styles.css       Shared design system
js/booking.js        Pricing calc, availability check, and Stripe checkout call
api/create-checkout-session.js   Serverless function that creates the Stripe session
api/availability.js  Serverless function that syncs booked dates from your Airbnb calendar
package.json         Dependency (stripe) for the serverless functions
.env.example         Template for your environment variables
images/logo.jpeg      Your logo
```

## 1. Make it yours

- **Photos**: `stay.html` currently uses photos pulled from your Airbnb listing (hosted on Airbnb's own image servers) as a starting point. These work for now, but Airbnb doesn't guarantee those links stay live long-term — download your originals from Airbnb and drop them into `/images/` when you get a chance, then update the three `src="..."` URLs in `stay.html` to point at your own copies.
- **Listing copy & price**: the property name, description, amenities and nightly rate (`£145` — a placeholder, since Airbnb only shows pricing once dates are selected) live in `stay.html` and are mirrored in `js/booking.js` (`NIGHTLY_RATE`) and `api/create-checkout-session.js` (`NIGHTLY_RATE`, `CLEANING_FEE`) — update all three together, since the backend recalculates the price itself for security and needs to match.
- **Multiple properties later**: right now the site is built for one listing. If you add more, the simplest path is duplicating `stay.html` per property (e.g. `stay-2.html`) with its own price constants, or ask for a proper listings system.

## 2. Connect Stripe (for real card payments)

This site's "Reserve & Pay" button needs a small backend to talk to Stripe securely — that's what `api/create-checkout-session.js` is. It **will not work by just opening the HTML files in a browser**; it needs to be deployed somewhere that runs serverless functions.

**Recommended: Vercel (free tier works, and needs no config for this structure)**

1. Create a [Stripe account](https://dashboard.stripe.com/register) if you don't have one.
2. Get your **secret key** from Stripe → Developers → API keys (start with the test key, `sk_test_...`, until you're ready to take real payments).
3. Push this folder to a GitHub repo, then import it into [Vercel](https://vercel.com/new).
4. In Vercel → Project → Settings → Environment Variables, add:
   - `STRIPE_SECRET_KEY` = your key from step 2
   - `SITE_URL` = your live site URL (e.g. `https://your-domain.com`)
5. Deploy. Vercel automatically turns `api/create-checkout-session.js` into a live endpoint at `/api/create-checkout-session` — no extra config needed.
6. Test a booking end-to-end using [Stripe's test card](https://docs.stripe.com/testing) `4242 4242 4242 4242`, any future expiry, any CVC.
7. When ready to take real payments, swap in your **live** secret key.

**Using Netlify instead**: move `api/create-checkout-session.js` into `netlify/functions/`, and adjust it to Netlify's function signature (notes are at the bottom of the file). Same environment variable setup, via Netlify → Site settings → Environment variables.

## 3. Sync your Airbnb calendar (so guests can't double-book)

`stay.html` shows a live "already booked" list and blocks clashing dates automatically, pulled from your Airbnb calendar via `api/availability.js`. To turn this on:

1. Log in to Airbnb as the host and open your listing.
2. Go to the listing's **Calendar** tab → **Availability settings** (sometimes labelled "Sync calendars").
3. Under **Export calendar**, copy the link ending in `.ics` — it looks like `https://www.airbnb.co.uk/calendar/ical/xxxxxxx.ics?s=xxxxxxx`.
4. In Vercel → Project → Settings → Environment Variables, add `AIRBNB_ICAL_URL` with that link as the value, then redeploy.

That's it — the site checks this feed automatically (refreshed roughly every 15 minutes) and won't let a guest book dates you've already got booked on Airbnb.

**Keep this link private.** Anyone with it can see your booked dates, so only ever put it in the environment variable — never in the HTML/JS files or a public GitHub repo. Until this is set up, the site still works, it just won't know about your Airbnb bookings, so double-check availability manually before confirming any booking made through the website.

*Heads up: Airbnb's calendar feed is one-way (Airbnb → your site). If you want a booking made on your website to also block that date on Airbnb, that needs a two-way sync tool (e.g. a channel manager like Hostaway, Guesty, or iGMS) sitting in between — let me know if you'd like help wiring that up instead.*

## 4. Connect the contact form

`contact.html` is pre-wired for **Netlify Forms** (the `data-netlify="true"` attribute) — if you deploy on Netlify, submissions just work and show up in your Netlify dashboard, no extra setup.

If you deploy elsewhere (e.g. Vercel), swap in a service like [Formspree](https://formspree.io) (free tier available): change the form's `action` to your Formspree endpoint and remove the `data-netlify`/`netlify-honeypot` attributes.

## 5. Domain & going live

Once deployed on Vercel or Netlify, both platforms let you attach a custom domain (e.g. `www.yourbusiness.co.uk`) for free under Domain settings — point your domain's DNS at them following their on-screen instructions.

## Local preview

You can preview the static pages by opening `index.html` directly in a browser, but the **booking payment flow only works once deployed** (see step 2), since it needs the live serverless function and a real Stripe key.
