from flask import Blueprint, jsonify, request, session
from database.connection import run_query

reviews_bp = Blueprint("reviews", __name__, url_prefix="/api/reviews")

MAX_REVIEW_LENGTH = 1000


def _is_admin():
    return session.get("role") == "admin"


def _login_error():
    """Returns an error response if nobody is logged in, otherwise None."""
    if "user_id" not in session:
        return jsonify({"error": "Please log in first"}), 401
    return None


@reviews_bp.route("", methods=["POST"])
def submit_review():
    """Customer submits a rating (+ optional text) after a booking is completed."""
    err = _login_error()
    if err:
        return err
    if session.get("role") not in ("customer", "admin"):
        return jsonify({"error": "Only customers can submit reviews"}), 403

    data = request.get_json(force=True)
    booking_id = data.get("booking_id")
    customer_id = data.get("customer_id")
    technician_id = data.get("technician_id")
    rating = data.get("rating")
    review_text = (data.get("review_text") or "").strip()

    # A customer can only review as themselves
    if session.get("role") == "customer":
        customer_id = session["user_id"]

    if not booking_id or not customer_id or not technician_id or rating is None:
        return jsonify({"error": "booking_id, customer_id, technician_id and rating are required"}), 400

    # Rating must be a whole number from 1 to 5 (4.7 or true are rejected)
    try:
        if isinstance(rating, bool):
            raise ValueError
        as_float = float(rating)
        if as_float != int(as_float):
            raise ValueError
        rating = int(as_float)
        if rating < 1 or rating > 5:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "rating must be an integer between 1 and 5"}), 400

    if len(review_text) > MAX_REVIEW_LENGTH:
        return jsonify({"error": f"review_text must be at most {MAX_REVIEW_LENGTH} characters"}), 400

    # Confirm the booking exists, belongs to this customer/technician, and is completed
    booking = run_query(
        """SELECT booking_id, status FROM bookings
           WHERE booking_id=%s AND customer_id=%s AND technician_id=%s""",
        (booking_id, customer_id, technician_id), fetch_one=True
    )
    if not booking:
        return jsonify({"error": "Booking not found for this customer/technician"}), 404
    if booking["status"] != "Completed":
        return jsonify({"error": "Can only review a completed booking"}), 400

    # One review per booking
    existing = run_query(
        "SELECT review_id FROM reviews WHERE booking_id=%s", (booking_id,), fetch_one=True
    )
    if existing:
        return jsonify({"error": "This booking has already been reviewed"}), 409

    review_id = run_query(
        """INSERT INTO reviews (booking_id, customer_id, technician_id, rating, review_text)
           VALUES (%s, %s, %s, %s, %s)""",
        (booking_id, customer_id, technician_id, rating, review_text),
        commit=True
    )

    # The notification is a nice-to-have: never fail the review because of it
    try:
        run_query(
            """INSERT INTO notifications (user_id, message, type, status)
               VALUES (%s, %s, 'customer_review', 'Unread')""",
            (technician_id, f"You received a new {rating}-star review"), commit=True
        )
    except Exception:
        pass

    return jsonify({"message": "Review submitted", "review_id": review_id}), 201


@reviews_bp.route("/customer/<int:customer_id>", methods=["GET"])
def reviews_by_customer(customer_id):
    """Reviews a customer has written (that customer or an admin only)."""
    err = _login_error()
    if err:
        return err
    if not _is_admin() and session["user_id"] != customer_id:
        return jsonify({"error": "Not allowed"}), 403

    rows = run_query(
        "SELECT * FROM reviews WHERE customer_id=%s ORDER BY review_date DESC",
        (customer_id,), fetch=True
    )
    return jsonify(rows)


@reviews_bp.route("/technician/<int:technician_id>", methods=["GET"])
def reviews_for_technician(technician_id):
    """Feedback a technician has received, plus their average rating.
    Public on purpose, so customers can see ratings before booking."""
    rows = run_query(
        "SELECT * FROM reviews WHERE technician_id=%s ORDER BY review_date DESC",
        (technician_id,), fetch=True
    ) or []

    avg = run_query(
        "SELECT AVG(rating) AS avg_rating, COUNT(*) AS review_count FROM reviews WHERE technician_id=%s",
        (technician_id,), fetch_one=True
    )
    avg_rating = round(float(avg["avg_rating"]), 1) if avg and avg["avg_rating"] is not None else None

    return jsonify({
        "technician_id": technician_id,
        "average_rating": avg_rating,
        "review_count": avg["review_count"] if avg else 0,
        "reviews": rows
    })


@reviews_bp.route("/<int:review_id>", methods=["DELETE"])
def delete_review(review_id):
    """Admin removes an inappropriate review."""
    err = _login_error()
    if err:
        return err
    if not _is_admin():
        return jsonify({"error": "Admin access required"}), 403

    existing = run_query("SELECT review_id FROM reviews WHERE review_id=%s", (review_id,), fetch_one=True)
    if not existing:
        return jsonify({"error": "Review not found"}), 404

    run_query("DELETE FROM reviews WHERE review_id=%s", (review_id,), commit=True)
    return jsonify({"message": "Review removed", "review_id": review_id})
