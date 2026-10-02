/*
 * static/js/technician_stats.js — logic for templates/technician/dashboard_stats.html
 * (Phase 14)
 *
 * NOT BUILT YET on the backend: services/statistics.py already has a
 * technician_statistics(technician_id) function (jobs_completed,
 * average_rating, cancellation_rate, total_earnings), but nothing in the
 * routes exposes it to a technician for their own numbers — only
 * /api/admin/dashboard calls the admin version. This file expects:
 *   GET /api/technician/stats -> { jobs_completed, average_rating,
 *                                   cancellation_rate, total_earnings }
 * for the logged-in technician. Until that route exists, this page shows a
 * clear error instead of the four cards.
 *
 * The job history table below the cards uses an endpoint that DOES exist:
 *   GET /api/bookings/technician/<id>
 *
 * TECHNICIAN_ID is read from current_user_id (app.py's context processor),
 * the same pattern as add_completed_work.html.
 *
 * Uses the shared helper from static/js/api.js: apiGet(url).
 * ASSUMPTION: it returns parsed JSON and throws an Error with a readable
 * message when the request fails.
 */

const root = document.getElementById('stats-root');
const TECHNICIAN_ID = Number(root.dataset.technicianId) || null;

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function money(value) {
  return '₹' + Number(value || 0).toLocaleString('en-IN');
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d) ? String(value) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function showMessage(type, text) {
  const box = $('stats-message');
  box.className = 'alert alert-' + type; // alert-error | alert-success
  box.textContent = text;
  box.hidden = false;
}

/* ---------- summary cards ---------- */
async function loadSummary() {
  try {
    const stats = await apiGet('/api/technician/stats'); // api.js — NOT BUILT YET, see file header
    $('stat-jobs').textContent = stats.jobs_completed ?? 0;
    $('stat-rating').textContent = stats.average_rating ? Number(stats.average_rating).toFixed(1) + ' ★' : 'No ratings yet';
    $('stat-cancel').textContent = (stats.cancellation_rate ?? 0) + '%';
    $('stat-earnings').textContent = money(stats.total_earnings);
    $('stats-grid').hidden = false;
  } catch (err) {
    showMessage('error', "Couldn't load your stats: " + err.message + '. This endpoint may not be built yet.');
  }
}

/* ---------- job history table ---------- */
async function loadJobs() {
  const body = $('stats-body');
  try {
    const rows = await apiGet(`/api/bookings/technician/${TECHNICIAN_ID}`); // api.js
    if (!rows.length) {
      body.innerHTML = '<p class="muted">No jobs yet.</p>';
      return;
    }
    body.innerHTML = `
      <table class="table">
        <thead><tr><th>Booking</th><th>Date</th><th>Cost</th><th>Status</th></tr></thead>
        <tbody>
          ${rows.map((b) => `
            <tr>
              <td>#${escapeHtml(b.booking_id)}</td>
              <td>${formatDate(b.booking_date)}</td>
              <td>${money(b.service_cost)}</td>
              <td><span class="badge badge-${escapeHtml(String(b.status).toLowerCase().replace(' ', ''))}">${escapeHtml(b.status)}</span></td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    body.innerHTML = '';
    showMessage('error', "Couldn't load your job history: " + err.message);
  }
}

/* ---------- start ---------- */
if (!TECHNICIAN_ID) {
  $('stats-body').innerHTML = '';
  showMessage('error', 'Log in as a technician to see your stats.');
} else {
  loadSummary();
  loadJobs();
}
