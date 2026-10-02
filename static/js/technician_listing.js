/*
 * static/js/technician_listing.js — logic for templates/technician/listing.html
 *
 * Backend (routes/technicians_public.py):
 *   GET /api/technicians?sort=rating|experience
 *     -> [{ user_id, name, service_area, verification_status, rating,
 *           review_count, years_experience }]   (Verified technicians only)
 *   GET /api/technicians/<id>  -> same fields plus a "skills" list
 *
 * This is a separate file from technician.js on purpose: technician.js is
 * the logged-in technician's own profile/skills/availability editor, and
 * this page is the public read-only list anyone can browse. Not listed by
 * name in the project structure doc — add it there if the team wants it
 * tracked.
 *
 * Uses the shared helper from static/js/api.js: apiGet(url).
 * ASSUMPTION: it returns parsed JSON and throws an Error with a readable
 * message when the request fails.
 */

let activeSort = 'rating';

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

function showMessage(text) {
  const box = $('tech-message');
  box.className = 'alert alert-error';
  box.textContent = text;
  box.hidden = false;
}
function clearMessage() {
  $('tech-message').hidden = true;
}

async function loadTechnicians() {
  const list = $('tech-list');
  clearMessage();
  list.innerHTML = '<p class="muted">Loading technicians…</p>';
  try {
    const rows = await apiGet(`/api/technicians?sort=${encodeURIComponent(activeSort)}`); // api.js
    if (!rows.length) {
      list.innerHTML = '<p class="muted">No technicians are available yet.</p>';
      return;
    }
    list.innerHTML = rows.map((t) => `
      <a class="item-row tech-row" href="/technicians/${t.user_id}">
        <span class="avatar">${escapeHtml(initials(t.name))}</span>
        <span class="tech-info">
          <span class="tech-name">${escapeHtml(t.name)}</span>
          <span class="muted">${escapeHtml(t.service_area || 'Area not set')} · ${escapeHtml(t.years_experience)} yrs experience</span>
          <span class="tech-stars">${stars(t.rating)} <span class="muted">${t.rating ? Number(t.rating).toFixed(1) + ' (' + t.review_count + ')' : 'No ratings yet'}</span></span>
        </span>
      </a>`).join('');
  } catch (err) {
    list.innerHTML = '';
    showMessage("Couldn't load technicians: " + err.message);
  }
}

$('sort-filters').addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#sort-filters .chip').forEach((c) => c.classList.remove('is-active'));
  chip.classList.add('is-active');
  activeSort = chip.dataset.sort;
  loadTechnicians();
});

loadTechnicians();
