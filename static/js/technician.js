/*
 * static/js/technician.js — logic for templates/technician/profile.html
 *
 * Backend (routes/technician.py, all need a logged-in technician):
 *   GET  /api/technician/profile              read profile
 *   PUT  /api/technician/profile              update name, phone, service_area, latitude, longitude
 *   GET  /api/technician/skills               list skills
 *   POST /api/technician/skills               add   {skill_category, years_experience}
 *   DELETE /api/technician/skills/<id>        remove
 *   GET  /api/technician/availability         list slots
 *   POST /api/technician/availability         add   {day_of_week, start_time, end_time, available}
 *   DELETE /api/technician/availability/<id>  remove
 * Also: GET /api/services/categories (suggestions for the skill field).
 *
 * Uses the shared helpers from static/js/api.js: apiGet, apiPost, apiDelete.
 * ASSUMPTION: they return parsed JSON and throw an Error with a readable message
 * when the request fails. api.js has no apiPut, so the profile update uses the
 * small sendPut() below. If Meghana adds apiPut, replace sendPut with it.
 */

const DAY_NAMES = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* MySQL TIME arrives as "9:00:00" — show it as "09:00". */
function shortTime(value) {
  const parts = String(value || '').split(':');
  if (parts.length < 2) return value || '';
  return parts[0].padStart(2, '0') + ':' + parts[1];
}

async function sendPut(url, body) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* empty body */ }
  if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');
  return data;
}

/* ---------- messages ---------- */
function showMessage(type, text) {
  const box = $('profile-message');
  box.className = 'alert alert-' + type; // alert-error | alert-success
  box.textContent = text;
  box.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function clearMessage() {
  $('profile-message').hidden = true;
}

/* ---------- profile ---------- */
async function loadProfile() {
  try {
    const p = await apiGet('/api/technician/profile'); // api.js
    $('p-name').value = p.name || '';
    $('p-email').value = p.email || '';
    $('p-phone').value = p.phone || '';
    $('p-area').value = p.service_area || '';
    $('p-lat').value = p.latitude ?? '';
    $('p-lon').value = p.longitude ?? '';

    const badge = $('verification-badge');
    const note = $('verification-note');
    const status = p.verification_status || 'Pending';
    badge.textContent = status;
    badge.className = 'badge badge-' + status.toLowerCase();
    badge.hidden = false;
    if (status === 'Verified') {
      note.hidden = true;
    } else if (status === 'Rejected') {
      note.textContent = 'Your registration was not approved. Contact the admin for details.';
      note.hidden = false;
    } else {
      note.textContent = 'Your account is waiting for admin verification. Customers can find you once it is verified.';
      note.hidden = false;
    }
    return true;
  } catch (err) {
    showMessage('error', "Couldn't load your profile: " + err.message + '. Log in as a technician and try again.');
    return false;
  }
}

$('profile-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();
  const button = $('btn-save-profile');
  button.disabled = true;
  button.textContent = 'Saving…';

  const body = {
    name: $('p-name').value.trim(),
    phone: $('p-phone').value.trim(),
    service_area: $('p-area').value.trim(),
  };
  if ($('p-lat').value !== '') body.latitude = Number($('p-lat').value);
  if ($('p-lon').value !== '') body.longitude = Number($('p-lon').value);

  try {
    await sendPut('/api/technician/profile', body);
    showMessage('success', 'Profile saved.');
  } catch (err) {
    showMessage('error', "Couldn't save your profile: " + err.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Save profile';
  }
});

$('btn-locate').addEventListener('click', () => {
  if (!navigator.geolocation) {
    showMessage('error', "Your browser can't share your location. Enter the coordinates by hand.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      $('p-lat').value = pos.coords.latitude.toFixed(6);
      $('p-lon').value = pos.coords.longitude.toFixed(6);
      clearMessage();
    },
    () => showMessage('error', 'Location access was blocked. Allow it in the browser, or enter the coordinates by hand.')
  );
});

/* ---------- skills ---------- */
async function loadSkills() {
  const list = $('skills-list');
  try {
    const skills = await apiGet('/api/technician/skills'); // api.js
    if (!skills.length) {
      list.innerHTML = '<p class="muted">No skills yet. Add the services you can do below.</p>';
      return;
    }
    list.innerHTML = skills.map((s) => `
      <div class="item-row">
        <span>${escapeHtml(s.skill_category)} <span class="muted">${escapeHtml(s.years_experience)} yrs</span></span>
        <button type="button" class="btn btn-danger" data-skill-id="${s.skill_id}">Remove</button>
      </div>`).join('');
  } catch (err) {
    list.innerHTML = '';
    showMessage('error', "Couldn't load your skills: " + err.message);
  }
}

$('skills-list').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-skill-id]');
  if (!button) return;
  button.disabled = true;
  try {
    await apiDelete(`/api/technician/skills/${button.dataset.skillId}`); // api.js
    loadSkills();
  } catch (err) {
    button.disabled = false;
    showMessage('error', "Couldn't remove the skill: " + err.message);
  }
});

