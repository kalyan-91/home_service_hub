from flask import Blueprint, jsonify, session
from database.connection import run_query

payments_bp = Blueprint("payments", __name__, url_prefix="/api/payments")


def _clean(row):
    """AVG/DECIMAL columns come back as Decimal; convert so JSON is plain numbers."""
    if row.get("amount") is not None:
        row["amount"] = float(row["amount"])
    return row


# GET /api/payments/customer/<customer_id>
# Used by static/js/payments/summary.js
@payments_bp.route("/customer/<int:customer_id>", methods=["GET"])
def payments_for_customer(customer_id):
    # A customer may only read their own payments (admins may read anyone's).
    if "user_id" not in session:
        return jsonify({"error": "Login required"}), 401
    if session["user_id"] != customer_id and session.get("role") != "admin":
        return jsonify({"error": "Forbidden"}), 403

    rows = run_query(
        """SELECT payment_id, booking_id, customer_id, amount,
                  payment_method, payment_date, status
           FROM payments
           WHERE customer_id = %s
           ORDER BY payment_id DESC""",
        (customer_id,), fetch=True,
    ) or []

    return jsonify([_clean(r) for r in rows])
