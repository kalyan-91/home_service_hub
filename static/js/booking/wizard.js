/*
 * NOTE: customer_id must come from the logged-in session, not the browser.
 * Have Flask inject it into the page, e.g. in wizard.html's <head>:
 *   <script>window.CURRENT_USER_ID = {{ session['user_id'] }};</script>
 * This file reads it from window.CURRENT_USER_ID below.
 *
 * Step 1 (technician list) calls GET /api/technicians?service_id=X — same
 * endpoint gap noted in technicians/listing.js. Until it exists, Step 1
 * will show a friendly error instead of crashing.
 */

const params = new URLSearchParams(window.location.search);
const state = {
  service_id: params.get('service_id'),
  technician_id: null,
  technician_name: null,
  service_cost: null,
  date: null,
  time: null,
  location: null,
};
let currentStep = 1;
const TOTAL_STEPS = 4;
const STEP_LABELS = ['Choose a technician', 'Pick date & time', 'Confirm location', 'Review & confirm'];

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderStepper() {
  document.querySelectorAll('.stepper .step').forEach(el => {
    const n = Number(el.dataset.step);
    el.classList.toggle('done', n < currentStep);
    el.classList.toggle('active', n === currentStep);
  });
  document.getElementById('step-label').innerHTML =
    `Step ${currentStep} of ${TOTAL_STEPS} — <b>${STEP_LABELS[currentStep - 1]}</b>`;
  document.querySelectorAll('.wizard-step').forEach(el => el.style.display = 'none');
  document.getElementById('step-' + currentStep).style.display = 'block';
  document.getElementById('btn-back').style.visibility = currentStep === 1 ? 'hidden' : 'visible';
  document.getElementById('btn-next').textContent = currentStep === TOTAL_STEPS ? 'Confirm booking' : 'Next';
}

async function loadTechnicianOptions() {
  const box = document.getElementById('tech-options');
  try {
    const res = await fetch(`/api/technicians?service_id=${encodeURIComponent(state.service_id)}`);
    if (!res.ok) throw new Error('Request failed (' + res.status + ')');
    const rows = await res.json();
    if (!rows.length) {
      box.innerHTML = '<div class="empty">No technicians available for this service yet.</div>';
      return;
    }
    box.innerHTML = rows.map(t => `
      <div class="option-row" data-id="${t.user_id}" data-name="${escapeHtml(t.name)}">
        <span>${escapeHtml(t.name)} — ${escapeHtml(t.service_area || '')}</span>
        <span>${t.rating ? Number(t.rating).toFixed(1) + ' ★' : 'New'}</span>
      </div>`).join('');
    box.querySelectorAll('.option-row').forEach(row => {
      row.addEventListener('click', () => {
        box.querySelectorAll('.option-row').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        state.technician_id = row.dataset.id;
        state.technician_name = row.dataset.name;
      });
    });
  } catch (e) {
    box.innerHTML = `<div class="err">Couldn't load technicians — ${escapeHtml(e.message)}. This endpoint may not be built yet — check with Member 1/3.</div>`;
  }
}

function renderReview() {
  document.getElementById('review-summary').innerHTML = `
    <div class="field"><label>Technician</label><div>${escapeHtml(state.technician_name || '—')}</div></div>
    <div class="field"><label>Date & time</label><div>${escapeHtml(state.date || '—')} at ${escapeHtml(state.time || '—')}</div></div>
    <div class="field"><label>Location</label><div>${escapeHtml(state.location || '—')}</div></div>
  `;
}

function validateStep() {
  if (currentStep === 1 && !state.technician_id) { alert('Please select a technician.'); return false; }
  if (currentStep === 2) {
    state.date = document.getElementById('booking-date').value;
    state.time = document.getElementById('booking-time').value;
    if (!state.date || !state.time) { alert('Please pick a date and time.'); return false; }
  }
  if (currentStep === 3) {
    state.location = document.getElementById('booking-location').value.trim();
    if (!state.location) { alert('Please enter the service location.'); return false; }
  }
  return true;
}

async function submitBooking() {
  const note = document.getElementById('wizard-note');
  const btn = document.getElementById('btn-next');
  btn.disabled = true;
  btn.textContent = 'Booking…';
  note.className = 'form-note';
  note.textContent = '';
  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        customer_id: window.CURRENT_USER_ID,
        technician_id: Number(state.technician_id),
        service_id: Number(state.service_id),
        location: state.location,
        booking_date: state.date,
        booking_time: state.time,
        service_cost: state.service_cost || 0,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Booking failed');
    note.textContent = 'Booking confirmed! Redirecting to your bookings…';
    note.className = 'form-note ok';
    setTimeout(() => { window.location.href = `/bookings/${data.booking_id}`; }, 1200);
  } catch (e) {
    note.textContent = e.message;
    note.className = 'form-note err';
    btn.disabled = false;
    btn.textContent = 'Confirm booking';
  }
}

document.getElementById('btn-next').addEventListener('click', () => {
  if (!validateStep()) return;
  if (currentStep === TOTAL_STEPS) { submitBooking(); return; }
  currentStep++;
  if (currentStep === TOTAL_STEPS) renderReview();
  renderStepper();
});

document.getElementById('btn-back').addEventListener('click', () => {
  if (currentStep === 1) return;
  currentStep--;
  renderStepper();
});

if (!state.service_id) {
  document.getElementById('tech-options').innerHTML =
    '<div class="err">No service selected. Go back to the service catalog and pick a service first.</div>';
} else {
  loadTechnicianOptions();
}
renderStepper();
