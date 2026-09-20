// NOTE: requires window.CURRENT_USER_ID injected by Flask (see booking/wizard.js note)
const STAGES = ['Pending', 'Assigned', 'Accepted', 'Scheduled', 'In Progress', 'Completed'];

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  return isNaN(d) ? String(val) : d.toLocaleDateString(undefined, {year:'numeric',month:'short',day:'numeric'});
}

function stageBar(status) {
  if (status === 'Cancelled') {
    return `<div class="track-stages"><div class="stage current" style="color:var(--warn)">Cancelled</div></div>`;
  }
  const idx = STAGES.indexOf(status);
  return `<div class="track-stages">${STAGES.map((s, i) => `
    <div class="stage ${i < idx ? 'done' : ''} ${i === idx ? 'current' : ''}">${s}</div>`).join('')}</div>`;
}

async function loadBookings() {
  const list = document.getElementById('bookings-list');
  list.innerHTML = '<div class="load">Loading your bookings…</div>';
  try {
    const res = await fetch(`/api/bookings/customer/${window.CURRENT_USER_ID}`);
    if (!res.ok) throw new Error('Request failed (' + res.status + ')');
    const rows = await res.json();
    if (!rows.length) {
      list.innerHTML = '<div class="empty">You have no bookings yet. <a href="/services">Browse services</a>.</div>';
      return;
    }
    list.innerHTML = rows.map(b => `
      <div class="table-wrap" style="padding:18px;">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <div>
            <div style="font-weight:600;">Booking #${b.booking_id}</div>
            <div class="label">${fmtDate(b.booking_date)} ${escapeHtml(b.booking_time || '')} · ${escapeHtml(b.location || '')}</div>
          </div>
          <div style="text-align:right;">
            <span class="badge ${String(b.status).toLowerCase().replace(' ', '')}">${escapeHtml(b.status)}</span>
            ${['Pending','Scheduled'].includes(b.status) ? `<button class="row-btn danger" style="margin-left:8px;" onclick="cancelBooking(${b.booking_id}, this)">Cancel</button>` : ''}
          </div>
        </div>
        ${stageBar(b.status)}
        ${b.status === 'Completed' ? `<a class="row-btn" href="/bookings/${b.booking_id}/review">Rate & review</a>` : ''}
      </div>`).join('');
  } catch (e) {
    list.innerHTML = `<div class="err">Couldn't load bookings — ${escapeHtml(e.message)}</div>`;
  }
}

async function cancelBooking(id, btn) {
  if (!confirm('Cancel this booking?')) return;
  btn.disabled = true;
  btn.textContent = 'Cancelling…';
  try {
    const res = await fetch(`/api/bookings/${id}/cancel`, {method: 'POST'});
    if (!res.ok) throw new Error('Request failed (' + res.status + ')');
    loadBookings();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Cancel';
    alert("Couldn't cancel booking: " + e.message);
  }
}

loadBookings();
