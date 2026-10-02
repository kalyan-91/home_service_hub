from flask import Blueprint, jsonify, request
from database.connection import run_query

reviews_bp = Blueprint("reviews", __name__, url_prefix="/api/reviews")


@reviews_bp.route("", methods=["POST"])
def submit_review():
    """Customer submits a rating (+ optional text) after a booking is completed."""
    data = request.get_json(force=True)
    booking_id = data.get("booking_id")
    customer_id = data.get("customer_id")
    technician_id = data.get("technician_id")
    rating = data.get("rating")
    review_text = data.get("review_text", "")

    if not booking_id or not customer_id or not technician_id or rating is None:
        return jsonify({"error": "booking_id, customer_id, technician_id and rating are required"}), 400

    try:
        rating = int(rating)
        if rating < 1 or rating > 5:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "rating must be an integer between 1 and 5"}), 400

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

    run_query(
        """INSERT INTO notifications (user_id, message, type, status)
           VALUES (%s, %s, 'customer_review', 'Unread')""",
        (technician_id, f"You received a new {rating}-star review"), commit=True
    )

    return jsonify({"message": "Review submitted", "review_id": review_id}), 201


@reviews_bp.route("/customer/<int:customer_id>", methods=["GET"])
def reviews_by_customer(customer_id):
    """Reviews a customer has written."""
    rows = run_query(
        "SELECT * FROM reviews WHERE customer_id=%s ORDER BY review_date DESC",
        (customer_id,), fetch=True
    )
    return jsonify(rows)


@reviews_bp.route("/technician/<int:technician_id>", methods=["GET"])
def reviews_for_technician(technician_id):
    """Feedback a technician has received, plus their average rating."""
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
    existing = run_query("SELECT review_id FROM reviews WHERE review_id=%s", (review_id,), fetch_one=True)
    if not existing:
        return jsonify({"error": "Review not found"}), 404

    run_query("DELETE FROM reviews WHERE review_id=%s", (review_id,), commit=True)
    return jsonify({"message": "Review removed", "review_id": review_id})
