/*
 * static/js/notifications.js — logic for templates/notifications/center.html
 * (Phase 13)
 *
 * NOT BUILT YET on the backend. Only POST /api/admin/notifications exists
 * (lets an admin send one). This page needs two routes that don't exist:
 *   GET /api/notifications/<user_id>
 *     -> [{notification_id, message, type, status, created_at}]
 *   PATCH /api/notifications/<id>/read
 *     -> marks one notification as Read (status: 'Unread' | 'Read' in schema.sql)
 * Until both exist, this page shows a clear error for the list and the mark-
 * as-read button will fail the same way.
 *
 * USER_ID here is whichever role is logged in (customer, technician, or
 * admin) — notifications.user_id in schema.sql isn't role-specific, so this
 * reads current_user_id the same way other pages do, not a technician- or
 * customer-only id.
 *
 * Uses the shared helpers from static/js/api.js: apiGet(url), apiPost(url, body).
 * ASSUMPTION: they return parsed JSON and throw an Error with a readable
 * message when the request fails. api.js has no apiPatch, so marking as read
 * uses the small sendPatch() below — swap it for apiPatch if Meghana adds one.
 */

const root = document.getElementById('notif-root');
const USER_ID = Number(root.dataset.userId) || null;

let notifications = [];
let activeFilter = '';

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatWhen(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d)) return String(value);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function showMessage(type, text) {
  const box = $('notif-message');
  box.className = 'alert alert-' + type; // alert-error | alert-success
  box.textContent = text;
  box.hidden = false;
}

async function sendPatch(url) {
  const res = await fetch(url, { method: 'PATCH' });
  let data = {};
  try { data = await res.json(); } catch (e) { /* empty body */ }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ---------- list ---------- */
async function loadNotifications() {
  const list = $('notif-list');
  list.innerHTML = '<p class="muted">Loading notifications…</p>';
  try {
    notifications = await apiGet(`/api/notifications/${USER_ID}`); // api.js — NOT BUILT YET, see file header
    renderList();
  } catch (err) {
    list.innerHTML = '';
    showMessage('error', "Couldn't load notifications: " + err.message + '. This endpoint may not be built yet.');
  }
}

function renderList() {
  const list = $('notif-list');
  const visible = activeFilter ? notifications.filter((n) => n.status === activeFilter) : notifications;

  if (!notifications.length) {
    list.innerHTML = '<p class="muted">No notifications yet.</p>';
    return;
  }
  if (!visible.length) {
    list.innerHTML = '<p class="muted">No unread notifications.</p>';
    return;
  }

  list.innerHTML = visible.map((n) => `
    <div class="item-row notif-row ${n.status === 'Unread' ? 'is-unread' : ''}" data-id="${n.notification_id}">
      <span class="notif-body">
        <span class="notif-message-text">${escapeHtml(n.message)}</span>
        <span class="muted">${escapeHtml(n.type || '')} · ${escapeHtml(formatWhen(n.created_at))}</span>
      </span>
      ${n.status === 'Unread' ? `<button type="button" class="btn btn-secondary" data-mark-read="${n.notification_id}">Mark as read</button>` : ''}
    </div>`).join('');
}

$('notif-list').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-mark-read]');
  if (!button) return;
  const id = button.dataset.markRead;
  button.disabled = true;
  button.textContent = 'Marking…';
  try {
    await sendPatch(`/api/notifications/${id}/read`); // NOT BUILT YET, see file header
    const item = notifications.find((n) => String(n.notification_id) === id);
    if (item) item.status = 'Read';
    renderList();
  } catch (err) {
    button.disabled = false;
    button.textContent = 'Mark as read';
    showMessage('error', "Couldn't mark this as read: " + err.message);
  }
});

$('notif-filters').addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#notif-filters .chip').forEach((c) => c.classList.remove('is-active'));
  chip.classList.add('is-active');
  activeFilter = chip.dataset.filter;
  renderList();
});

/* ---------- start ---------- */
if (!USER_ID) {
  $('notif-list').innerHTML = '';
  showMessage('error', 'Log in to see your notifications.');
} else {
  loadNotifications();
}
