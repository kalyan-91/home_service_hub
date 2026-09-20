function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Expects the page to be served at a path like /services/12
function getServiceId() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

async function loadDetail() {
  const id = getServiceId();
  const box = document.getElementById('s-detail');
  try {
    const res = await fetch(`/api/services/${id}`);
    if (!res.ok) throw new Error('Request failed (' + res.status + ')');
    const s = await res.json();

    document.getElementById('s-name').textContent = s.name;
    document.getElementById('s-category').textContent = s.category;
    document.title = s.name + ' — HomeService OS';

    box.innerHTML = `
      <p>${escapeHtml(s.description || 'No description provided yet.')}</p>
      <div class="field"><label>Estimated price</label>
        <div>${escapeHtml(s.price_range || 'Price on request')}</div></div>
      <div class="field"><label>Estimated duration</label>
        <div>${escapeHtml(s.estimated_duration || '—')}</div></div>
      <div class="field"><label>Required skill</label>
        <div>${escapeHtml(s.required_skill || '—')}</div></div>
      <a class="btn-primary" style="display:inline-block;text-decoration:none;margin-top:8px;"
         href="/bookings/new?service_id=${encodeURIComponent(s.service_id)}">Book this service</a>
    `;
  } catch (e) {
    box.innerHTML = `<div class="err">Couldn't load this service — ${escapeHtml(e.message)}</div>`;
  }
}

loadDetail();
