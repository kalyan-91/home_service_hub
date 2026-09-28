/*
 * static/js/booking.js — logic for templates/booking/request_flow.html
 *
 * Backend (routes/booking.py):
 *   POST /api/bookings                create
 *   GET  /api/bookings/<id>           read status
 *   POST /api/bookings/<id>/cancel    cancel
 * Also uses:
 *   GET  /api/services
 *   GET  /api/technicians?service_id=X   (NOT built yet — a manual ID field is shown until it exists)
 *
 * Uses the shared helpers from static/js/api.js: apiGet(url), apiPost(url, body).
 * ASSUMPTION: they return parsed JSON and throw an Error (with a readable message)
 * when the response is not OK. If api.js works differently, only the three calls
 * marked "api.js" below need to change.
 */

const STATUS_FLOW = ['Pending', 'Assigned', 'Accepted', 'Scheduled', 'In Progress', 'Completed'];
const STEP_TITLES = ['Choose a service', 'Choose a technician', 'Pick date and time', 'Add location and cost', 'Review and confirm'];
const TOTAL_STEPS = 5;

const root = document.getElementById('request-flow');
const CUSTOMER_ID = Number(root.dataset.customerId) || null;
const PRESELECTED_SERVICE_ID = root.dataset.serviceId || '';

const state = {
  service: null,
  technicianId: null,
  technicianName: '',
  date: '',
  time: '',
  location: '',
  cost: '',
  bookingId: null,
};
let step = 1;
let servicesById = {};
let technicianListAvailable = true;

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDate(value) {
  const d = new Date(value);
  return isNaN(d) ? value : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function firstNumber(text) {
  const match = String(text || '').replace(/,/g, '').match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : '';
}

/* ---------- messages ---------- */
function showMessage(type, text) {
  const box = $('flow-message');
  box.className = 'alert alert-' + type; // alert-error | alert-success
  box.textContent = text;
  box.hidden = false;
}
function clearMessage() {
  const box = $('flow-message');
  box.hidden = true;
  box.textContent = '';
}

/* ---------- step display ---------- */
function render() {
  document.querySelectorAll('#stepper .stepper-step').forEach((el) => {
    const n = Number(el.dataset.step);
    el.classList.toggle('is-done', n < step);
    el.classList.toggle('is-active', n === step);
    if (n === step) el.setAttribute('aria-current', 'step');
    else el.removeAttribute('aria-current');
  });
  document.querySelectorAll('.flow-step').forEach((el) => { el.hidden = true; });
  $('step-' + step).hidden = false;
  $('btn-back').hidden = step === 1;
  $('btn-next').textContent = step === TOTAL_STEPS ? 'Send request' : 'Next';
}

/* ---------- selectable option lists ---------- */
function bindOptions(container, onPick) {
  container.querySelectorAll('.option-item').forEach((item) => {
    item.addEventListener('click', () => {
      container.querySelectorAll('.option-item').forEach((i) => {
        i.classList.remove('is-selected');
        i.setAttribute('aria-pressed', 'false');
      });
      item.classList.add('is-selected');
      item.setAttribute('aria-pressed', 'true');
      onPick(item);
    });
  });
}

/* ---------- step 1: services ---------- */
async function loadServices() {
  const box = $('service-options');
  try {
    const rows = await apiGet('/api/services'); // api.js
    if (!rows.length) {
      box.innerHTML = '<p class="muted">No services are available yet.</p>';
      return;
    }
    rows.forEach((s) => { servicesById[s.service_id] = s; });
    box.innerHTML = rows.map((s) => `
      <button type="button" class="option-item" data-id="${s.service_id}" aria-pressed="false">
        <span class="option-title">${escapeHtml(s.name)}</span>
        <span class="option-meta">${escapeHtml(s.category)}</span>
        <span class="option-price">${escapeHtml(s.price_range || 'Price on request')}</span>
      </button>`).join('');
    bindOptions(box, (item) => {
      state.service = servicesById[item.dataset.id];
      state.technicianId = null;
      state.technicianName = '';
    });
    if (PRESELECTED_SERVICE_ID && servicesById[PRESELECTED_SERVICE_ID]) {
      box.querySelector(`[data-id="${PRESELECTED_SERVICE_ID}"]`).click();
    }
  } catch (err) {
    box.innerHTML = '';
    showMessage('error', "Couldn't load services: " + err.message);
  }
}

/* ---------- step 2: technicians ---------- */
async function loadTechnicians() {
  const box = $('tech-options');
  $('tech-manual').hidden = true;
  box.innerHTML = '<p class="muted">Loading technicians…</p>';
  try {
    const rows = await apiGet(`/api/technicians?service_id=${encodeURIComponent(state.service.service_id)}`); // api.js
    technicianListAvailable = true;
    if (!rows.length) {
      box.innerHTML = '<p class="muted">No technicians are available for this service yet.</p>';
      return;
    }
    box.innerHTML = rows.map((t) => `
      <button type="button" class="option-item" data-id="${t.user_id}" data-name="${escapeHtml(t.name)}" aria-pressed="false">
        <span class="option-title">${escapeHtml(t.name)}</span>
        <span class="option-meta">${escapeHtml(t.service_area || '')}</span>
        <span class="option-price">${t.rating ? Number(t.rating).toFixed(1) + ' ★' : 'New'}</span>
      </button>`).join('');
    bindOptions(box, (item) => {
      state.technicianId = Number(item.dataset.id);
      state.technicianName = item.dataset.name;
    });
  } catch (err) {
    // /api/technicians isn't built yet: let the customer enter a technician ID instead.
    technicianListAvailable = false;
    box.innerHTML = '';
    $('tech-manual').hidden = false;
  }
}

/* ---------- step 5: review ---------- */
function renderReview() {
  const rows = [
    ['Service', state.service.name],
    ['Technician', state.technicianName || 'ID ' + state.technicianId],
    ['Date and time', formatDate(state.date) + ', ' + state.time],
    ['Location', state.location],
    ['Estimated cost', '₹' + state.cost],
  ];
  $('review-summary').innerHTML = rows.map(([label, value]) => `
    <div class="summary-row">
      <span class="summary-label">${escapeHtml(label)}</span>
      <span class="summary-value">${escapeHtml(value)}</span>
    </div>`).join('');
}

/* ---------- validation ---------- */
function validateStep() {
  clearMessage();
  if (step === 1 && !state.service) {
    showMessage('error', 'Choose a service to continue.');
    return false;
  }
  if (step === 2) {
    if (!technicianListAvailable) {
      const id = Number($('tech-id-input').value);
      if (!id) { showMessage('error', 'Enter a technician ID to continue.'); return false; }
      state.technicianId = id;
      state.technicianName = '';
    }
    if (!state.technicianId) {
      showMessage('error', 'Choose a technician to continue.');
      return false;
    }
  }
  if (step === 3) {
    state.date = $('booking-date').value;
    state.time = $('booking-time').value;
    if (!state.date || !state.time) {
      showMessage('error', 'Pick a date and a time.');
      return false;
    }
    if (new Date(state.date + 'T' + state.time) < new Date()) {
      showMessage('error', 'Pick a date and time in the future.');
      return false;
    }
  }
  if (step === 4) {
    state.location = $('booking-location').value.trim();
    state.cost = $('booking-cost').value;
    if (!state.location) { showMessage('error', 'Enter the service location.'); return false; }
    if (state.cost === '' || Number(state.cost) < 0) { showMessage('error', 'Enter the estimated cost.'); return false; }
  }
  return true;
}

/* ---------- submit ---------- */
async function submitBooking() {
  if (!CUSTOMER_ID) {
    showMessage('error', 'Log in as a customer to send a request.');
    return;
  }
  const button = $('btn-next');
  button.disabled = true;
  button.textContent = 'Sending…';
  try {
    const data = await apiPost('/api/bookings', { // api.js
      customer_id: CUSTOMER_ID,
      technician_id: state.technicianId,
      service_id: Number(state.service.service_id),
      location: state.location,
      booking_date: state.date,
      booking_time: state.time,
      service_cost: Number(state.cost),
    });
    state.bookingId = data.booking_id;
    showDone();
  } catch (err) {
    showMessage('error', err.message || "Couldn't send the request. Try again.");
    button.disabled = false;
    button.textContent = 'Send request';
  }
}

/* ---------- done + status tracker ---------- */
function renderTrack(status) {
  const track = $('status-track');
  if (status === 'Cancelled') {
    track.innerHTML = '<li class="status-step is-cancelled">Cancelled</li>';
    return;
  }
  const current = STATUS_FLOW.indexOf(status);
  track.innerHTML = STATUS_FLOW.map((name, i) => {
    const cls = i < current ? 'is-done' : i === current ? 'is-current' : '';
    return `<li class="status-step ${cls}">${name}</li>`;
  }).join('');
}

async function refreshStatus() {
  try {
    const booking = await apiGet(`/api/bookings/${state.bookingId}`); // api.js
    renderTrack(booking.status);
    $('btn-cancel').hidden = !['Pending', 'Assigned', 'Accepted', 'Scheduled'].includes(booking.status);
  } catch (err) {
    showMessage('error', "Couldn't refresh the status: " + err.message);
  }
}

function showDone() {
  clearMessage();
  document.querySelectorAll('.flow-step').forEach((el) => { el.hidden = true; });
  $('flow-actions').hidden = true;
  $('stepper').hidden = true;
  $('step-done').hidden = false;
  $('done-text').textContent = `Booking #${state.bookingId} for ${state.service.name} was sent to the technician.`;
  refreshStatus();
}

async function cancelBooking() {
  if (!confirm('Cancel this booking?')) return;
  try {
    await apiPost(`/api/bookings/${state.bookingId}/cancel`, {}); // api.js
    showMessage('success', 'Booking cancelled.');
    refreshStatus();
  } catch (err) {
    showMessage('error', "Couldn't cancel the booking: " + err.message);
  }
}

/* ---------- wiring ---------- */
$('btn-next').addEventListener('click', () => {
  if (!validateStep()) return;
  if (step === TOTAL_STEPS) { submitBooking(); return; }
  step += 1;
  if (step === 2) loadTechnicians();
  if (step === 4) {
    if (!$('booking-cost').value) $('booking-cost').value = firstNumber(state.service.price_range);
    $('cost-hint').textContent = state.service.price_range ? 'Listed price: ' + state.service.price_range : '';
  }
  if (step === 5) renderReview();
  render();
});

$('btn-back').addEventListener('click', () => {
  if (step === 1) return;
  clearMessage();
  step -= 1;
  render();
});

$('btn-refresh').addEventListener('click', refreshStatus);
$('btn-cancel').addEventListener('click', cancelBooking);

$('booking-date').min = new Date().toISOString().split('T')[0];
render();
loadServices();
