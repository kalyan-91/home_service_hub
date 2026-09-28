/*
 * static/js/move_matching.js — logic for templates/move/technician_search.html
 * (Move Mode part 2: find technicians near the NEW home)
 *
 * Backend (routes/move.py):
 *   POST /api/move/required-services   {appliances:[{appliance_id, category}]}
 *        -> [{appliance_id, category, required_service, estimated_price, service_id?}]
 *   POST /api/move/nearby-technicians  {service_id, latitude, longitude}
 *        -> [{technician_id, name, distance_km, rating, experience_years}]
 *
 * HAND-OFF WITH MEGHANA (Move Mode part 1). Her steps save the customer's choices
 * in sessionStorage under the key "moveDraft", and this page reads and extends it:
 *   {
 *     old_home_id, new_home_id,
 *     new_home:   { address, latitude, longitude },
 *     appliances: [{ appliance_id, category, quantity }],
 *     selections: {}            // written by THIS page
 *   }
 * When the customer continues, selections looks like:
 *   { "<service key>": { service_id, service_label, count, unit_price,
 *                        technician_id, technician_name, distance_km } }
 * Meghana's cost-estimate step reads draft.selections.
 *
 * Uses the shared helper from static/js/api.js: apiPost(url, body).
 * ASSUMPTION: it returns parsed JSON and throws an Error with a readable message
 * when the request fails.
 */

const DRAFT_KEY = 'moveDraft';
const NEXT_URL = '/move/cost-estimate'; // Meghana's next step: confirm the URL with her/Pavan

const $ = (id) => document.getElementById(id);

