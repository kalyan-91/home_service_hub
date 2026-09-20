const API = '/api/services';
let activeCategory = '';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function api(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error('Request failed (' + res.status + ')');
  return res.json();
}

async function loadCategories() {
  try {
    const cats = await api('/categories');
    const wrap = document.getElementById('category-filters');
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.dataset.cat = cat;
      btn.textContent = cat;
      wrap.appendChild(btn);
    });
  } catch (e) { /* categories are optional, fail silently */ }
}

async function loadServices() {
  const grid = document.getElementById('service-grid');
  grid.innerHTML = '<div class="load">Loading services…</div>';
  try {
    const query = activeCategory ? `?category=${encodeURIComponent(activeCategory)}` : '';
    const rows = await api(query);
    if (!rows.length) {
      grid.innerHTML = '<div class="empty">No services in this category yet.</div>';
      return;
    }
    grid.innerHTML = rows.map(s => `
      <a class="stat-card service-card" href="/services/${s.service_id}">
        <div class="label">${escapeHtml(s.category)}</div>
        <div class="num" style="font-size:18px;">${escapeHtml(s.name)}</div>
        <div class="label">${escapeHtml(s.price_range || 'Price on request')} · ${escapeHtml(s.estimated_duration || '')}</div>
      </a>`).join('');
  } catch (e) {
    grid.innerHTML = `<div class="err">Couldn't load services — ${escapeHtml(e.message)}</div>`;
  }
}

document.getElementById('category-filters').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#category-filters .chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  activeCategory = chip.dataset.cat;
  loadServices();
});

loadCategories();
loadServices();
