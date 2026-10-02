const API = '/api/admin';
let bookingStatusFilter = '';

// ---------- icons ----------
const ICONS = {
  home: '<path d="M3 11l9-8 9 8M5 9.5V21h5v-6h4v6h5V9.5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  userplus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5L22 13.6a2 2 0 0 1 0 2.8l-5.6 5.6a2 2 0 0 1-2.8 0L2 10.4a2 2 0 0 1 0-2.8l2.4-2.4a4 4 0 0 0 5 5z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
  star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  chart: '<path d="M3 3v18h18M7 15l4-4 3 3 5-6"/>',
  money: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'
};
function renderIcons() {
  document.querySelectorAll('[data-icon]').forEach(el => {
    const p = ICONS[el.dataset.icon];
    if (!p || el.querySelector('svg')) return;
    el.insertAdjacentHTML('afterbegin',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>');
  });
}

// ---------- nav ----------
function showSection(target) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.section === target));
  document.querySelectorAll('main > section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('sec-' + target);
  if (sec) sec.classList.add('active');
  load(target);
}
document.getElementById('nav').addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-btn');
  if (btn) showSection(btn.dataset.section);
});
// Quick actions / "View All" buttons
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-goto]');
  if (go) showSection(go.dataset.goto);
});

// ---------- helpers ----------
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  return isNaN(d) ? String(val) : d.toLocaleDateString(undefined, {year:'numeric',month:'short',day:'numeric'});
}
function fmtNum(n) {
  const v = Number(n);
  return isNaN(v) ? String(n) : v.toLocaleString('en-IN');
}
function fmtMoney(n) {
  const v = Number(n);
  return isNaN(v) ? '₹0' : '₹' + v.toLocaleString('en-IN', {maximumFractionDigits: 0});
}
function badgeClass(status) { return String(status || '').toLowerCase(); }
function pick(obj, keys) {
  for (const k of keys) if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  return undefined;
}
function setBody(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: {'Content-Type': 'application/json'},
    credentials: 'same-origin',
    ...opts
  });
  if (res.status === 401 || res.status === 403) {
    window.location.href = '/admin/login';
    throw new Error('Please sign in again.');
  }
  if (!res.ok) {
    let msg = 'Request failed (' + res.status + ')';
    try { const j = await res.json(); if (j.error) msg = j.error; } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

// ---------- dashboard ----------
function bookingFields(r) {
  return {
    id: pick(r, ['booking_id', 'id']),
    service: pick(r, ['service_name', 'service', 'service_type', 'category']),
    customer: pick(r, ['customer_name', 'customer']),
    status: pick(r, ['status', 'booking_status']),
    date: pick(r, ['booking_date', 'scheduled_date', 'scheduled_at', 'created_at', 'date'])
  };
}

function renderChart(rows) {
  const counts = {completed: 0, cancelled: 0, pending: 0};
  rows.forEach(r => {
    const s = String(bookingFields(r).status || '').toLowerCase();
    if (s === 'completed') counts.completed++;
    else if (s === 'cancelled' || s === 'canceled') counts.cancelled++;
    else if (s === 'pending' || s === 'confirmed') counts.pending++;
  });
  const colors = {completed: '#0f4c85', cancelled: '#e07b39', pending: '#e8b130'};
  const max = Math.max(1, ...Object.values(counts));
  const bars = Object.keys(counts).map(k => {
    const h = Math.round((counts[k] / max) * 140) + (counts[k] ? 6 : 2);
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px">
      <b style="font-size:14px">${counts[k]}</b>
      <div style="width:56px;height:${h}px;background:${colors[k]};border-radius:8px 8px 0 0"></div>
      <span style="font-size:12px;text-transform:capitalize;opacity:.75">${k}</span></div>`;
  }).join('');
  setBody('chart', `<div style="display:flex;align-items:flex-end;justify-content:space-around;height:210px;padding-top:8px">${bars}</div>`);
  return counts;
}

function renderRecent(rows) {
  if (!rows.length) return setBody('recent-body', '<div class="empty">No bookings yet.</div>');
  const sorted = rows.slice().sort((a, b) => {
    const da = new Date(bookingFields(a).date), db = new Date(bookingFields(b).date);
    return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da);
  }).slice(0, 5);
  const body = sorted.map(r => {
    const f = bookingFields(r);
    return `<tr>
      <td>#${escapeHtml(f.id)}</td>
      <td>${escapeHtml(f.service || f.customer || '—')}</td>
      <td><span class="badge ${badgeClass(f.status)}">${escapeHtml(f.status || '—')}</span></td>
      <td>${fmtDate(f.date)}</td></tr>`;
  }).join('');
  setBody('recent-body', `<div class="table-wrap"><table><tbody>${body}</tbody></table></div>`);
}

async function loadDashboard() {
  // 1) headline numbers
  try {
    const raw = await api('/dashboard');
    const d = raw.stats || raw.summary || raw;
    const total = pick(d, ['total_bookings', 'bookings', 'bookings_total']);
    const customers = pick(d, ['total_customers', 'customers', 'customer_count']);
    const techs = pick(d, ['total_technicians', 'technicians', 'technician_count']);
    const revenue = pick(d, ['total_revenue', 'revenue']);
    const completed = pick(d, ['completed_bookings', 'completed']);
    const cancelled = pick(d, ['cancelled_bookings', 'canceled_bookings', 'cancelled']);
    const avg = pick(d, ['average_booking_value', 'avg_booking_value', 'avg_booking']);
    let popular = pick(d, ['popular_services', 'popular_service', 'top_services']);

    if (total !== undefined) setText('st-bookings', fmtNum(total));
    if (customers !== undefined) setText('st-customers', fmtNum(customers));
    if (techs !== undefined) setText('st-technicians', fmtNum(techs));
    if (revenue !== undefined) setText('st-revenue', fmtMoney(revenue));
    if (completed !== undefined) setText('st-completed', fmtNum(completed));
    if (cancelled !== undefined) setText('st-cancelled', fmtNum(cancelled));
    if (avg !== undefined) setText('st-avg', fmtMoney(avg));
    if (Array.isArray(popular)) {
      popular = popular.slice(0, 2).map(p => typeof p === 'object' ? pick(p, ['service_name', 'name', 'service']) : p).join(', ');
    }
    if (popular) setText('st-popular', popular);
  } catch (e) {
    console.error('Dashboard stats failed:', e);
  }

  // 2) chart + recent bookings from the bookings list
  try {
    const rows = await api('/bookings');
    renderChart(rows);
    renderRecent(rows);
    // fall back to counts from the list if the stats endpoint didn't supply them
    const c = {completed: 0, cancelled: 0};
    rows.forEach(r => {
      const s = String(bookingFields(r).status || '').toLowerCase();
      if (s === 'completed') c.completed++;
      if (s === 'cancelled' || s === 'canceled') c.cancelled++;
    });
    if (document.getElementById('st-bookings').textContent === '0') setText('st-bookings', fmtNum(rows.length));
    if (document.getElementById('st-completed').textContent === '0') setText('st-completed', fmtNum(c.completed));
    if (document.getElementById('st-cancelled').textContent === '0') setText('st-cancelled', fmtNum(c.cancelled));
  } catch (e) {
    setBody('recent-body', `<div class="err">Couldn't load bookings — ${escapeHtml(e.message)}</div>`);
  }
}

// ---------- customers ----------
async function loadCustomers() {
  try {
    const rows = await api('/customers');
    if (!rows.length) return setBody('customers-body', '<div class="empty">No customers yet.</div>');
    const body = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.user_id)}</td>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.email)}</td>
        <td>${fmtDate(r.created_at)}</td>
      </tr>`).join('');
    setBody('customers-body', `
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Joined</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>`);
  } catch (e) {
    setBody('customers-body', `<div class="err">Couldn't load customers — ${escapeHtml(e.message)}</div>`);
  }
}

