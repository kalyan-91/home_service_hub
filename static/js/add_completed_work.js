/*
 * static/js/add_completed_work.js — logic for templates/technician/add_completed_work.html
 * (Phase 12)
 *
 * Uses one endpoint that already exists and one that doesn't yet:
 *
 * EXISTING:
 *   GET /api/bookings/technician/<id>  -> all bookings for the logged-in technician
 *
 * NOT BUILT YET (per the backend plan, belongs in routes/booking.py or a new
 * routes/technician_work.py — touches the service_history table):
 *   POST /api/technician/work
 *     body: { booking_id, service_type, cost, notes }
 *     Should insert a service_history row (booking_id, appliance_id from the
 *     booking, service_type, cost, completed_date = now, notes) AND set the
 *     booking's status to 'Completed' (the same thing PATCH
 *     /api/bookings/<id>/status does) in one step, so the technician doesn't
 *     have to do both separately.
 * Until that route exists, this page's submit will show a clear error
 * instead of silently failing.
 *
 * TECHNICIAN_ID is read from the Flask session the same way other
 * technician-only pages on this project do; confirm app.py's route for this
 * page injects it, or that current_user_id is available to use instead.
 *
 * Uses the shared helpers from static/js/api.js: apiGet(url), apiPost(url, body).
 * ASSUMPTION: they return parsed JSON and throw an Error with a readable
 * message when the request fails.
 */

const root = document.getElementById('work-root');
const TECHNICIAN_ID = Number(root.dataset.technicianId) || null;

let bookingsById = {};

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
  const box = $('work-message');
  box.className = 'alert alert-' + type; // alert-error | alert-success
  box.textContent = text;
  box.hidden = false;
}
function clearMessage() {
  $('work-message').hidden = true;
}

/* ---------- jobs not yet completed ---------- */
async function loadBookings() {
  const select = $('booking-select');
  try {
    const rows = await apiGet(`/api/bookings/technician/${TECHNICIAN_ID}`); // api.js
    const open = rows.filter((b) => !['Completed', 'Cancelled'].includes(b.status));
    if (!open.length) {
      select.innerHTML = '<option value="">No jobs waiting to be marked complete</option>';
      select.disabled = true;
      return;
    }
    open.forEach((b) => { bookingsById[b.booking_id] = b; });
    select.innerHTML = '<option value="">Choose a job…</option>' + open.map((b) =>
      `<option value="${b.booking_id}">#${b.booking_id} · ${formatDate(b.booking_date)} · ${escapeHtml(b.status)}</option>`
    ).join('');
  } catch (err) {
    select.innerHTML = '<option value="">Couldn\'t load your jobs</option>';
    select.disabled = true;
    showMessage('error', "Couldn't load your jobs: " + err.message);
  }
}

$('booking-select').addEventListener('change', (event) => {
  clearMessage();
  $('work-form').hidden = !event.target.value;
  $('work-done').hidden = true;
});

/* ---------- submit ---------- */
$('work-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();
  const bookingId = Number($('booking-select').value);
  if (!bookingId) { showMessage('error', 'Choose a job first.'); return; }

  const button = $('btn-submit-work');
  button.disabled = true;
  button.textContent = 'Saving…';
  try {
    await apiPost('/api/technician/work', { // api.js — NOT BUILT YET, see file header
      booking_id: bookingId,
      service_type: $('work-type').value.trim(),
      cost: Number($('work-cost').value),
      notes: $('work-notes').value.trim(),
    });
    $('work-form').hidden = true;
    $('work-done').hidden = false;
  } catch (err) {
    showMessage('error', err.message || "Couldn't save this job. The backend route for this may not exist yet.");
    button.disabled = false;
    button.textContent = 'Mark as completed';
  }
});

/* ---------- start ---------- */
if (!TECHNICIAN_ID) {
  $('booking-select').innerHTML = '<option value="">Log in as a technician to use this page</option>';
  $('booking-select').disabled = true;
  showMessage('error', 'Log in as a technician to add completed work.');
} else {
  loadBookings();
}