$('skill-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();
  const category = $('s-category').value.trim();
  if (!category) { showMessage('error', 'Enter a skill or service category.'); return; }
  try {
    await apiPost('/api/technician/skills', { // api.js
      skill_category: category,
      years_experience: Number($('s-years').value) || 0,
    });
    $('s-category').value = '';
    $('s-years').value = 0;
    loadSkills();
  } catch (err) {
    showMessage('error', "Couldn't add the skill: " + err.message);
  }
});

async function loadCategorySuggestions() {
  try {
    const categories = await apiGet('/api/services/categories'); // api.js
    $('category-options').innerHTML = categories.map((c) => `<option value="${escapeHtml(c)}">`).join('');
  } catch (err) {
    // Suggestions are optional: the field still accepts any text.
  }
}

/* ---------- availability ---------- */
async function loadAvailability() {
  const list = $('availability-list');
  try {
    const slots = await apiGet('/api/technician/availability'); // api.js
    if (!slots.length) {
      list.innerHTML = '<p class="muted">No working hours yet. Add the days and times you are free below.</p>';
      return;
    }
    slots.sort((a, b) => DAY_ORDER.indexOf(a.day_of_week) - DAY_ORDER.indexOf(b.day_of_week));
    list.innerHTML = slots.map((a) => `
      <div class="item-row">
        <span>${escapeHtml(DAY_NAMES[a.day_of_week] || a.day_of_week)}
          <span class="muted">${escapeHtml(shortTime(a.start_time))} – ${escapeHtml(shortTime(a.end_time))}</span></span>
        <button type="button" class="btn btn-danger" data-availability-id="${a.availability_id}">Remove</button>
      </div>`).join('');
  } catch (err) {
    list.innerHTML = '';
    showMessage('error', "Couldn't load your availability: " + err.message);
  }
}

$('availability-list').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-availability-id]');
  if (!button) return;
  button.disabled = true;
  try {
    await apiDelete(`/api/technician/availability/${button.dataset.availabilityId}`); // api.js
    loadAvailability();
  } catch (err) {
    button.disabled = false;
    showMessage('error', "Couldn't remove the working hours: " + err.message);
  }
});

$('availability-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();
  const start = $('a-start').value;
  const end = $('a-end').value;
  if (!start || !end) { showMessage('error', 'Choose a start and an end time.'); return; }
  if (end <= start) { showMessage('error', 'The end time must be after the start time.'); return; }
  try {
    await apiPost('/api/technician/availability', { // api.js
      day_of_week: $('a-day').value,
      start_time: start,
      end_time: end,
      available: true,
    });
    loadAvailability();
  } catch (err) {
    showMessage('error', "Couldn't add the working hours: " + err.message);
  }
});

/* ---------- start ---------- */
(async function init() {
  const ok = await loadProfile();
  if (!ok) return; // not logged in as a technician: don't call the other endpoints
  loadSkills();
  loadAvailability();
  loadCategorySuggestions();
})();