// ---------- technicians ----------
async function loadTechnicians() {
  try {
    const rows = await api('/technicians');
    if (!rows.length) return setBody('technicians-body', '<div class="empty">No technicians yet.</div>');
    const body = rows.map(r => {
      const verified = String(r.verification_status || '').toLowerCase() === 'verified';
      return `
      <tr>
        <td>${escapeHtml(r.user_id)}</td>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.email)}</td>
        <td>${fmtDate(r.created_at)}</td>
        <td><span class="badge ${verified ? 'verified' : 'pending'}">${verified ? 'Verified' : escapeHtml(r.verification_status || 'Pending')}</span></td>
        <td><button class="row-btn" ${verified ? 'disabled' : ''} onclick="verifyTechnician(${r.user_id}, this)">${verified ? 'Verified' : 'Verify'}</button></td>
      </tr>`;
    }).join('');
    setBody('technicians-body', `
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Joined</th><th>Status</th><th></th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>`);
  } catch (e) {
    setBody('technicians-body', `<div class="err">Couldn't load technicians — ${escapeHtml(e.message)}</div>`);
  }
}
async function verifyTechnician(id, btn) {
  btn.disabled = true;
  btn.textContent = 'Verifying…';
  try {
    await api(`/technicians/${id}/verify`, {method: 'POST'});
    loadTechnicians();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Verify';
    alert("Couldn't verify technician: " + e.message);
  }
}

