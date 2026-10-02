from flask import Blueprint, jsonify, request
from database.connection import run_query

payments_bp = Blueprint("payments", __name__, url_prefix="/api/payments")


@payments_bp.route("", methods=["POST"])
def create_payment():
    data = request.get_json(force=True)
    booking_id = data.get("booking_id")
    service_cost = data.get("service_cost")
    additional_cost = data.get("additional_cost", 0)
    payment_method = data.get("payment_method", "Cash")

    if not booking_id or service_cost is None:
        return jsonify({"error": "booking_id and service_cost are required"}), 400

    total = float(service_cost) + float(additional_cost)

    payment_id = run_query(
        """INSERT INTO payments
           (booking_id, service_cost, additional_cost, total, payment_method, payment_status, payment_date)
           VALUES (%s, %s, %s, %s, %s, 'Pending', NOW())""",
        (booking_id, service_cost, additional_cost, total, payment_method),
        commit=True
    )
    return jsonify({
        "message": "Payment record created",
        "payment_id": payment_id,
        "total": total,
        "payment_status": "Pending"
    }), 201


@payments_bp.route("/<int:booking_id>", methods=["GET"])
def get_payment_by_booking(booking_id):
    rows = run_query(
        "SELECT * FROM payments WHERE booking_id=%s ORDER BY payment_date DESC LIMIT 1",
        (booking_id,), fetch=True
    )
    if not rows:
        return jsonify({"error": "No payment found for this booking"}), 404
    return jsonify(rows[0])


@payments_bp.route("/<int:payment_id>/status", methods=["POST"])
def update_payment_status(payment_id):
    data = request.get_json(force=True)
    new_status = data.get("payment_status")

    valid_statuses = ["Pending", "Paid", "Failed", "Refunded"]
    if new_status not in valid_statuses:
        return jsonify({"error": f"payment_status must be one of {valid_statuses}"}), 400

    run_query(
        "UPDATE payments SET payment_status=%s WHERE payment_id=%s",
        (new_status, payment_id),
        commit=True
    )
    return jsonify({"message": "Payment status updated", "payment_id": payment_id, "payment_status": new_status})
