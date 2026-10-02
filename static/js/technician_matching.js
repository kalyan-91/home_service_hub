/*
 * static/js/technician_matching.js — logic for templates/technician/nearby_list.html
 * (Phase 10: nearby-technician list/map view for a chosen service)
 *
 * Backend: POST /api/move/nearby-technicians {service_id, latitude, longitude}
 *   -> [{technician_id, name, distance_km, rating, experience_years}]
 * This is the same endpoint templates/move/technician_search.html uses — the
 * project structure doc assigns Phase 10 to routes/move.py's matching logic /
 * services/technician_matching.py, and no separate non-move endpoint exists.
 * Already flagged to Pavan earlier: technician_matching.py's SQL references
 * columns that don't match schema.sql (t.name, t.rating, ts.experience_years,
 * ts.skill_id = service_id) and will error until he fixes it — that fix
 * benefits this page too, not just Move Mode.
 *
 * Map view needs a mapping library the team doesn't have yet (see the note
 * in move_matching.js) — shown as "coming soon" here for the same reason.
 *
 * Uses the shared helper from static/js/api.js: apiPost(url, body).
 * ASSUMPTION: it returns parsed JSON and throws an Error with a readable
 * message when the request fails.
 */

const root = document.getElementById('nearby-root');
const SERVICE_ID = root.dataset.serviceId || '';

let technicians = [];
let view = 'list';

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function initials(name) {
  return (name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function stars(rating) {
  const rounded = Math.round(rating || 0);
  return '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
}

function showMessage(type, text) {
  const box = $('nearby-message');
  box.className = 'alert alert-' + type; // alert-error | alert-success
  box.textContent = text;
  box.hidden = false;
}
function clearMessage() {
  $('nearby-message').hidden = true;
}

/* ---------- location ---------- */
function askForLocation() {
  $('coords-card').hidden = false;
  $('nearby-list').innerHTML = '<p class="muted">Enter your location above to see technicians.</p>';
}

$('btn-locate').addEventListener('click', () => {
  if (!navigator.geolocation) {
    showMessage('error', "Your browser can't share your location. Enter it by hand below.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      $('coords-card').hidden = true;
      clearMessage();
      searchFrom(pos.coords.latitude, pos.coords.longitude);
    },
    () => showMessage('error', 'Location access was blocked. Enter your coordinates below instead.')
  );
});

$('coords-form').addEventListener('submit', (event) => {
  event.preventDefault();
  $('coords-card').hidden = true;
  clearMessage();
  searchFrom(Number($('c-lat').value), Number($('c-lon').value));
});

/* ---------- search ---------- */
async function searchFrom(latitude, longitude) {
  const list = $('nearby-list');
  list.innerHTML = '<p class="muted">Finding technicians…</p>';
  $('view-toggle').hidden = true;
  try {
    technicians = await apiPost('/api/move/nearby-technicians', { // api.js
      service_id: Number(SERVICE_ID),
      latitude,
      longitude,
    });
    if (!technicians.length) {
      list.innerHTML = '<p class="muted">No technicians found nearby for this service yet.</p>';
      return;
    }
    $('view-toggle').hidden = false;
    renderView();
  } catch (err) {
    list.innerHTML = '';
    showMessage('error', "Couldn't load nearby technicians: " + err.message);
  }
}

/* ---------- rendering ---------- */
function technicianId(t) { return t.technician_id ?? t.user_id; }

function renderList() {
  $('nearby-list').hidden = false;
  $('nearby-map').hidden = true;
  $('nearby-list').innerHTML = technicians.map((t) => `
    <a class="item-row tech-row" href="/bookings/new?service_id=${SERVICE_ID}&technician_id=${technicianId(t)}">
      <span class="avatar">${escapeHtml(initials(t.name))}</span>
      <span class="tech-info">
        <span class="tech-name">${escapeHtml(t.name)}</span>
        <span class="muted">${t.distance_km != null ? escapeHtml(t.distance_km) + ' km away' : ''} · ${escapeHtml(t.experience_years ?? 0)} yrs experience</span>
        <span class="tech-stars">${stars(t.rating)} <span class="muted">${t.rating ? Number(t.rating).toFixed(1) : 'New'}</span></span>
      </span>
    </a>`).join('');
}

function renderMap() {
  $('nearby-list').hidden = true;
  const box = $('nearby-map');
  box.hidden = false;
  box.innerHTML = '<p class="muted">Map view coming soon — needs a mapping library (see code comments).</p>';
}

function renderView() {
  view === 'list' ? renderList() : renderMap();
}

$('view-toggle').addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#view-toggle .chip').forEach((c) => c.classList.remove('is-active'));
  chip.classList.add('is-active');
  view = chip.dataset.view;
  renderView();
});

/* ---------- start ---------- */
if (!SERVICE_ID) {
  $('nearby-list').innerHTML = '';
  showMessage('error', 'No service selected. Go back to the service catalog first.');
} else {
  askForLocation();
}
