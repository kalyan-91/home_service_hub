from datetime import date, timedelta
from flask import Blueprint, jsonify, request
from database.connection import run_query

maintenance_bp = Blueprint("maintenance", __name__, url_prefix="/api/maintenance")

# Simple rule-based reminder intervals, in days, by appliance category.
# Matches the ENUM values in appliances.category.
SERVICE_INTERVALS_DAYS = {
    "AC": 90,
    "RO Purifier": 180,
    "Geyser": 180,
    "Refrigerator": 365,
    "Washing Machine": 180,
    "Inverter": 365,
}
DEFAULT_INTERVAL_DAYS = 365


def create_reminder_after_service(booking_id):
    """Call this right after a booking is marked 'Completed' and a
    service_history row has been written for it. Looks up the appliance's
    category and schedules the next maintenance_reminders row."""
    row = run_query(
        """SELECT sh.appliance_id, sh.completed_date, a.category, b.customer_id
           FROM service_history sh
           JOIN bookings b ON b.booking_id = sh.booking_id
           LEFT JOIN appliances a ON a.appliance_id = sh.appliance_id
           WHERE sh.booking_id = %s
           ORDER BY sh.history_id DESC LIMIT 1""",
        (booking_id,), fetch_one=True
    )
    if not row or not row.get("appliance_id"):
        return None  # no appliance tied to this service, nothing to schedule

    interval = SERVICE_INTERVALS_DAYS.get(row["category"], DEFAULT_INTERVAL_DAYS)
    completed = row["completed_date"].date() if hasattr(row["completed_date"], "date") else date.today()
    due_date = completed + timedelta(days=interval)

    reminder_id = run_query(
        """INSERT INTO maintenance_reminders (appliance_id, customer_id, reminder_type, due_date, status)
           VALUES (%s, %s, %s, %s, 'Pending')""",
        (row["appliance_id"], row["customer_id"], f"{row['category']} service due", due_date),
        commit=True
    )
    return reminder_id


def send_due_reminders():
    """Run this periodically (e.g. a daily scheduled task) to notify
    customers whose reminders are due today or overdue, and mark them Sent."""
    due = run_query(
        "SELECT * FROM maintenance_reminders WHERE status='Pending' AND due_date <= %s",
        (date.today(),), fetch=True
    ) or []

    for reminder in due:
        run_query(
            """INSERT INTO notifications (user_id, message, type, status)
               VALUES (%s, %s, 'service_reminder', 'Unread')""",
            (reminder["customer_id"], f"Reminder: {reminder['reminder_type']} is due"), commit=True
        )
        run_query(
            "UPDATE maintenance_reminders SET status='Sent' WHERE reminder_id=%s",
            (reminder["reminder_id"],), commit=True
        )
    return len(due)


@maintenance_bp.route("/customer/<int:customer_id>", methods=["GET"])
def list_reminders(customer_id):
    rows = run_query(
        "SELECT * FROM maintenance_reminders WHERE customer_id=%s ORDER BY due_date ASC",
        (customer_id,), fetch=True
    )
    return jsonify(rows)


@maintenance_bp.route("/<int:reminder_id>/dismiss", methods=["POST"])
def dismiss_reminder(reminder_id):
    existing = run_query(
        "SELECT reminder_id FROM maintenance_reminders WHERE reminder_id=%s", (reminder_id,), fetch_one=True
    )
    if not existing:
        return jsonify({"error": "Reminder not found"}), 404

    run_query(
        "UPDATE maintenance_reminders SET status='Dismissed' WHERE reminder_id=%s",
        (reminder_id,), commit=True
    )
    return jsonify({"message": "Reminder dismissed", "reminder_id": reminder_id})


@maintenance_bp.route("/run-check", methods=["POST"])
def run_check():
    """Manual trigger for testing — in production this would run on a schedule."""
    count = send_due_reminders()
    return jsonify({"message": f"{count} reminder(s) sent"})
