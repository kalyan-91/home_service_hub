from flask import Blueprint, jsonify, request
from database.connection import run_query

payments_bp = Blueprint("payments", __name__, url_prefix="/api/payments")

VALID_STATUSES = ["Pending", "Successful", "Failed", "Refunded"]


@payments_bp.route("", methods=["POST"])
def create_payment():
    data = request.get_json(force=True)
    booking_id = data.get("booking_id")
    customer_id = data.get("customer_id")
    amount = data.get("amount")
    payment_method = data.get("payment_method", "Cash")

    if not booking_id or not customer_id or amount is None:
        return jsonify({"error": "booking_id, customer_id and amount are required"}), 400

    # booking.py already auto-creates a payment row when a booking is marked
    # "Completed". If one already exists for this booking, update it instead
    # of inserting a second row.
    existing = run_query(
        "SELECT payment_id FROM payments WHERE booking_id=%s", (booking_id,), fetch_one=True
    )
    if existing:
        run_query(
            """UPDATE payments SET amount=%s, payment_method=%s, payment_date=NOW()
               WHERE payment_id=%s""",
            (amount, payment_method, existing["payment_id"]), commit=True
        )
        return jsonify({
            "message": "Existing payment record updated",
            "payment_id": existing["payment_id"],
            "amount": amount,
            "status": "Pending"
        })

    payment_id = run_query(
        """INSERT INTO payments (booking_id, customer_id, amount, payment_method, status, payment_date)
           VALUES (%s, %s, %s, %s, 'Pending', NOW())""",
        (booking_id, customer_id, amount, payment_method),
        commit=True
    )
    return jsonify({
        "message": "Payment record created",
        "payment_id": payment_id,
        "amount": amount,
        "status": "Pending"
    }), 201


@payments_bp.route("/<int:booking_id>", methods=["GET"])
def get_payment_by_booking(booking_id):
    payment = run_query(
        "SELECT * FROM payments WHERE booking_id=%s ORDER BY payment_date DESC LIMIT 1",
        (booking_id,), fetch_one=True
    )
    if not payment:
        return jsonify({"error": "No payment found for this booking"}), 404
    return jsonify(payment)


@payments_bp.route("/customer/<int:customer_id>", methods=["GET"])
def get_customer_payments(customer_id):
    rows = run_query(
        "SELECT * FROM payments WHERE customer_id=%s ORDER BY payment_date DESC",
        (customer_id,), fetch=True
    )
    return jsonify(rows)


@payments_bp.route("/<int:payment_id>/status", methods=["POST"])
def update_payment_status(payment_id):
    data = request.get_json(force=True)
    new_status = data.get("status")

    if new_status not in VALID_STATUSES:
        return jsonify({"error": f"status must be one of {VALID_STATUSES}"}), 400

    run_query(
        "UPDATE payments SET status=%s WHERE payment_id=%s",
        (new_status, payment_id),
        commit=True
    )
    return jsonify({"message": "Payment status updated", "payment_id": payment_id, "status": new_status})
