from flask import Blueprint, jsonify, request, session
from database.connection import run_query

payments_bp = Blueprint("payments", __name__, url_prefix="/api/payments")

VALID_STATUSES = ["Pending", "Successful", "Failed", "Refunded"]

# Allowed payment status changes
PAYMENT_TRANSITIONS = {
    "Pending": ["Successful", "Failed"],
    "Failed": ["Pending", "Successful"],
    "Successful": ["Refunded"],
    "Refunded": [],
}


# ---------------------------------------------------------------
# Security: every payment route needs a logged-in user
# ---------------------------------------------------------------
@payments_bp.before_request
def require_login():
    if "user_id" not in session:
        return jsonify({"error": "Please log in first"}), 401


def _is_admin():
    return session.get("role") == "admin"


@payments_bp.route("", methods=["POST"])
def create_payment():
    data = request.get_json(force=True)
    booking_id = data.get("booking_id")
    customer_id = data.get("customer_id")
    amount = data.get("amount")
    payment_method = data.get("payment_method", "Cash")

    # A customer can only pay for themselves
    if session.get("role") == "customer":
        customer_id = session["user_id"]

    if not booking_id or not customer_id or amount is None:
        return jsonify({"error": "booking_id, customer_id and amount are required"}), 400

    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return jsonify({"error": "amount must be a number"}), 400
    if amount <= 0:
        return jsonify({"error": "amount must be greater than 0"}), 400

    booking = run_query(
        "SELECT booking_id, customer_id, status, service_cost FROM bookings WHERE booking_id=%s",
        (booking_id,), fetch_one=True
    )
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    if booking["customer_id"] != customer_id:
        return jsonify({"error": "This booking does not belong to that customer"}), 403
    if booking["status"] != "Completed":
        return jsonify({"error": "Payment is only allowed after the booking is Completed"}), 400
    if booking["service_cost"] is not None and abs(float(booking["service_cost"]) - amount) > 0.001:
        return jsonify({"error": f"Amount must match the booking cost ({float(booking['service_cost']):.2f})"}), 400

    existing = run_query(
        "SELECT payment_id, status FROM payments WHERE booking_id=%s ORDER BY payment_id DESC LIMIT 1",
        (booking_id,), fetch_one=True
    )
    if existing:
        if existing["status"] in ("Successful", "Refunded"):
            return jsonify({"error": f"This booking is already {existing['status']}"}), 400
        # Pending or Failed: reuse the same record for a new attempt
        run_query(
            """UPDATE payments SET amount=%s, payment_method=%s, status='Pending', payment_date=NOW()
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
    if not _is_admin() and session["user_id"] != payment["customer_id"]:
        return jsonify({"error": "Not allowed"}), 403
    return jsonify(payment)


@payments_bp.route("/customer/<int:customer_id>", methods=["GET"])
def get_customer_payments(customer_id):
    if not _is_admin() and session["user_id"] != customer_id:
        return jsonify({"error": "Not allowed"}), 403
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

    payment = run_query(
        "SELECT payment_id, customer_id, status FROM payments WHERE payment_id=%s",
        (payment_id,), fetch_one=True
    )
    if not payment:
        return jsonify({"error": "Payment not found"}), 404

    # Customers may only confirm or fail their own payment (simulated payment).
    # Everything else (e.g. Refunded) is admin only.
    if not _is_admin():
        if session["user_id"] != payment["customer_id"]:
            return jsonify({"error": "Not allowed"}), 403
        if new_status not in ("Successful", "Failed", "Pending"):
            return jsonify({"error": "Only an admin can do that"}), 403

    allowed = PAYMENT_TRANSITIONS.get(payment["status"], [])
    if new_status not in allowed:
        return jsonify({
            "error": f"Cannot change payment from '{payment['status']}' to '{new_status}'",
            "allowed_next_statuses": allowed
        }), 400

    run_query(
        "UPDATE payments SET status=%s WHERE payment_id=%s",
        (new_status, payment_id),
        commit=True
    )
    return jsonify({"message": "Payment status updated", "payment_id": payment_id, "status": new_status})
