// ---------------------------------------------------------
// 3GS Luxury Property — Airbnb calendar sync
//
// Fetches the private iCal export feed from your Airbnb host
// dashboard and returns the list of already-booked date ranges,
// so the website's booking widget can avoid double-booking
// dates that are taken on Airbnb.
//
// SETUP (get your iCal link from Airbnb):
// 1. Log in to Airbnb as the host and open your listing.
// 2. Go to your listing's Calendar tab.
// 3. Click "Availability settings" (or "Sync calendars").
// 4. Under "Export calendar", copy the link ending in .ics
//    (it looks like https://www.airbnb.co.uk/calendar/ical/xxxxxxx.ics?s=xxxxxxx)
// 5. Add it as an environment variable called AIRBNB_ICAL_URL
//    in your hosting provider (see README.md).
//
// This link is private to you — anyone who has it can see your
// booked dates, so treat it like a password and only ever put
// it in an environment variable, never directly in this file
// or committed to your code.
// ---------------------------------------------------------

module.exports = async (req, res) => {
  const icalUrl = process.env.AIRBNB_ICAL_URL;

  // Calendar sync not configured yet — return an empty (but successful)
  // response so the site still works, just without live blocked dates.
  if (!icalUrl) {
    res.status(200).json({
      connected: false,
      bookedRanges: [],
      message: 'AIRBNB_ICAL_URL is not set yet — see README.md to connect your Airbnb calendar.',
    });
    return;
  }

  try {
    const icsResponse = await fetch(icalUrl);
    if (!icsResponse.ok) throw new Error(`iCal fetch failed: ${icsResponse.status}`);
    const icsText = await icsResponse.text();

    const bookedRanges = parseIcsToRanges(icsText);

    // Cache for 15 minutes — Airbnb calendars don't need real-time-to-the-second
    // sync, and this avoids hammering Airbnb's servers on every page load.
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    res.status(200).json({ connected: true, bookedRanges });
  } catch (err) {
    console.error('Airbnb calendar sync error:', err);
    // Fail soft: booking still works, it just won't know about Airbnb dates
    // until the feed is reachable again.
    res.status(200).json({
      connected: false,
      bookedRanges: [],
      message: 'Could not reach the Airbnb calendar right now.',
    });
  }
};

// Minimal ICS parser: pulls DTSTART/DTEND out of each VEVENT block.
// Airbnb's export feed uses all-day date values (YYYYMMDD), which is
// what this expects; it deliberately doesn't pull in every ICS feature,
// just enough to get booked date ranges out reliably.
function parseIcsToRanges(icsText) {
  const ranges = [];
  const events = icsText.split('BEGIN:VEVENT').slice(1);

  for (const block of events) {
    const startMatch = block.match(/DTSTART[^:]*:(\d{8})/);
    const endMatch = block.match(/DTEND[^:]*:(\d{8})/);
    if (!startMatch || !endMatch) continue;

    ranges.push({
      start: toIsoDate(startMatch[1]),
      end: toIsoDate(endMatch[1]),
    });
  }

  return ranges;
}

function toIsoDate(yyyymmdd) {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

// ---------------------------------------------------------
// Adapting for other hosts: same notes as api/create-checkout-session.js —
// Netlify Functions need the event.body / statusCode response shape instead.
// ---------------------------------------------------------