let draft = null;
let coordinates = null;   // { latitude, longitude }
let groups = [];          // one per distinct required service
let servicesCache = null; // used only if required-services returns no service_id

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function humanize(key) {
  const text = String(key || '').replace(/_/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function showMessage(type, text) {
  const box = $('search-message');
  box.className = 'alert alert-' + type; // alert-error | alert-success
  box.textContent = text;
  box.hidden = false;
}
function clearMessage() {
  $('search-message').hidden = true;
}

function readDraft() {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY)); } catch (e) { return null; }
}
function saveDraft() {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

/* ---------- required services, grouped ---------- */
async function loadRequiredServices() {
  const items = await apiPost('/api/move/required-services', { // api.js
    appliances: draft.appliances.map((a) => ({ appliance_id: a.appliance_id, category: a.category })),
  });

  const byKey = {};
  items.forEach((item) => {
    const key = String(item.service_id ?? item.required_service);
    if (!byKey[key]) {
      byKey[key] = {
        key,
        service_id: item.service_id ?? null,
        label: humanize(item.required_service),
        category: item.category,
        unit_price: item.estimated_price || 0,
        count: 0,
        technicians: [],
        status: 'loading',   // loading | ready | empty | error
        error: '',
        selected: null,
      };
    }
    byKey[key].count += 1;
  });
  return Object.values(byKey);
}

/* If the backend doesn't return service_id yet, try to match a service by name. */
async function resolveServiceId(group) {
  if (group.service_id !== null) return group.service_id;
  if (!servicesCache) servicesCache = await apiGet('/api/services'); // api.js
  const words = String(group.category || '').toLowerCase();
  const match = servicesCache.find((s) =>
    s.category === 'Installation' && s.name.toLowerCase().includes(words));
  return match ? match.service_id : null;
}

/* ---------- technicians per service ---------- */
async function loadTechnicians(group) {
  group.status = 'loading';
  renderBlocks();
  try {
    const serviceId = await resolveServiceId(group);
    if (serviceId === null) {
      group.status = 'error';
      group.error = 'No matching service was found for this appliance.';
      return;
    }
    group.service_id = serviceId;
    const rows = await apiPost('/api/move/nearby-technicians', { // api.js
      service_id: serviceId,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    });
    group.technicians = rows;
    group.status = rows.length ? 'ready' : 'empty';
  } catch (err) {
    group.status = 'error';
    group.error = err.message;
  } finally {
    renderBlocks();
  }
}

function technicianId(t) { return t.technician_id ?? t.user_id; }

/* ---------- rendering ---------- */
function technicianList(group) {
  if (group.status === 'loading') return '<p class="muted">Finding technicians…</p>';
  if (group.status === 'error') {
    return `<div class="alert alert-error">Couldn't load technicians: ${escapeHtml(group.error)}</div>
            <button type="button" class="btn btn-secondary" data-retry="${escapeHtml(group.key)}">Try again</button>`;
  }
  if (group.status === 'empty') {
    return '<p class="muted">No technicians found near your new home for this service yet.</p>';
  }
  return '<div class="option-list">' + group.technicians.map((t) => {
    const id = technicianId(t);
    const selected = group.selected && group.selected.technician_id === id;
    const years = t.experience_years ?? t.years_experience ?? 0;
    return `
      <button type="button" class="option-item ${selected ? 'is-selected' : ''}"
              data-group="${escapeHtml(group.key)}" data-tech="${id}" aria-pressed="${selected}">
        <span class="option-title">${escapeHtml(t.name)}</span>
        <span class="option-meta">${t.distance_km != null ? escapeHtml(t.distance_km) + ' km away' : ''} · ${escapeHtml(years)} yrs experience</span>
        <span class="option-price">${t.rating ? Number(t.rating).toFixed(1) + ' ★' : 'New'}</span>
      </button>`;
  }).join('') + '</div>';
}

function renderBlocks() {
  $('service-blocks').innerHTML = groups.map((g) => `
    <section class="card">
      <h2>${escapeHtml(g.label)}${g.count > 1 ? ' × ' + g.count : ''}</h2>
      <p class="muted">Estimated ₹${escapeHtml(g.unit_price * g.count)}</p>
      ${technicianList(g)}
    </section>`).join('');
  updateContinue();
}

function updateContinue() {
  const done = groups.filter((g) => g.selected).length;
  $('search-actions').hidden = !groups.length;
  $('selection-count').textContent = `${done} of ${groups.length} services have a technician`;
}

/* ---------- interactions ---------- */
$('service-blocks').addEventListener('click', (event) => {
  const retry = event.target.closest('[data-retry]');
  if (retry) {
    const group = groups.find((g) => g.key === retry.dataset.retry);
    if (group) loadTechnicians(group);
    return;
  }
  const option = event.target.closest('[data-tech]');
  if (!option) return;
  const group = groups.find((g) => g.key === option.dataset.group);
  const tech = group.technicians.find((t) => String(technicianId(t)) === option.dataset.tech);
  group.selected = {
    technician_id: technicianId(tech),
    technician_name: tech.name,
    distance_km: tech.distance_km ?? null,
  };
  clearMessage();
  renderBlocks();
});

$('btn-continue').addEventListener('click', () => {
  const missing = groups.filter((g) => !g.selected);
  if (missing.length) {
    showMessage('error', 'Choose a technician for: ' + missing.map((g) => g.label).join(', ') + '.');
    return;
  }
  draft.selections = {};
  groups.forEach((g) => {
    draft.selections[g.key] = {
      service_id: g.service_id,
      service_label: g.label,
      count: g.count,
      unit_price: g.unit_price,
      ...g.selected,
    };
  });
  saveDraft();
  window.location.href = NEXT_URL;
});

$('coords-form').addEventListener('submit', (event) => {
  event.preventDefault();
  coordinates = { latitude: Number($('c-lat').value), longitude: Number($('c-lon').value) };
  draft.new_home = { ...(draft.new_home || {}), ...coordinates };
  saveDraft();
  $('coords-card').hidden = true;
  groups.forEach(loadTechnicians);
});

/* ---------- start ---------- */
(async function init() {
  draft = readDraft();
  if (!draft || !Array.isArray(draft.appliances) || !draft.appliances.length) {
    $('service-blocks').innerHTML = '';
    showMessage('error', 'No appliances selected yet. Go back to the move setup and choose the appliances you are moving.');
    return;
  }

  try {
    groups = await loadRequiredServices();
  } catch (err) {
    $('service-blocks').innerHTML = '';
    showMessage('error', "Couldn't work out the services you need: " + err.message);
    return;
  }
  if (!groups.length) {
    $('service-blocks').innerHTML = '<p class="muted">None of the selected appliances need a service.</p>';
    return;
  }
  renderBlocks();

  const home = draft.new_home || {};
  if (home.latitude != null && home.longitude != null && home.latitude !== '' && home.longitude !== '') {
    coordinates = { latitude: Number(home.latitude), longitude: Number(home.longitude) };
    groups.forEach(loadTechnicians);
  } else {
    $('coords-card').hidden = false; // no coordinates saved: ask for them
    groups.forEach((g) => { g.status = 'empty'; });
    renderBlocks();
    $('service-blocks').querySelectorAll('.muted').forEach((p) => {
      if (p.textContent.startsWith('No technicians')) p.textContent = 'Enter the location above to see technicians.';
    });
  }
})();
