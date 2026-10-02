/*
 * static/js/status_tracker.js — logic for templates/booking/status_tracker.html
 * (Phase 9: a standalone page for checking one booking's status, separate
 * from the built-in tracker request_flow.html shows right after booking)
 *
 * Backend (routes/booking.py):
 *   GET  /api/bookings/<id>           read status, service_id, technician_id, etc.
 *   POST /api/bookings/<id>/cancel    cancel
 * Also uses, to show readable names instead of raw IDs:
 *   GET  /api/services/<id>
 *   GET  /api/technicians/<id>
 *
 * The page reads booking_id from a {{ booking_id }} Jinja variable (same
 * pattern as reviews/rating_form.html), or from ?booking_id=X for testing.
 * This page doesn't check who owns the booking — routes/booking.py's
 * GET /api/bookings/<id> has no login check at all, so anyone with the link
 * can see the status. Flag this to Pavan if that needs restricting.
 *
 * Uses the shared helper from static/js/api.js: apiGet(url), apiPost(url, body).
 * ASSUMPTION: they return parsed JSON and throw an Error with a readable
 * message when the request fails.
 */

const STATUS_FLOW = ['Pending', 'Assigned', 'Accepted', 'Scheduled', 'In Progress', 'Completed'];

const root = document.getElementById('tracker-root');
const BOOKING_ID = Number(root.dataset.bookingId) || Number(new URLSearchParams(window.location.search).get('booking_id')) || null;

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d) ? String(value) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function showMessage(type, text) {
  const box = $('tracker-message');
  box.className = 'alert alert-' + type; // alert-error | alert-success
  box.textContent = text;
  box.hidden = false;
}

async function nameOf(url, fallback) {
  try {
    const item = await apiGet(url); // api.js
    return item.name || fallback;
  } catch (err) {
    return fallback;
  }
}

function trackHtml(status) {
  if (status === 'Cancelled') {
    return '<ol class="status-track"><li class="status-step is-cancelled">Cancelled</li></ol>';
  }
  const current = STATUS_FLOW.indexOf(status);
  return '<ol class="status-track">' + STATUS_FLOW.map((name, i) => {
    const cls = i < current ? 'is-done' : i === current ? 'is-current' : '';
    return `<li class="status-step ${cls}">${name}</li>`;
  }).join('') + '</ol>';
}

async function render() {
  const body = $('tracker-body');
  let booking;
  try {
    booking = await apiGet(`/api/bookings/${BOOKING_ID}`); // api.js
  } catch (err) {
    body.innerHTML = '';
    showMessage('error', "Couldn't find this booking: " + err.message);
    return;
  }

  const [serviceName, technicianName] = await Promise.all([
    nameOf(`/api/services/${booking.service_id}`, 'Service #' + booking.service_id),
    nameOf(`/api/technicians/${booking.technician_id}`, 'Technician #' + booking.technician_id),
  ]);

  const canCancel = ['Pending', 'Assigned', 'Accepted', 'Scheduled'].includes(booking.status);
  const canReview = booking.status === 'Completed';

  body.innerHTML = `
    <div class="summary-row"><span class="summary-label">Booking</span><span class="summary-value">#${escapeHtml(booking.booking_id)}</span></div>
    <div class="summary-row"><span class="summary-label">Service</span><span class="summary-value">${escapeHtml(serviceName)}</span></div>
    <div class="summary-row"><span class="summary-label">Technician</span><span class="summary-value">${escapeHtml(technicianName)}</span></div>
    <div class="summary-row"><span class="summary-label">Date and time</span><span class="summary-value">${escapeHtml(formatDate(booking.booking_date))}, ${escapeHtml(booking.booking_time || '')}</span></div>
    <div class="summary-row"><span class="summary-label">Location</span><span class="summary-value">${escapeHtml(booking.location || '—')}</span></div>
    ${trackHtml(booking.status)}
    <div class="flow-actions">
      <button type="button" class="btn btn-secondary" id="btn-refresh">Refresh status</button>
      ${canCancel ? '<button type="button" class="btn btn-danger" id="btn-cancel">Cancel booking</button>' : ''}
      ${canReview ? `<a class="btn btn-primary" href="/bookings/${booking.booking_id}/review">Rate this service</a>` : ''}
    </div>`;

  $('btn-refresh').addEventListener('click', render);
  const cancelButton = $('btn-cancel');
  if (cancelButton) cancelButton.addEventListener('click', cancelBooking);
}

async function cancelBooking() {
  if (!confirm('Cancel this booking?')) return;
  try {
    await apiPost(`/api/bookings/${BOOKING_ID}/cancel`, {}); // api.js
    showMessage('success', 'Booking cancelled.');
    render();
  } catch (err) {
    showMessage('error', "Couldn't cancel the booking: " + err.message);
  }
}

/* ---------- start ---------- */
if (!BOOKING_ID) {
  $('tracker-body').innerHTML = '';
  showMessage('error', 'No booking selected.');
} else {
  render();
}
