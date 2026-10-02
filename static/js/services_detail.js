/*
 * static/js/services_detail.js — logic for templates/services/detail_card.html
 * (Phase 8)
 *
 * Backend (routes/services.py):
 *   GET /api/services/<id> -> {service_id, name, description, category,
 *                              price_range, required_skill, estimated_duration}
 *
 * Not listed by name in the project structure doc — only services.js is
 * named, for catalog.html. Kept as its own file since catalog.html's
 * services.js already has its own page-load logic for the grid, and loading
 * a second unrelated page's script there would run code this page doesn't
 * need. Add it to the structure doc if the team wants it tracked.
 *
 * NEEDS AN app.py ROUTE: this page expects to be opened at /services/<id>
 * with the id in the URL path, e.g. /services/7. The current /services/<id>
 * route in app.py still points at services/detail.html (deleted earlier in
 * the project) — flag to whoever owns app.py to point it at
 * services/detail_card.html instead.
 *
 * Uses the shared helper from static/js/api.js: apiGet(url).
 * ASSUMPTION: it returns parsed JSON and throws an Error with a readable
 * message when the request fails.
 */

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showMessage(text) {
  const box = $('detail-message');
  box.className = 'alert alert-error';
  box.textContent = text;
  box.hidden = false;
}

/* The id comes from the last segment of the URL path, e.g. /services/7 -> 7 */
function getServiceId() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

async function loadDetail() {
  const id = getServiceId();
  const box = $('s-detail');
  try {
    const service = await apiGet(`/api/services/${id}`); // api.js

    $('s-name').textContent = service.name;
    $('s-category').textContent = service.category;

    box.innerHTML = `
      <p>${escapeHtml(service.description || 'No description provided yet.')}</p>
      <div class="summary-row"><span class="summary-label">Estimated price</span><span class="summary-value">${escapeHtml(service.price_range || 'Price on request')}</span></div>
      <div class="summary-row"><span class="summary-label">Estimated duration</span><span class="summary-value">${escapeHtml(service.estimated_duration || '—')}</span></div>
      <div class="summary-row"><span class="summary-label">Skill needed</span><span class="summary-value">${escapeHtml(service.required_skill || '—')}</span></div>
      <a class="btn btn-primary" href="/bookings/new?service_id=${encodeURIComponent(service.service_id)}">Book this service</a>
    `;
  } catch (err) {
    box.innerHTML = '';
    showMessage("Couldn't load this service: " + err.message);
  }
}

loadDetail();
