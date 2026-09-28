/*
 * static/js/payments.js — logic for templates/payments/summary.html
 *
 * Backend (routes/payments.py):
 *   GET /api/payments/customer/<customer_id>
 *     -> [{ payment_id, booking_id, customer_id, amount, payment_method, payment_date, status }]
 *     Needs a logged-in customer; a customer can only read their own payments.
 *
 * The customer ID comes from the Flask session (current_user_id in app.py).
 * The totals at the top are worked out here from that list, since the backend
 * only returns the payments.
 *
 * Uses the shared helper from static/js/api.js: apiGet(url).
 * ASSUMPTION: it returns parsed JSON and throws an Error with a readable message
 * when the request fails.
 */

const root = document.getElementById('payments-root');
const CUSTOMER_ID = Number(root.dataset.customerId) || null;

let payments = [];
let activeStatus = '';

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function money(value) {
  return '₹' + Number(value || 0).toLocaleString('en-IN');
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d) ? String(value) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function showMessage(type, text) {
  const box = $('payments-message');
  box.className = 'alert alert-' + type; // alert-error | alert-success
  box.textContent = text;
  box.hidden = false;
}

/* ---------- totals ---------- */
function sumByStatus(status) {
  return payments
    .filter((p) => p.status === status)
    .reduce((total, p) => total + Number(p.amount || 0), 0);
}

function renderSummary() {
  $('sum-paid').textContent = money(sumByStatus('Successful'));
  $('sum-pending').textContent = money(sumByStatus('Pending'));
  $('sum-refunded').textContent = money(sumByStatus('Refunded'));
  $('sum-count').textContent = payments.length;
  $('payment-summary').hidden = false;
  $('status-filters').hidden = false;
}

/* ---------- history table ---------- */
function renderTable() {
  const box = $('payments-table');

  if (!payments.length) {
    box.innerHTML = '<p class="muted">No payments yet. A payment appears here once a service is completed. <a href="/services">Browse services</a></p>';
    return;
  }

  const visible = activeStatus ? payments.filter((p) => p.status === activeStatus) : payments;
  if (!visible.length) {
    box.innerHTML = `<p class="muted">No ${escapeHtml(activeStatus.toLowerCase())} payments.</p>`;
    return;
  }

  box.innerHTML = `
    <table class="table">
      <thead>
        <tr><th>Payment</th><th>Booking</th><th>Amount</th><th>Method</th><th>Date</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${visible.map((p) => `
          <tr>
            <td>#${escapeHtml(p.payment_id)}</td>
            <td>#${escapeHtml(p.booking_id)}</td>
            <td>${money(p.amount)}</td>
            <td>${escapeHtml(p.payment_method || '—')}</td>
            <td>${formatDate(p.payment_date)}</td>
            <td><span class="badge badge-${escapeHtml(String(p.status).toLowerCase())}">${escapeHtml(p.status)}</span></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

$('status-filters').addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#status-filters .chip').forEach((c) => c.classList.remove('is-active'));
  chip.classList.add('is-active');
  activeStatus = chip.dataset.status;
  renderTable();
});

/* ---------- start ---------- */
(async function init() {
  if (!CUSTOMER_ID) {
    $('payments-table').innerHTML = '';
    showMessage('error', 'Log in as a customer to see your payments.');
    return;
  }
  try {
    payments = await apiGet(`/api/payments/customer/${CUSTOMER_ID}`); // api.js
    renderSummary();
    renderTable();
  } catch (err) {
    $('payments-table').innerHTML = '';
    showMessage('error', "Couldn't load your payments: " + err.message);
  }
})();
