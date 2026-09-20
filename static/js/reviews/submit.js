/*
 * NOTE FOR THE TEAM: there is no endpoint to CREATE a review yet.
 * routes/admin.py only has GET /api/reviews and DELETE /api/reviews/<id>.
 * Ask Member 3 to add:
 *   POST /api/reviews
 *     body: { booking_id, customer_id, technician_id, rating, review_text }
 *     -> INSERT INTO reviews (...) VALUES (...)
 * This file expects that route at POST /api/reviews below.
 * Also expects the page to be served at /bookings/<id>/review so this
 * script can read the booking_id from the URL — Flask should inject the
 * booking's technician_id too, e.g.:
 *   <script>window.BOOKING_ID = {{ booking_id }}; window.TECHNICIAN_ID = {{ technician_id }};</script>
 */

let selectedRating = 0;

function getBookingId() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return window.BOOKING_ID || parts[parts.indexOf('bookings') + 1];
}

const starEls = document.querySelectorAll('#star-input .star');
starEls.forEach(star => {
  star.addEventListener('click', () => {
    selectedRating = Number(star.dataset.val);
    starEls.forEach(s => s.classList.toggle('filled', Number(s.dataset.val) <= selectedRating));
  });
});

document.getElementById('submit-review').addEventListener('click', async () => {
  const note = document.getElementById('review-note');
  const btn = document.getElementById('submit-review');
  if (!selectedRating) {
    note.textContent = 'Please select a star rating.';
    note.className = 'form-note err';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Submitting…';
  note.className = 'form-note';
  note.textContent = '';
  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        booking_id: Number(getBookingId()),
        customer_id: window.CURRENT_USER_ID,
        technician_id: window.TECHNICIAN_ID,
        rating: selectedRating,
        review_text: document.getElementById('review-text').value.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not submit review');
    note.textContent = 'Thanks for your feedback!';
    note.className = 'form-note ok';
    setTimeout(() => { window.location.href = '/bookings'; }, 1200);
  } catch (e) {
    note.textContent = e.message;
    note.className = 'form-note err';
    btn.disabled = false;
    btn.textContent = 'Submit review';
  }
});
