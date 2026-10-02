/*
 * static/js/select_appliance.js — logic for templates/booking/select_appliance.html
 * (Phase 7: the appliance-selection step of the booking flow)
 *
 * Backend (routes/customer.py, needs a logged-in customer):
 *   GET /api/customer/homes                      -> [{home_id, address, city, status, ...}]
 *   GET /api/customer/homes/<id>/appliances       -> [{appliance_id, name, category, brand, model, ...}]
 *
 * This page doesn't book anything itself — it carries the customer's choice
 * forward to the next step. No shared "move draft" style object exists for
 * plain bookings yet, so the choice is passed as query string parameters on
 * the link to the next step: /bookings/new?service_id=X&appliance_id=Y
 * (service_id is read from this page's own URL and passed through unchanged).
 * If request_flow.html should read an appliance_id instead, that's a change
 * for me to make there, not here.
 *
 * Uses the shared helper from static/js/api.js: apiGet(url).
 * ASSUMPTION: it returns parsed JSON and throws an Error with a readable
 * message when the request fails.
 */

const root = document.getElementById('appliance-step');
const SERVICE_ID = root.dataset.serviceId || '';

let appliancesByHome = {}; // home_id -> [appliance, ...], filled in as homes are opened
let selectedApplianceId = null;

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showMessage(text) {
  const box = $('appliance-message');
  box.className = 'alert alert-error';
  box.textContent = text;
  box.hidden = false;
}
function clearMessage() {
  $('appliance-message').hidden = true;
}

function nextUrl() {
  const params = new URLSearchParams();
  if (SERVICE_ID) params.set('service_id', SERVICE_ID);
  if (selectedApplianceId) params.set('appliance_id', selectedApplianceId);
  return '/bookings/new' + (params.toString() ? '?' + params.toString() : '');
}

/* ---------- homes dropdown ---------- */
async function loadHomes() {
  const select = $('home-select');
  try {
    const homes = await apiGet('/api/customer/homes'); // api.js
    if (!homes.length) {
      select.innerHTML = '<option value="">You have no homes on file yet</option>';
      select.disabled = true;
      $('appliance-options').innerHTML = '<p class="muted">Add a home to your account before choosing an appliance, or skip this step.</p>';
      return;
    }
    select.innerHTML = '<option value="">Choose a home…</option>' + homes.map((h) =>
      `<option value="${h.home_id}">${escapeHtml(h.address)}, ${escapeHtml(h.city)}${h.status === 'current' ? ' (current)' : ''}</option>`
    ).join('');

    const current = homes.find((h) => h.status === 'current');
    if (current) {
      select.value = current.home_id;
      loadAppliances(current.home_id);
    }
  } catch (err) {
    select.innerHTML = '<option value="">Couldn\'t load your homes</option>';
    select.disabled = true;
    showMessage("Couldn't load your homes: " + err.message);
  }
}

$('home-select').addEventListener('change', (event) => {
  clearMessage();
  selectedApplianceId = null;
  $('btn-continue').disabled = true;
  const homeId = event.target.value;
  if (homeId) loadAppliances(homeId);
  else $('appliance-options').innerHTML = '<p class="muted">Choose a home to see its appliances.</p>';
});

/* ---------- appliances for the chosen home ---------- */
async function loadAppliances(homeId) {
  const box = $('appliance-options');
  box.innerHTML = '<p class="muted">Loading appliances…</p>';
  try {
    if (!appliancesByHome[homeId]) {
      appliancesByHome[homeId] = await apiGet(`/api/customer/homes/${homeId}/appliances`); // api.js
    }
    const appliances = appliancesByHome[homeId];
    if (!appliances.length) {
      box.innerHTML = '<p class="muted">No appliances recorded for this home yet. You can still skip this step.</p>';
      return;
    }
    box.innerHTML = appliances.map((a) => `
      <button type="button" class="option-item" data-id="${a.appliance_id}" aria-pressed="false">
        <span class="option-title">${escapeHtml(a.name)}</span>
        <span class="option-meta">${escapeHtml(a.category)}${a.brand ? ' · ' + escapeHtml(a.brand) : ''}</span>
      </button>`).join('');

    box.querySelectorAll('.option-item').forEach((item) => {
      item.addEventListener('click', () => {
        box.querySelectorAll('.option-item').forEach((i) => {
          i.classList.remove('is-selected');
          i.setAttribute('aria-pressed', 'false');
        });
        item.classList.add('is-selected');
        item.setAttribute('aria-pressed', 'true');
        selectedApplianceId = item.dataset.id;
        $('btn-continue').disabled = false;
        clearMessage();
      });
    });
  } catch (err) {
    box.innerHTML = '';
    showMessage("Couldn't load appliances for this home: " + err.message);
  }
}

/* ---------- continue / skip ---------- */
$('btn-continue').addEventListener('click', () => {
  window.location.href = nextUrl();
});
$('btn-skip').addEventListener('click', () => {
  selectedApplianceId = null;
  window.location.href = nextUrl();
});

/* ---------- start ---------- */
loadHomes();
