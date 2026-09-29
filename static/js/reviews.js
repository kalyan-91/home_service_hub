/*
 * static/js/reviews.js — logic for templates/reviews/rating_form.html
 *
 * Endpoints that already exist:
 *   GET /api/bookings/<id>          -> customer_id, technician_id, service_id, status, booking_date
 *   GET /api/technicians/<id>       -> name (Verified technicians only)
 *   GET /api/services/<id>          -> name
 * Endpoint Pavan still has to build (draft sent to him):
 *   POST /api/reviews  {booking_id, rating, review_text}
 *     The server takes the customer from the session and the technician from
 *     the booking. It rejects bookings that are not Completed, not the
 *     customer's own, or already reviewed.
 *
 * The page URL is /bookings/<booking_id>/review. For testing you can also open
 * the page with ?booking_id=5.
 *
 * Uses the shared helpers from static/js/api.js: apiGet(url), apiPost(url, body).
 * ASSUMPTION: they return parsed JSON and throw an Error with a readable message
 * when the request fails.
 */

const root = document.getElementById('review-root');
const CUSTOMER_ID = Number(root.dataset.customerId) || null;
const BOOKING_ID = Number(root.dataset.bookingId) || Number(new URLSearchParams(window.location.search).get('booking_id')) || null;

let rating = 0;

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d) ? String(value) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function showMessage(type, text) {
  const box = $('review-message');
  box.className = 'alert alert-' + type; // alert-error | alert-success
  box.textContent = text;
  box.hidden = false;
}
function clearMessage() {
  $('review-message').hidden = true;
}

/* ---------- star rating ---------- */
const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

function renderStars() {
  document.querySelectorAll('#star-rating .star').forEach((star) => {
    const value = Number(star.dataset.value);
    star.classList.toggle('is-filled', value <= rating);
    star.setAttribute('aria-pressed', String(value === rating));
  });
  $('rating-text').textContent = rating
    ? `${rating} of 5: ${RATING_WORDS[rating]}`
    : 'Select a rating from 1 to 5 stars.';
}

$('star-rating').addEventListener('click', (event) => {
  const star = event.target.closest('.star');
  if (!star) return;
  rating = Number(star.dataset.value);
  clearMessage();
  renderStars();
});

/* ---------- booking summary ---------- */
async function nameOf(url, fallback) {
  try {
    const item = await apiGet(url); // api.js
    return item.name || fallback;
  } catch (err) {
    return fallback;
  }
}

async function loadBooking() {
  const summary = $('booking-summary');
  let booking;
  try {
    booking = await apiGet(`/api/bookings/${BOOKING_ID}`); // api.js
  } catch (err) {
    summary.textContent = '';
    showMessage('error', "Couldn't find this booking: " + err.message);
    return;
  }

  if (booking.customer_id !== CUSTOMER_ID) {
    summary.textContent = '';
    showMessage('error', "This booking isn't on your account.");
    return;
  }
  if (booking.status !== 'Completed') {
    summary.textContent = '';
    showMessage('error', `You can rate this service once it is completed. Its status is now ${booking.status}.`);
    return;
  }

  const [serviceName, technicianName] = await Promise.all([
    nameOf(`/api/services/${booking.service_id}`, 'Service #' + booking.service_id),
    nameOf(`/api/technicians/${booking.technician_id}`, 'Technician #' + booking.technician_id),
  ]);

  summary.innerHTML = `
    <div class="summary-row"><span class="summary-label">Service</span><span class="summary-value">${escapeHtml(serviceName)}</span></div>
    <div class="summary-row"><span class="summary-label">Technician</span><span class="summary-value">${escapeHtml(technicianName)}</span></div>
    <div class="summary-row"><span class="summary-label">Date</span><span class="summary-value">${escapeHtml(formatDate(booking.booking_date))}</span></div>`;
  summary.classList.remove('muted');
  $('review-form').hidden = false;
}

/* ---------- submit ---------- */
$('review-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();
  if (!rating) {
    showMessage('error', 'Choose a star rating before you submit.');
    return;
  }

  const button = $('btn-submit-review');
  button.disabled = true;
  button.textContent = 'Submitting…';
  try {
    await apiPost('/api/reviews', { // api.js
      booking_id: BOOKING_ID,
      rating,
      review_text: $('review-text').value.trim(),
    });
    $('review-form').hidden = true;
    $('booking-summary').hidden = true;
    $('review-done').hidden = false;
  } catch (err) {
    showMessage('error', err.message || "Couldn't submit your review. Try again.");
    button.disabled = false;
    button.textContent = 'Submit review';
  }
});

/* ---------- start ---------- */
(function init() {
  renderStars();
  if (!CUSTOMER_ID) {
    $('booking-summary').textContent = '';
    showMessage('error', 'Log in as a customer to rate a service.');
    return;
  }
  if (!BOOKING_ID) {
    $('booking-summary').textContent = '';
    showMessage('error', 'No booking selected. Open this page from a completed booking.');
    return;
  }
  loadBooking();
})();