// ---------- bookings ----------
document.getElementById('booking-filters').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#booking-filters .chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  bookingStatusFilter = chip.dataset.status;
  loadBookings();
});
async function loadBookings() {
  try {
    const query = bookingStatusFilter ? `?status=${encodeURIComponent(bookingStatusFilter)}` : '';
    const rows = await api('/bookings' + query);
    if (!rows.length) return setBody('bookings-body', '<div class="empty">No bookings match this filter.</div>');
    const cols = Object.keys(rows[0]);
    const head = cols.map(c => `<th>${escapeHtml(c.replace(/_/g, ' '))}</th>`).join('');
    const body = rows.map(r => `<tr>${cols.map(c => {
      if (c.toLowerCase() === 'status') return `<td><span class="badge ${badgeClass(r[c])}">${escapeHtml(r[c])}</span></td>`;
      if (c.toLowerCase().includes('date') || c.toLowerCase().includes('_at')) return `<td>${fmtDate(r[c])}</td>`;
      return `<td>${escapeHtml(r[c])}</td>`;
    }).join('')}</tr>`).join('');
    setBody('bookings-body', `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
  } catch (e) {
    setBody('bookings-body', `<div class="err">Couldn't load bookings — ${escapeHtml(e.message)}</div>`);
  }
}

// ---------- complaints ----------
async function loadComplaints() {
  try {
    const rows = await api('/complaints');
    if (!rows.length) return setBody('complaints-body', '<div class="empty">No complaints on file.</div>');
    const body = rows.map(r => {
      const resolved = String(r.status || '').toLowerCase() === 'resolved';
      return `
      <tr>
        <td>${escapeHtml(r.complaint_id)}</td>
        <td>${escapeHtml(r.subject || r.description || '—')}</td>
        <td>${fmtDate(r.created_at)}</td>
        <td><span class="badge ${resolved ? 'resolved' : 'open'}">${escapeHtml(r.status || (resolved ? 'Resolved' : 'Open'))}</span></td>
        <td><button class="row-btn" ${resolved ? 'disabled' : ''} onclick="resolveComplaint(${r.complaint_id}, this)">${resolved ? 'Resolved' : 'Mark resolved'}</button></td>
      </tr>`;
    }).join('');
    setBody('complaints-body', `
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>Details</th><th>Filed</th><th>Status</th><th></th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>`);
  } catch (e) {
    setBody('complaints-body', `<div class="err">Couldn't load complaints — ${escapeHtml(e.message)}</div>`);
  }
}
async function resolveComplaint(id, btn) {
  btn.disabled = true;
  btn.textContent = 'Resolving…';
  try {
    await api(`/complaints/${id}/resolve`, {method: 'POST'});
    loadComplaints();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Mark resolved';
    alert("Couldn't resolve complaint: " + e.message);
  }
}

// ---------- reviews ----------
async function loadReviews() {
  try {
    const rows = await api('/reviews');
    if (!rows.length) return setBody('reviews-body', '<div class="empty">No reviews yet.</div>');
    const body = rows.map(r => {
      const n = Math.max(0, Math.min(5, Math.round(r.rating || 0)));
      return `
      <tr>
        <td>${escapeHtml(r.review_id)}</td>
        <td style="color:#e8b130;white-space:nowrap">${'★'.repeat(n)}<span style="color:#d9d2c1">${'★'.repeat(5 - n)}</span></td>
        <td>${escapeHtml(r.comment || r.review_text || '—')}</td>
        <td>${fmtDate(r.review_date)}</td>
        <td><button class="row-btn danger" onclick="removeReview(${r.review_id}, this)">Remove</button></td>
      </tr>`;
    }).join('');
    setBody('reviews-body', `
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>Rating</th><th>Comment</th><th>Date</th><th></th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>`);
  } catch (e) {
    setBody('reviews-body', `<div class="err">Couldn't load reviews — ${escapeHtml(e.message)}</div>`);
  }
}
async function removeReview(id, btn) {
  if (!confirm('Remove this review? This can\'t be undone.')) return;
  btn.disabled = true;
  btn.textContent = 'Removing…';
  try {
    await api(`/reviews/${id}`, {method: 'DELETE'});
    loadReviews();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Remove';
    alert("Couldn't remove review: " + e.message);
  }
}

// ---------- notifications ----------
document.getElementById('notif-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const note = document.getElementById('notif-note');
  const submitBtn = e.target.querySelector('.submit-btn');
  const payload = {
    user_id: Number(document.getElementById('notif-user').value),
    type: document.getElementById('notif-type').value,
    message: document.getElementById('notif-message').value.trim()
  };
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending…';
  note.textContent = '';
  note.className = 'form-note';
  try {
    await api('/notifications', {method: 'POST', body: JSON.stringify(payload)});
    note.textContent = 'Notification sent.';
    note.className = 'form-note ok';
    e.target.reset();
  } catch (err) {
    note.textContent = err.message;
    note.className = 'form-note err';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send notification';
  }
});

// ---------- search box: filters rows of the open section ----------
document.getElementById('search').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  document.querySelectorAll('main > section.active tbody tr').forEach(tr => {
    tr.style.display = !q || tr.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
});

// ---------- router ----------
function load(section) {
  ({
    dashboard: loadDashboard,
    customers: loadCustomers,
    technicians: loadTechnicians,
    bookings: loadBookings,
    complaints: loadComplaints,
    reviews: loadReviews
  }[section] || (() => {}))();
}

renderIcons();
load('dashboard');
