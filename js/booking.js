// ---------------------------------------------------------
// 3GS Luxury Property — booking widget
// Calculates nights/price locally, then asks the backend
// (api/create-checkout-session) to create a Stripe Checkout
// Session and redirects the guest there to pay securely.
// ---------------------------------------------------------

(function () {
  const PROPERTY_NAME = "Spacious 3BR Garden Retreat, Shepherd's Bush";
  const NIGHTLY_RATE = 145; // £ per night — keep in sync with the backend PRICE config
  const CLEANING_FEE = 45;  // £ flat cleaning fee

  const checkinEl = document.getElementById('checkin');
  const checkoutEl = document.getElementById('checkout');
  const guestsEl = document.getElementById('guests');
  const breakdownEl = document.getElementById('price-breakdown');
  const rateLineEl = document.getElementById('rate-line');
  const rateTotalEl = document.getElementById('rate-total');
  const cleaningFeeEl = document.getElementById('cleaning-fee');
  const grandTotalEl = document.getElementById('grand-total');
  const form = document.getElementById('booking-form');
  const statusEl = document.getElementById('booking-status');
  const reserveBtn = document.getElementById('reserve-btn');
  const availabilityStatusEl = document.getElementById('availability-status');
  const unavailableListEl = document.getElementById('unavailable-list');

  let bookedRanges = []; // populated from /api/availability (synced from Airbnb)

  function todayISO() {
    return new Date().toISOString().split('T')[0];
  }

  function nightsBetween(inDate, outDate) {
    const a = new Date(inDate);
    const b = new Date(outDate);
    const ms = b - a;
    return Math.round(ms / (1000 * 60 * 60 * 24));
  }

  function formatGBP(n) {
    return '£' + n.toLocaleString('en-GB');
  }

  function formatRangeLabel(start, end) {
    const opts = { day: 'numeric', month: 'short' };
    const s = new Date(start).toLocaleDateString('en-GB', opts);
    const e = new Date(end).toLocaleDateString('en-GB', opts);
    return `${s} – ${e}`;
  }

  // Two date ranges [aStart, aEnd) and [bStart, bEnd) overlap if
  // aStart < bEnd AND bStart < aEnd. ISO date strings compare correctly
  // as plain strings (YYYY-MM-DD), no need to parse to Date objects here.
  function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }

  function findOverlappingRange(checkin, checkout) {
    return bookedRanges.find((r) => rangesOverlap(checkin, checkout, r.start, r.end)) || null;
  }

  // ---- Load synced Airbnb availability ----
  async function loadAvailability() {
    try {
      const res = await fetch('/api/availability');
      const data = await res.json();
      bookedRanges = data.bookedRanges || [];

      if (data.connected && bookedRanges.length > 0) {
        availabilityStatusEl.textContent = 'Synced with Airbnb — dates already booked there are shown below and blocked here.';
        availabilityStatusEl.className = 'lede status-ok';
        renderUnavailableList();
      } else if (data.connected) {
        availabilityStatusEl.textContent = 'Synced with Airbnb — no dates are currently booked.';
        availabilityStatusEl.className = 'lede status-ok';
      } else {
        availabilityStatusEl.textContent = data.message || 'Live sync isn\u2019t connected yet — please confirm exact availability with us before paying.';
        availabilityStatusEl.className = 'lede status-error';
      }
    } catch (err) {
      console.error(err);
      availabilityStatusEl.textContent = 'Couldn\u2019t check live availability — please confirm dates with us before paying.';
      availabilityStatusEl.className = 'lede status-error';
    }
    checkSelectedRange();
  }

  function renderUnavailableList() {
    const today = todayISO();
    const upcoming = bookedRanges
      .filter((r) => r.end >= today)
      .sort((a, b) => (a.start < b.start ? -1 : 1))
      .slice(0, 8);

    unavailableListEl.innerHTML = upcoming
      .map((r) => `<span class="range-pill">${formatRangeLabel(r.start, r.end)}</span>`)
      .join('');
  }

  // Sensible date defaults / constraints
  checkinEl.min = todayISO();
  checkinEl.addEventListener('change', () => {
    if (checkinEl.value) {
      const next = new Date(checkinEl.value);
      next.setDate(next.getDate() + 1);
      checkoutEl.min = next.toISOString().split('T')[0];
      if (checkoutEl.value && checkoutEl.value <= checkinEl.value) {
        checkoutEl.value = next.toISOString().split('T')[0];
      }
    }
    updatePrice();
    checkSelectedRange();
  });
  checkoutEl.addEventListener('change', () => {
    updatePrice();
    checkSelectedRange();
  });

  function updatePrice() {
    const nights = checkinEl.value && checkoutEl.value
      ? nightsBetween(checkinEl.value, checkoutEl.value)
      : 0;

    if (nights > 0) {
      const roomTotal = nights * NIGHTLY_RATE;
      const grandTotal = roomTotal + CLEANING_FEE;
      rateLineEl.textContent = `${formatGBP(NIGHTLY_RATE)} x ${nights} night${nights > 1 ? 's' : ''}`;
      rateTotalEl.textContent = formatGBP(roomTotal);
      cleaningFeeEl.textContent = formatGBP(CLEANING_FEE);
      grandTotalEl.textContent = formatGBP(grandTotal);
      breakdownEl.hidden = false;
    } else {
      breakdownEl.hidden = true;
    }
  }

  // Warns the guest inline the moment they pick dates that clash with
  // a synced Airbnb booking, before they get anywhere near payment.
  function checkSelectedRange() {
    if (!checkinEl.value || !checkoutEl.value) return true;
    const clash = findOverlappingRange(checkinEl.value, checkoutEl.value);
    if (clash) {
      setStatus(`Those dates overlap a stay already booked on Airbnb (${formatRangeLabel(clash.start, clash.end)}). Please choose different dates.`, 'status-error');
      return false;
    }
    setStatus("You won't be charged until you confirm on the next screen.");
    return true;
  }

  function setStatus(message, type) {
    statusEl.textContent = message;
    statusEl.classList.remove('status-error', 'status-ok');
    if (type) statusEl.classList.add(type);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const checkin = checkinEl.value;
    const checkout = checkoutEl.value;
    const nights = checkin && checkout ? nightsBetween(checkin, checkout) : 0;

    if (nights <= 0) {
      setStatus('Please choose a check-out date after your check-in date.', 'status-error');
      return;
    }

    if (!checkSelectedRange()) {
      return; // dates clash with a synced Airbnb booking — blocked above
    }

    const payload = {
      property: PROPERTY_NAME,
      checkin,
      checkout,
      nights,
      guests: guestsEl.value,
      nightlyRate: NIGHTLY_RATE,
      cleaningFee: CLEANING_FEE,
      totalAmount: nights * NIGHTLY_RATE + CLEANING_FEE,
      currency: 'gbp',
      guestName: document.getElementById('guest-name').value,
      guestEmail: document.getElementById('guest-email').value,
    };

    reserveBtn.disabled = true;
    reserveBtn.textContent = 'Redirecting to secure payment…';
    setStatus('Connecting to secure checkout…');

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Checkout session request failed');

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; // hand off to Stripe Checkout
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error(err);
      reserveBtn.disabled = false;
      reserveBtn.textContent = 'Reserve & Pay';
      setStatus(
        'Payments aren\u2019t connected yet on this deployment — see README.md to add your Stripe keys. In the meantime, email 3gsluxuryproperty@gmail.com with your dates.',
        'status-error'
      );
    }
  });

  loadAvailability();
})();
