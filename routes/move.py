from flask import Blueprint, jsonify, request
from database.connection import run_query
from services.technician_matching import find_nearby_technicians

move_bp = Blueprint("move", __name__, url_prefix="/api/move")

# Starting price map per install/removal type. Keys are built from
# appliances.category (schema ENUM values, e.g. "Washing Machine", "RO Purifier")
# normalized to lowercase with spaces -> underscores. Adjust prices to match
# Asif's actual `services` table pricing once that's finalized.
DEFAULT_SERVICE_PRICES = {
    "fan_installation": 200,
    "light_installation": 100,
    "ac_installation": 1500,
    "refrigerator_installation": 600,
    "washing_machine_installation": 500,
    "tv_installation": 300,
    "geyser_installation": 450,
    "ro_purifier_installation": 400,
    "microwave_installation": 250,
    "inverter_installation": 700,
    "other_installation": 300,
}


def _category_to_service_key(category):
    """Normalize an appliances.category ENUM value (e.g. 'Washing Machine',
    'RO Purifier') into a DEFAULT_SERVICE_PRICES key (e.g.
    'washing_machine_installation', 'ro_purifier_installation')."""
    normalized = category.strip().lower().replace(" ", "_")
    return f"{normalized}_installation"


@move_bp.route("/required-services", methods=["POST"])
def required_services():
    """Given a list of appliances being moved, return the required
    removal/installation service for each one."""
    data = request.get_json(force=True)
    appliances = data.get("appliances", [])  # [{appliance_id, category}, ...]

    required = []
    for appliance in appliances:
        category = appliance.get("category", "")
        service_key = _category_to_service_key(category)
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
        category = appliance.get("category", "")
        qty = appliance.get("quantity", 1)
        service_key = _category_to_service_key(category)
        price = DEFAULT_SERVICE_PRICES.get(service_key, 300)
        line_total = price * qty
        total += line_total
        breakdown.append({"category": category, "quantity": qty, "unit_price": price, "line_total": line_total})

    return jsonify({"breakdown": breakdown, "estimated_total": total})


