/*
 * NOTE FOR THE TEAM: this calls GET /api/technicians?sort=rating|experience
 * which does not exist yet in routes/technician.py or routes/admin.py.
 * The only technician-reading endpoints currently built are:
 *   - GET /api/technician/profile   (logged-in technician's OWN profile only)
 *   - GET /api/admin/technicians    (admin-only, returns id/name/email/created_at only,
 *                                     no rating/skills/service_area — not enough for this page)
 * Ask Member 1 or Member 3 to add a public route, e.g.:
 *   GET /api/technicians?sort=rating
 *     -> SELECT u.user_id, u.name, t.service_area, t.verification_status,
 *               AVG(r.rating) AS rating, MAX(ts.years_experience) AS years_experience
 *        FROM users u JOIN technicians t ON t.technician_id = u.user_id
 *        LEFT JOIN reviews r ON r.technician_id = u.user_id
 *        LEFT JOIN technician_skills ts ON ts.technician_id = u.user_id
 *        WHERE t.verification_status = 'Verified'
 *        GROUP BY u.user_id
 * Until that exists, this page will show a friendly error instead of a crash.
 */

let activeSort = 'rating';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function initials(name) {
  return (name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function starString(rating) {
  const r = Math.round(rating || 0);
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}

async function loadTechnicians() {
  const list = document.getElementById('tech-list');
  list.innerHTML = '<div class="load">Loading technicians…</div>';
  try {
    const res = await fetch(`/api/technicians?sort=${encodeURIComponent(activeSort)}`);
    if (!res.ok) throw new Error('Request failed (' + res.status + ')');
    const rows = await res.json();
    if (!rows.length) {
      list.innerHTML = '<div class="empty">No technicians available yet.</div>';
      return;
    }
    list.innerHTML = rows.map(t => `
      <a class="tech-card" style="text-decoration:none;" href="/technicians/${t.user_id}">
        <div class="avatar">${escapeHtml(initials(t.name))}</div>
        <div class="info">
          <div class="name">${escapeHtml(t.name)}</div>
          <div class="meta">${escapeHtml(t.service_area || 'Area not set')} · ${escapeHtml(String(t.years_experience || 0))} yrs experience</div>
          <div class="stars">${starString(t.rating)} <span style="color:var(--muted)">${t.rating ? Number(t.rating).toFixed(1) : 'No ratings yet'}</span></div>
        </div>
      </a>`).join('');
  } catch (e) {
    list.innerHTML = `<div class="err">Couldn't load technicians — ${escapeHtml(e.message)}. This endpoint may not be built yet — check with Member 1/3.</div>`;
  }
}

document.getElementById('sort-filters').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#sort-filters .chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  activeSort = chip.dataset.sort;
  loadTechnicians();
});

loadTechnicians();
