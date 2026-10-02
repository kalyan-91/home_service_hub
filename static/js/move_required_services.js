/*
 * static/js/move_required_services.js — logic for templates/move/required_services.html
 * (Phase 11: shows what the selected appliances need, before technician search)
 *
 * Backend: POST /api/move/required-services {appliances:[{appliance_id, category}]}
 *   -> [{appliance_id, category, required_service, estimated_price}]
 *
 * Not listed by name in the project structure doc — the plan names only
 * move_matching.js for Move Mode part 2. Kept this as its own file rather
 * than merging it into move_matching.js, since the two pages' logic doesn't
 * overlap. Add it to the structure doc if the team wants it tracked.
 *
 * HAND-OFF: reads the same sessionStorage "moveDraft" that Meghana's
 * appliance-selection step writes (see the comment in move_matching.js for
 * its shape). Doesn't write anything new to it — technician_search.html
 * re-fetches required services itself when the customer gets there.
 *
 * Uses the shared helper from static/js/api.js: apiPost(url, body).
 * ASSUMPTION: it returns parsed JSON and throws an Error with a readable
 * message when the request fails.
 */

const DRAFT_KEY = 'moveDraft';
const NEXT_URL = '/move/technician-search';

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function humanize(key) {
  const text = String(key || '').replace(/_/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function money(value) {
  return '₹' + Number(value || 0).toLocaleString('en-IN');
}

function showMessage(text) {
  const box = $('required-message');
  box.className = 'alert alert-error';
  box.textContent = text;
  box.hidden = false;
}

function readDraft() {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY)); } catch (e) { return null; }
}

/* ---------- group identical required services ---------- */
function groupByService(items) {
  const byKey = {};
  items.forEach((item) => {
    const key = item.required_service;
    if (!byKey[key]) {
      byKey[key] = { label: humanize(item.required_service), unitPrice: item.estimated_price || 0, count: 0 };
    }
    byKey[key].count += 1;
  });
  return Object.values(byKey);
}

/* ---------- start ---------- */
(async function init() {
  const draft = readDraft();
  if (!draft || !Array.isArray(draft.appliances) || !draft.appliances.length) {
    $('required-list').innerHTML = '';
    showMessage('No appliances selected yet. Go back to the move setup and choose the appliances you are moving.');
    return;
  }

  let items;
  try {
    items = await apiPost('/api/move/required-services', { // api.js
      appliances: draft.appliances.map((a) => ({ appliance_id: a.appliance_id, category: a.category })),
    });
  } catch (err) {
    $('required-list').innerHTML = '';
    showMessage("Couldn't work out the services you need: " + err.message);
    return;
  }

  if (!items.length) {
    $('required-list').innerHTML = '<p class="muted">None of the selected appliances need a service.</p>';
    return;
  }

  const groups = groupByService(items);
  const total = groups.reduce((sum, g) => sum + g.unitPrice * g.count, 0);

  $('required-list').innerHTML = groups.map((g) => `
    <div class="item-row">
      <span>${escapeHtml(g.label)}${g.count > 1 ? ' × ' + g.count : ''}</span>
      <span>${money(g.unitPrice * g.count)}</span>
    </div>`).join('');

  $('required-total').textContent = `Estimated total: ${money(total)}`;
  $('btn-continue').disabled = false;
})();

$('btn-continue').addEventListener('click', () => {
  window.location.href = NEXT_URL;
});
