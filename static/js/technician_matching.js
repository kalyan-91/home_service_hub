/*
 * static/js/technician_matching.js — logic for templates/technician/nearby_list.html
 * (Phase 10: nearby-technician list/map view for a chosen service)
 *
 * Backend: POST /api/move/nearby-technicians {service_id, latitude, longitude}
 *   -> [{technician_id, service_area, verification_status, distance_km,
 *        average_rating, review_count, match_score,
 *        price_range, price_low, price_high, budget_status}]
 * (services/technician_matching.py was rewritten since this file was first
 * built — the response no longer includes "name", "rating" (now
 * "average_rating"), or any experience field. This file now fetches each
 * technician's name and years_experience separately from the endpoint
 * below, rather than waiting on a backend change.)
 *   GET /api/technicians/<id> -> {name, years_experience, skills: [...]}
 *
 * Same endpoint as templates/move/technician_search.html — flag to Pavan if
 * he wants a day/time/budget picker added to this page later, since
 * find_nearby_technicians() now supports those but routes/move.py's
 * /nearby-technicians route doesn't forward them yet (only service_id, lat,
 * lon). Not required for this page to work; it just means every search
 * uses today's availability and no budget filter.
 *
 * Map view needs a mapping library the team doesn't have yet (see the note
 * in move_matching.js) — shown as "coming soon" here for the same reason.
 *
 * Uses the shared helpers from static/js/api.js: apiGet(url), apiPost(url, body).
 * ASSUMPTION: they return parsed JSON and throw an Error with a readable
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

/* ---------- enrich with name + experience ---------- */
async function enrichWithProfile(tech) {
  try {
    const profile = await apiGet(`/api/technicians/${tech.technician_id}`); // api.js
    tech.name = profile.name;
    tech.years_experience = profile.years_experience;
  } catch (err) {
    tech.name = 'Technician #' + tech.technician_id; // enrichment failed: still show the card
    tech.years_experience = null;
  }
  return tech;
}

/* ---------- search ---------- */
async function searchFrom(latitude, longitude) {
  const list = $('nearby-list');
  list.innerHTML = '<p class="muted">Finding technicians…</p>';
  $('view-toggle').hidden = true;
  try {
    const matches = await apiPost('/api/move/nearby-technicians', { // api.js
      service_id: Number(SERVICE_ID),
      latitude,
      longitude,
    });
    if (!matches.length) {
      list.innerHTML = '<p class="muted">No technicians found nearby for this service yet.</p>';
      return;
    }
    technicians = await Promise.all(matches.map(enrichWithProfile));
    $('view-toggle').hidden = false;
    renderView();
  } catch (err) {
    list.innerHTML = '';
    showMessage('error', "Couldn't load nearby technicians: " + err.message);
  }
}

/* ---------- rendering ---------- */
function priceLine(t) {
  if (!t.price_range) return '';
  const note = t.budget_status === 'over_budget' ? ' (over your budget)' : '';
  return `<span class="muted">${escapeHtml(t.price_range)}${note}</span>`;
}

function renderList() {
  $('nearby-list').hidden = false;
  $('nearby-map').hidden = true;
  $('nearby-list').innerHTML = technicians.map((t) => `
    <a class="item-row tech-row" href="/bookings/new?service_id=${SERVICE_ID}&technician_id=${t.technician_id}">
      <span class="avatar">${escapeHtml(initials(t.name))}</span>
      <span class="tech-info">
        <span class="tech-name">${escapeHtml(t.name)}</span>
        <span class="muted">${t.distance_km != null ? escapeHtml(t.distance_km) + ' km away' : ''}${t.years_experience != null ? ' · ' + escapeHtml(t.years_experience) + ' yrs experience' : ''}</span>
        <span class="tech-stars">${stars(t.average_rating)} <span class="muted">${t.average_rating ? Number(t.average_rating).toFixed(1) : 'New'}</span></span>
        ${priceLine(t)}
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
