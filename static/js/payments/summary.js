/*
 * NOTE FOR THE TEAM: there is no payment-history endpoint yet, for
 * customers OR admin. Member 1's schema.sql has a `payments` table and
 * bookings/status.py auto-inserts a Pending payment row when a booking is
 * marked Completed — but nothing reads it back out.
 * Ask Member 3 to add:
 *   GET /api/payments/customer/<customer_id>
 *     -> SELECT * FROM payments WHERE customer_id = %s ORDER BY payment_date DESC
 * This file calls that route below.
 */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmtDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  return isNaN(d) ? String(val) : d.toLocaleDateString(undefined, {year:'numeric',month:'short',day:'numeric'});
}
function badgeClass(status) { return String(status || '').toLowerCase(); }

async function loadPayments() {
  const box = document.getElementById('payments-body');
  box.innerHTML = '<div class="load">Loading payments…</div>';
  try {
    const res = await fetch(`/api/payments/customer/${window.CURRENT_USER_ID}`);
    if (!res.ok) throw new Error('Request failed (' + res.status + ')');
    const rows = await res.json();
    if (!rows.length) {
      box.innerHTML = '<div class="empty">No payments yet.</div>';
      return;
    }
    const body = rows.map(p => `
      <tr>
        <td>#${escapeHtml(p.payment_id)}</td>
        <td>Booking #${escapeHtml(p.booking_id)}</td>
        <td>₹${escapeHtml(p.amount)}</td>
        <td>${escapeHtml(p.payment_method || '—')}</td>
        <td>${fmtDate(p.payment_date)}</td>
        <td><span class="badge ${badgeClass(p.status)}">${escapeHtml(p.status)}</span></td>
      </tr>`).join('');
    box.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>Booking</th><th>Amount</th><th>Method</th><th>Date</th><th>Status</th></tr></thead>
        <tbody>${body}</tbody>
      </table></div>`;
  } catch (e) {
    box.innerHTML = `<div class="err">Couldn't load payments — ${escapeHtml(e.message)}. This endpoint may not be built yet — check with Member 3.</div>`;
  }
}

loadPayments();
