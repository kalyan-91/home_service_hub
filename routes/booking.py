from flask import Blueprint, jsonify, request
from database.connection import run_query

booking_bp = Blueprint("booking", __name__, url_prefix="/api/bookings")

VALID_STATUSES = ["Pending", "Assigned", "Accepted", "Scheduled", "In Progress", "Completed", "Cancelled"]


@booking_bp.route("", methods=["POST"])
def create_booking():
    data = request.get_json(force=True)
    required = ["customer_id", "technician_id", "service_id", "location", "booking_date", "booking_time", "service_cost"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    booking_id = run_query(
        """INSERT INTO bookings (customer_id, technician_id, service_id, request_id,
                                  location, booking_date, booking_time, service_cost, status)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'Pending')""",
        (data["customer_id"], data["technician_id"], data["service_id"], data.get("request_id"),
         data["location"], data["booking_date"], data["booking_time"], data["service_cost"]),
        commit=True
    )

    run_query(
        """INSERT INTO notifications (user_id, message, type, status)
           VALUES (%s, %s, 'new_service_request', 'Unread')""",
        (data["technician_id"], f"New booking request #{booking_id}"), commit=True
    )
    return jsonify({"message": "Booking created", "booking_id": booking_id}), 201


@booking_bp.route("/<int:booking_id>", methods=["GET"])
def get_booking(booking_id):
    row = run_query("SELECT * FROM bookings WHERE booking_id=%s", (booking_id,), fetch_one=True)
    if not row:
        return jsonify({"error": "Booking not found"}), 404
    return jsonify(row)


@booking_bp.route("/customer/<int:customer_id>", methods=["GET"])
def bookings_for_customer(customer_id):
    rows = run_query("SELECT * FROM bookings WHERE customer_id=%s ORDER BY created_at DESC", (customer_id,), fetch=True)
    return jsonify(rows)


@booking_bp.route("/technician/<int:technician_id>", methods=["GET"])
def bookings_for_technician(technician_id):
    rows = run_query("SELECT * FROM bookings WHERE technician_id=%s ORDER BY created_at DESC", (technician_id,), fetch=True)
    return jsonify(rows)


@booking_bp.route("/<int:booking_id>/status", methods=["PATCH"])
def update_status(booking_id):
    data = request.get_json(force=True)
    new_status = data.get("status")
    if new_status not in VALID_STATUSES:
        return jsonify({"error": f"status must be one of {VALID_STATUSES}"}), 400

    run_query("UPDATE bookings SET status=%s WHERE booking_id=%s", (new_status, booking_id), commit=True)

    booking = run_query("SELECT customer_id FROM bookings WHERE booking_id=%s", (booking_id,), fetch_one=True)
    if booking:
        run_query(
            """INSERT INTO notifications (user_id, message, type, status)
               VALUES (%s, %s, 'booking_status_update', 'Unread')""",
            (booking["customer_id"], f"Booking #{booking_id} status changed to {new_status}"), commit=True
        )

    if new_status == "Completed":
        run_query(
            """INSERT INTO payments (booking_id, customer_id, amount, status)
               SELECT booking_id, customer_id, service_cost, 'Pending'
               FROM bookings WHERE booking_id=%s""",
            (booking_id,), commit=True
        )

    return jsonify({"message": "Status updated", "booking_id": booking_id, "status": new_status})


@booking_bp.route("/<int:booking_id>/cancel", methods=["POST"])
def cancel_booking(booking_id):
    run_query("UPDATE bookings SET status='Cancelled' WHERE booking_id=%s", (booking_id,), commit=True)
    return jsonify({"message": "Booking cancelled", "booking_id": booking_id})
