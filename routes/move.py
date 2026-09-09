from flask import Blueprint, jsonify, request
from database.connection import run_query
from services.technician_matching import find_nearby_technicians

move_bp = Blueprint("move", __name__, url_prefix="/api/move")

# Simple starting price map per install/removal type — adjust to match
# Member 1's actual `services` table pricing once it exists.
DEFAULT_SERVICE_PRICES = {
    "fan_installation": 200,
    "light_installation": 100,
    "ac_installation": 1500,
    "washing_machine_installation": 500,
    "ro_installation": 400,
}


@move_bp.route("/required-services", methods=["POST"])
def required_services():
    """Given a list of appliances being moved, return the required
    removal/installation service for each one."""
    data = request.get_json(force=True)
    appliances = data.get("appliances", [])  # [{appliance_id, category}, ...]

    required = []
    for appliance in appliances:
        category = appliance.get("category", "").lower()
        service_key = f"{category}_installation"
        required.append({
            "appliance_id": appliance.get("appliance_id"),
            "category": category,
            "required_service": service_key,
            "estimated_price": DEFAULT_SERVICE_PRICES.get(service_key, 300),
        })
    return jsonify(required)


@move_bp.route("/nearby-technicians", methods=["POST"])
def nearby_technicians_for_move():
    data = request.get_json(force=True)
    service_id = data.get("service_id")
    lat = data.get("latitude")
    lon = data.get("longitude")

    if service_id is None or lat is None or lon is None:
        return jsonify({"error": "service_id, latitude, and longitude are required"}), 400

    technicians = find_nearby_technicians(service_id, lat, lon)
    return jsonify(technicians)


@move_bp.route("/cost-estimate", methods=["POST"])
def cost_estimate():
    data = request.get_json(force=True)
    appliances = data.get("appliances", [])

    total = 0
    breakdown = []
    for appliance in appliances:
        category = appliance.get("category", "").lower()
        qty = appliance.get("quantity", 1)
        service_key = f"{category}_installation"
        price = DEFAULT_SERVICE_PRICES.get(service_key, 300)
        line_total = price * qty
        total += line_total
        breakdown.append({"category": category, "quantity": qty, "unit_price": price, "line_total": line_total})

    return jsonify({"breakdown": breakdown, "estimated_total": total})


@move_bp.route("/requests", methods=["POST"])
def create_move_request():
    data = request.get_json(force=True)
    required = ["customer_id", "old_home_id", "new_home_id"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    # move_requests / move_appliances are owned jointly with Member 1;
    # this assumes those tables already exist.
    move_id = run_query(
        """INSERT INTO move_requests (customer_id, old_home_id, new_home_id, status)
           VALUES (%s, %s, %s, 'Pending')""",
        (data["customer_id"], data["old_home_id"], data["new_home_id"]), commit=True
    )

    for appliance in data.get("appliances", []):
        run_query(
            """INSERT INTO move_appliances (move_request_id, appliance_id, required_service)
               VALUES (%s, %s, %s)""",
            (move_id, appliance.get("appliance_id"), appliance.get("required_service")), commit=True
        )

    return jsonify({"message": "Move request created", "move_request_id": move_id}), 201
