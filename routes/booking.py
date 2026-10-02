from flask import Blueprint, jsonify, request
from database.connection import run_query

booking_bp = Blueprint("booking", __name__, url_prefix="/api/booking")

# Valid status flow: Pending -> Assigned -> Accepted -> Scheduled -> In Progress -> Completed
# Cancelled can happen from any state except Completed.
VALID_TRANSITIONS = {
    "Pending": ["Assigned", "Cancelled"],
    "Assigned": ["Accepted", "Cancelled"],
    "Accepted": ["Scheduled", "Cancelled"],
    "Scheduled": ["In Progress", "Cancelled"],
    "In Progress": ["Completed", "Cancelled"],
    "Completed": [],
    "Cancelled": []
}


def get_booking_or_none(booking_id):
    rows = run_query("SELECT * FROM bookings WHERE booking_id=%s", (booking_id,), fetch=True)
    return rows[0] if rows else None


@booking_bp.route("", methods=["POST"])
def create_booking():
    data = request.get_json(force=True)
    customer_id = data.get("customer_id")
    service_id = data.get("service_id")
    scheduled_date = data.get("scheduled_date")
    appliance_id = data.get("appliance_id")  # optional

    if not customer_id or not service_id or not scheduled_date:
        return jsonify({"error": "customer_id, service_id and scheduled_date are required"}), 400

    booking_id = run_query(
        """INSERT INTO bookings (customer_id, service_id, appliance_id, scheduled_date, status, created_at)
           VALUES (%s, %s, %s, %s, 'Pending', NOW())""",
        (customer_id, service_id, appliance_id, scheduled_date),
        commit=True
    )
    return jsonify({
        "message": "Booking created",
        "booking_id": booking_id,
        "status": "Pending"
    }), 201


@booking_bp.route("/<int:booking_id>", methods=["GET"])
def get_booking(booking_id):
    booking = get_booking_or_none(booking_id)
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    return jsonify(booking)


@booking_bp.route("/<int:booking_id>/status", methods=["GET"])
def get_booking_status(booking_id):
    booking = get_booking_or_none(booking_id)
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    return jsonify({"booking_id": booking_id, "status": booking["status"]})


@booking_bp.route("/customer/<int:customer_id>", methods=["GET"])
def get_customer_bookings(customer_id):
    rows = run_query(
        "SELECT * FROM bookings WHERE customer_id=%s ORDER BY created_at DESC",
        (customer_id,), fetch=True
    )
    return jsonify(rows)


@booking_bp.route("/technician/<int:technician_id>", methods=["GET"])
def get_technician_bookings(technician_id):
    rows = run_query(
        "SELECT * FROM bookings WHERE technician_id=%s ORDER BY created_at DESC",
        (technician_id,), fetch=True
    )
    return jsonify(rows)


def _transition(booking_id, next_status, extra_set_sql="", extra_params=()):
    booking = get_booking_or_none(booking_id)
    if not booking:
        return jsonify({"error": "Booking not found"}), 404

    current_status = booking["status"]
    allowed = VALID_TRANSITIONS.get(current_status, [])
    if next_status not in allowed:
        return jsonify({
            "error": f"Cannot move booking from '{current_status}' to '{next_status}'",
            "allowed_next_statuses": allowed
        }), 400

    params = (next_status,) + extra_params + (booking_id,)
    run_query(
        f"UPDATE bookings SET status=%s, updated_at=NOW() {extra_set_sql} WHERE booking_id=%s",
        params,
        commit=True
    )

    return jsonify({"message": f"Booking moved to {next_status}", "booking_id": booking_id, "status": next_status})


@booking_bp.route("/<int:booking_id>/assign", methods=["POST"])
def assign_technician(booking_id):
    data = request.get_json(force=True)
    technician_id = data.get("technician_id")
    if not technician_id:
        return jsonify({"error": "technician_id is required"}), 400
    return _transition(booking_id, "Assigned", ", technician_id=%s", (technician_id,))


@booking_bp.route("/<int:booking_id>/accept", methods=["POST"])
def accept_booking(booking_id):
    return _transition(booking_id, "Accepted")


@booking_bp.route("/<int:booking_id>/schedule", methods=["POST"])
def schedule_booking(booking_id):
    data = request.get_json(silent=True) or {}
    new_date = data.get("scheduled_date")
    if new_date:
        return _transition(booking_id, "Scheduled", ", scheduled_date=%s", (new_date,))
    return _transition(booking_id, "Scheduled")


@booking_bp.route("/<int:booking_id>/start", methods=["POST"])
def start_booking(booking_id):
    return _transition(booking_id, "In Progress")


@booking_bp.route("/<int:booking_id>/complete", methods=["POST"])
def complete_booking(booking_id):
    return _transition(booking_id, "Completed")


@booking_bp.route("/<int:booking_id>/cancel", methods=["POST"])
def cancel_booking(booking_id):
    return _transition(booking_id, "Cancelled")
