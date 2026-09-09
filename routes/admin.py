from flask import Blueprint, jsonify, request
from database.connection import run_query
from services import statistics

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@admin_bp.route("/dashboard", methods=["GET"])
def dashboard():
    return jsonify(statistics.admin_statistics())


@admin_bp.route("/customers", methods=["GET"])
def list_customers():
    rows = run_query("SELECT user_id, name, email, created_at FROM users WHERE role='customer'", fetch=True)
    return jsonify(rows)


@admin_bp.route("/technicians", methods=["GET"])
def list_technicians():
    rows = run_query("SELECT user_id, name, email, created_at FROM users WHERE role='technician'", fetch=True)
    return jsonify(rows)


@admin_bp.route("/technicians/<int:technician_id>/verify", methods=["POST"])
def verify_technician(technician_id):
    # Assumes Member 1's `technicians` table has a verification_status column
    run_query(
        "UPDATE technicians SET verification_status='Verified' WHERE technician_id=%s",
        (technician_id,), commit=True
    )
    return jsonify({"message": "Technician verified", "technician_id": technician_id})


@admin_bp.route("/bookings", methods=["GET"])
def list_bookings():
    status = request.args.get("status")
    if status:
        rows = run_query("SELECT * FROM bookings WHERE status=%s ORDER BY created_at DESC", (status,), fetch=True)
    else:
        rows = run_query("SELECT * FROM bookings ORDER BY created_at DESC", fetch=True)
    return jsonify(rows)


@admin_bp.route("/complaints", methods=["GET"])
def list_complaints():
    rows = run_query("SELECT * FROM complaints ORDER BY created_at DESC", fetch=True)
    return jsonify(rows)


@admin_bp.route("/complaints/<int:complaint_id>/resolve", methods=["POST"])
def resolve_complaint(complaint_id):
    run_query("UPDATE complaints SET status='Resolved' WHERE complaint_id=%s", (complaint_id,), commit=True)
    return jsonify({"message": "Complaint resolved", "complaint_id": complaint_id})


@admin_bp.route("/reviews", methods=["GET"])
def list_reviews():
    rows = run_query("SELECT * FROM reviews ORDER BY review_date DESC", fetch=True)
    return jsonify(rows)


@admin_bp.route("/reviews/<int:review_id>", methods=["DELETE"])
def remove_review(review_id):
    run_query("DELETE FROM reviews WHERE review_id=%s", (review_id,), commit=True)
    return jsonify({"message": "Review removed", "review_id": review_id})


@admin_bp.route("/notifications", methods=["POST"])
def send_notification():
    data = request.get_json(force=True)
    user_id = data.get("user_id")
    message = data.get("message")
    notif_type = data.get("type", "system")

    if not user_id or not message:
        return jsonify({"error": "user_id and message are required"}), 400

    notification_id = run_query(
        """INSERT INTO notifications (user_id, message, type, status)
           VALUES (%s, %s, %s, 'Unread')""",
        (user_id, message, notif_type), commit=True
    )
    return jsonify({"message": "Notification sent", "notification_id": notification_id}), 201
