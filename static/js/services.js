/*
 * static/js/services.js — logic for templates/services/catalog.html
 *
 * Backend (routes/services.py):
 *   GET /api/services                    all services
 *   GET /api/services?category=Plumbing  filtered by category
 *   GET /api/services/categories         list of category names
 *
 * Uses the shared helper from static/js/api.js: apiGet(url).
 * ASSUMPTION: apiGet returns parsed JSON and throws an Error with a readable
 * message when the request fails. If api.js works differently, only the two
 * calls marked "api.js" below need to change.
 */

let activeCategory = '';
let loadedServices = [];

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showMessage(text) {
  const box = $('services-message');
  box.className = 'alert alert-error';
  box.textContent = text;
  box.hidden = false;
}
function clearMessage() {
  const box = $('services-message');
  box.hidden = true;
  box.textContent = '';
}

/* ---------- category filters ---------- */
async function loadCategories() {
  try {
    const categories = await apiGet('/api/services/categories'); // api.js
    const bar = $('category-filters');
    categories.forEach((name) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.dataset.category = name;
      chip.textContent = name;
      bar.appendChild(chip);
    });
  } catch (err) {
    // Filters are optional: the full list still works without them.
  }
}

$('category-filters').addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#category-filters .chip').forEach((c) => c.classList.remove('is-active'));
  chip.classList.add('is-active');
  activeCategory = chip.dataset.category;
  loadServices();
});

/* ---------- search (runs on the services already loaded) ---------- */
$('service-search').addEventListener('input', renderServices);

function matchesSearch(service, term) {
  if (!term) return true;
  const haystack = [service.name, service.description, service.category, service.required_skill]
    .filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(term);
}

/* ---------- service cards ---------- */
function renderServices() {
  const grid = $('service-grid');
  const term = $('service-search').value.trim().toLowerCase();
  const visible = loadedServices.filter((s) => matchesSearch(s, term));

  if (!visible.length) {
    grid.innerHTML = loadedServices.length
      ? '<p class="muted">No services match your search. Try a different word.</p>'
      : '<p class="muted">No services in this category yet.</p>';
    return;
  }

  grid.innerHTML = visible.map((s) => `
    <article class="card service-card">
      <span class="badge">${escapeHtml(s.category)}</span>
      <h2 class="card-title">${escapeHtml(s.name)}</h2>
      <p class="muted">${escapeHtml(s.description || 'No description yet.')}</p>
      <dl class="service-meta">
        <dt>Price</dt><dd>${escapeHtml(s.price_range || 'On request')}</dd>
        <dt>Duration</dt><dd>${escapeHtml(s.estimated_duration || '—')}</dd>
        <dt>Skill needed</dt><dd>${escapeHtml(s.required_skill || '—')}</dd>
      </dl>
      <a class="btn btn-primary" href="/bookings/new?service_id=${encodeURIComponent(s.service_id)}">Book this service</a>
    </article>`).join('');
}

async function loadServices() {
  const grid = $('service-grid');
  clearMessage();
  grid.innerHTML = '<p class="muted">Loading services…</p>';
  try {
    const url = activeCategory
      ? `/api/services?category=${encodeURIComponent(activeCategory)}`
      : '/api/services';
    loadedServices = await apiGet(url); // api.js
    renderServices();
  } catch (err) {
    grid.innerHTML = '';
    showMessage("Couldn't load services: " + err.message);
  }
}

loadCategories();
loadServices();
