from flask import Blueprint, jsonify, request
from database.connection import run_query

booking_bp = Blueprint("booking", __name__, url_prefix="/api/booking")

# Matches the `status` enum on the real bookings table.
# NOTE: confirm this exact list matches your enum — run:
#   SHOW COLUMNS FROM bookings LIKE 'status';
# and check the full enum(...) values if any insert/update fails.
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
    return run_query("SELECT * FROM bookings WHERE booking_id=%s", (booking_id,), fetch_one=True)


@booking_bp.route("", methods=["POST"])
def create_booking():
    """Technician is chosen up front (from nearby-matching results) since
    bookings.technician_id is NOT NULL in the real schema."""
    data = request.get_json(force=True)
    customer_id = data.get("customer_id")
    technician_id = data.get("technician_id")
    service_id = data.get("service_id")
    booking_date = data.get("booking_date")
    booking_time = data.get("booking_time")       # optional
    location = data.get("location")                 # optional
    service_cost = data.get("service_cost")         # optional, can be set later
    request_id = data.get("request_id")              # optional, links to service_requests

    if not customer_id or not technician_id or not service_id or not booking_date:
        return jsonify({"error": "customer_id, technician_id, service_id and booking_date are required"}), 400

    booking_id = run_query(
        """INSERT INTO bookings
           (customer_id, technician_id, service_id, request_id, location,
            booking_date, booking_time, service_cost, status)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'Pending')""",
        (customer_id, technician_id, service_id, request_id, location,
         booking_date, booking_time, service_cost),
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
        "SELECT * FROM bookings WHERE customer_id=%s ORDER BY booking_date DESC",
        (customer_id,), fetch=True
    )
    return jsonify(rows)


@booking_bp.route("/technician/<int:technician_id>", methods=["GET"])
def get_technician_bookings(technician_id):
    rows = run_query(
        "SELECT * FROM bookings WHERE technician_id=%s ORDER BY booking_date DESC",
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
        f"UPDATE bookings SET status=%s {extra_set_sql} WHERE booking_id=%s",
        params,
        commit=True
    )

    return jsonify({"message": f"Booking moved to {next_status}", "booking_id": booking_id, "status": next_status})


@booking_bp.route("/<int:booking_id>/assign", methods=["POST"])
def mark_assigned(booking_id):
    """Technician already set at creation — this just confirms/notifies.
    Optionally pass technician_id to reassign to someone else."""
    data = request.get_json(silent=True) or {}
    new_technician_id = data.get("technician_id")
    if new_technician_id:
        return _transition(booking_id, "Assigned", ", technician_id=%s", (new_technician_id,))
    return _transition(booking_id, "Assigned")


@booking_bp.route("/<int:booking_id>/accept", methods=["POST"])
def accept_booking(booking_id):
    return _transition(booking_id, "Accepted")


@booking_bp.route("/<int:booking_id>/schedule", methods=["POST"])
def schedule_booking(booking_id):
    data = request.get_json(silent=True) or {}
    new_date = data.get("booking_date")
    new_time = data.get("booking_time")
    if new_date and new_time:
        return _transition(booking_id, "Scheduled", ", booking_date=%s, booking_time=%s", (new_date, new_time))
    if new_date:
        return _transition(booking_id, "Scheduled", ", booking_date=%s", (new_date,))
    return _transition(booking_id, "Scheduled")


@booking_bp.route("/<int:booking_id>/start", methods=["POST"])
def start_booking(booking_id):
    return _transition(booking_id, "In Progress")


@booking_bp.route("/<int:booking_id>/complete", methods=["POST"])
def complete_booking(booking_id):
    data = request.get_json(silent=True) or {}
    final_cost = data.get("service_cost")
    if final_cost is not None:
        return _transition(booking_id, "Completed", ", service_cost=%s", (final_cost,))
    return _transition(booking_id, "Completed")


@booking_bp.route("/<int:booking_id>/cancel", methods=["POST"])
def cancel_booking(booking_id):
    return _transition(booking_id, "Cancelled")
