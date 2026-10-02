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


@admin_bp.route("/customers/<int:customer_id>/stats", methods=["GET"])
def customer_stats(customer_id):
    return jsonify(statistics.customer_statistics(customer_id))


@admin_bp.route("/technicians", methods=["GET"])
def list_technicians():
    rows = run_query("SELECT user_id, name, email, created_at FROM users WHERE role='technician'", fetch=True)
    return jsonify(rows)


@admin_bp.route("/technicians/<int:technician_id>/stats", methods=["GET"])
def technician_stats(technician_id):
    return jsonify(statistics.technician_statistics(technician_id))


@admin_bp.route("/technicians/<int:technician_id>/verify", methods=["POST"])
def verify_technician(technician_id):
    # Assumes Member 1's `technicians` table has a verification_status column
    run_query(
        "UPDATE technicians SET verification_status='Verified' WHERE technician_id=%s",
        (technician_id,), commit=True
    )
    return jsonify({"message": "Technician verified", "technician_id": technician_id})


@admin_bp.route("/services", methods=["GET"])
def list_services():
    rows = run_query("SELECT * FROM services ORDER BY name", fetch=True)
    return jsonify(rows)


@admin_bp.route("/services/<int:service_id>/deactivate", methods=["POST"])
def deactivate_service(service_id):
    # Assumes Member 1's `services` table has an is_active column
    run_query(
        "UPDATE services SET is_active=0 WHERE service_id=%s",
        (service_id,), commit=True
    )
    return jsonify({"message": "Service deactivated", "service_id": service_id})


@admin_bp.route("/services/<int:service_id>/activate", methods=["POST"])
def activate_service(service_id):
    run_query(
        "UPDATE services SET is_active=1 WHERE service_id=%s",
        (service_id,), commit=True
    )
    return jsonify({"message": "Service activated", "service_id": service_id})


@admin_bp.route("/bookings", methods=["GET"])
def list_bookings():
    status = request.args.get("status")
    if status:
        rows = run_query("SELECT * FROM bookings WHERE status=%s ORDER BY created_at DESC", (status,), fetch=True)
    else:
        rows = run_query("SELECT * FROM bookings ORDER BY created_at DESC", fetch=True)
    return jsonify(rows)


@admin_bp.route("/bookings/<int:booking_id>/cancel", methods=["POST"])
def admin_cancel_booking(booking_id):
    run_query(
        "UPDATE bookings SET status='Cancelled', updated_at=NOW() WHERE booking_id=%s",
        (booking_id,), commit=True
    )
    return jsonify({"message": "Booking cancelled by admin", "booking_id": booking_id})


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


@admin_bp.route("/payments", methods=["GET"])
def list_payments():
    rows = run_query("SELECT * FROM payments ORDER BY payment_date DESC", fetch=True)
    return jsonify(rows)


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


# ---------------------------------------------------------------
# Advanced statistics — correlation, regression, hypothesis tests
# ---------------------------------------------------------------
 
@admin_bp.route("/statistics/cost-rating-correlation", methods=["GET"])
def cost_rating_correlation():
    return jsonify(statistics.cost_vs_rating_correlation())
 
 
@admin_bp.route("/statistics/revenue-trend", methods=["GET"])
def revenue_trend():
    return jsonify(statistics.revenue_trend_regression())
 
 
@admin_bp.route("/statistics/compare-technicians", methods=["GET"])
def compare_technicians():
    tech_a = request.args.get("technician_a", type=int)
    tech_b = request.args.get("technician_b", type=int)
    if not tech_a or not tech_b:
        return jsonify({"error": "technician_a and technician_b query params are required"}), 400
    return jsonify(statistics.compare_technician_ratings(tech_a, tech_b))
 
 
@admin_bp.route("/statistics/category-cost-anova", methods=["GET"])
def category_cost_anova():
    return jsonify(statistics.service_category_anova())
 
