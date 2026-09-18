const API = '/api/admin';
let bookingStatusFilter = '';

// ---------- nav ----------
document.getElementById('nav').addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-btn');
  if (!btn) return;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const target = btn.dataset.section;
  document.querySelectorAll('main > section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + target).classList.add('active');
  load(target);
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
function badgeClass(status) {
  const s = String(status || '').toLowerCase();
  return s;
}
async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: {'Content-Type': 'application/json'},
    ...opts
  });
  if (!res.ok) {
    let msg = 'Request failed (' + res.status + ')';
    try { const j = await res.json(); if (j.error) msg = j.error; } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}
function setBody(id, html) { document.getElementById(id).innerHTML = html; }

// ---------- dashboard ----------
async function loadDashboard() {
  try {
    const data = await api('/dashboard');
    const entries = Object.entries(data || {});
    if (!entries.length) return setBody('dashboard-body', '<div class="empty">No statistics available yet.</div>');
    const cards = entries.map(([key, val]) => `
      <div class="stat-card">
        <div class="num">${escapeHtml(typeof val === 'number' ? val.toLocaleString() : val)}</div>
        <div class="label">${escapeHtml(key.replace(/_/g,' '))}</div>
      </div>`).join('');
    setBody('dashboard-body', `<div class="stat-grid">${cards}</div>`);
  } catch (e) {
    setBody('dashboard-body', `<div class="err">Couldn't load statistics — ${escapeHtml(e.message)}</div>`);
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
        <td><span class="badge ${verified ? 'verified' : 'pending'}">${verified ? 'Verified' : (r.verification_status || 'Pending')}</span></td>
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
    const head = cols.map(c => `<th>${escapeHtml(c.replace(/_/g,' '))}</th>`).join('');
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
    const body = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.review_id)}</td>
        <td>${'★'.repeat(Math.round(r.rating || 0))}<span style="color:var(--line)">${'★'.repeat(5 - Math.round(r.rating || 0))}</span></td>
        <td>${escapeHtml(r.comment || r.review_text || '—')}</td>
        <td>${fmtDate(r.review_date)}</td>
        <td><button class="row-btn danger" onclick="removeReview(${r.review_id}, this)">Remove</button></td>
      </tr>`).join('');
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
load('dashboard');
