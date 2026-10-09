from functools import wraps
from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from database.connection import run_query

customer_bp = Blueprint("customer", __name__, url_prefix="/api/customer")


def login_required(role="customer"):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if "user_id" not in session or session.get("role") != role:
                return jsonify({"error": "Login required"}), 401
            return fn(*args, **kwargs)
        return wrapper
    return decorator


# ---------------------------------------------------------------
# Profile
# ---------------------------------------------------------------

@customer_bp.route("/profile", methods=["GET"])
@login_required()
def get_profile():
    user_id = session["user_id"]
    profile = run_query(
        """SELECT u.user_id, u.name, u.email, u.phone, u.status, c.registered_date
           FROM users u JOIN customers c ON c.customer_id = u.user_id
           WHERE u.user_id = %s""",
        (user_id,), fetch_one=True,
    )
    if not profile:
        return jsonify({"error": "Profile not found"}), 404
    return jsonify(profile)


@customer_bp.route("/profile", methods=["PUT"])
@login_required()
def update_profile():
    user_id = session["user_id"]
    data = request.get_json(force=True)
    fields, params = [], []
    for field in ("name", "phone", "email"):
        if field in data:
            fields.append(f"{field} = %s")
            params.append(data[field])
    if not fields:
        return jsonify({"error": "Nothing to update"}), 400
    params.append(user_id)
    run_query(f"UPDATE users SET {', '.join(fields)} WHERE user_id = %s", tuple(params), commit=True)
    return jsonify({"message": "Profile updated"})


@customer_bp.route("/change-password", methods=["PUT"])
@login_required()
def change_password():
    user_id = session["user_id"]
    data = request.get_json(force=True)
    old_password = data.get("old_password")
    new_password = data.get("new_password")
    if not old_password or not new_password:
        return jsonify({"error": "old_password and new_password are required"}), 400

    user = run_query("SELECT password_hash FROM users WHERE user_id = %s", (user_id,), fetch_one=True)
    if not check_password_hash(user["password_hash"], old_password):
        return jsonify({"error": "Old password is incorrect"}), 401

    run_query(
        "UPDATE users SET password_hash = %s WHERE user_id = %s",
        (generate_password_hash(new_password), user_id), commit=True,
    )
    return jsonify({"message": "Password updated"})


@customer_bp.route("/deactivate", methods=["POST"])
@login_required()
def deactivate_account():
    user_id = session["user_id"]
    run_query("UPDATE users SET status = 'inactive' WHERE user_id = %s", (user_id,), commit=True)
    session.clear()
    return jsonify({"message": "Account deactivated"})


@customer_bp.route("/dashboard", methods=["GET"])
@login_required()
def dashboard():
    user_id = session["user_id"]
    homes = run_query("SELECT * FROM homes WHERE customer_id = %s", (user_id,), fetch=True)
    appliance_count = run_query(
        """SELECT COUNT(*) AS total FROM appliances a
           JOIN homes h ON h.home_id = a.home_id WHERE h.customer_id = %s""",
        (user_id,), fetch_one=True,
    )
    return jsonify({"homes": homes, "appliance_count": appliance_count["total"]})


# ---------------------------------------------------------------
# Homes
# ---------------------------------------------------------------

@customer_bp.route("/homes", methods=["GET"])
@login_required()
def list_homes():
    homes = run_query("SELECT * FROM homes WHERE customer_id = %s", (session["user_id"],), fetch=True)
    return jsonify(homes)


@customer_bp.route("/homes", methods=["POST"])
@login_required()
def add_home():
    data = request.get_json(force=True)
    if not data.get("address") or not data.get("city"):
        return jsonify({"error": "address and city are required"}), 400

    status = data.get("status", "current")
    if status not in ("current", "previous"):
        return jsonify({"error": "status must be 'current' or 'previous'"}), 400

    # Only one home can be current: a new current home demotes the others
    if status == "current":
        run_query(
            "UPDATE homes SET status = 'previous' WHERE customer_id = %s",
            (session["user_id"],), commit=True,
        )

    home_id = run_query(
        """INSERT INTO homes (customer_id, address, city, state, pincode, latitude, longitude, home_type, status)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (session["user_id"], data["address"], data["city"], data.get("state"),
         data.get("pincode"), data.get("latitude"), data.get("longitude"),
         data.get("home_type", "owned"), status),
        commit=True,
    )
    return jsonify({"message": "Home added", "home_id": home_id}), 201


@customer_bp.route("/homes/<int:home_id>", methods=["GET"])
@login_required()
def get_home(home_id):
    home = run_query(
        "SELECT * FROM homes WHERE home_id = %s AND customer_id = %s",
        (home_id, session["user_id"]), fetch_one=True,
    )
    if not home:
        return jsonify({"error": "Home not found"}), 404
    return jsonify(home)


@customer_bp.route("/homes/<int:home_id>", methods=["PUT"])
@login_required()
def update_home(home_id):
    data = request.get_json(force=True)
    fields, params = [], []
    for field in ("address", "city", "state", "pincode", "latitude", "longitude", "home_type"):
        if field in data:
            fields.append(f"{field} = %s")
            params.append(data[field])
    if not fields:
        return jsonify({"error": "Nothing to update"}), 400
    params += [home_id, session["user_id"]]
    run_query(
        f"UPDATE homes SET {', '.join(fields)} WHERE home_id = %s AND customer_id = %s",
        tuple(params), commit=True,
    )
    return jsonify({"message": "Home updated"})


@customer_bp.route("/homes/<int:home_id>", methods=["DELETE"])
@login_required()
def delete_home(home_id):
    if not _home_belongs_to_customer(home_id, session["user_id"]):
        return jsonify({"error": "Home not found"}), 404

    # A home that is part of a move request must be kept (history)
    in_move = run_query(
        "SELECT move_request_id FROM move_requests WHERE old_home_id = %s OR new_home_id = %s LIMIT 1",
        (home_id, home_id), fetch_one=True,
    )
    if in_move:
        return jsonify({"error": "This home is part of a move request and cannot be deleted"}), 409

    # appliances.home_id has a foreign key to homes, so remove them first,
    # but never if any of them has history or requests attached
    home_appliances = run_query(
        "SELECT appliance_id FROM appliances WHERE home_id = %s", (home_id,), fetch=True,
    )
    if _appliances_in_use([a["appliance_id"] for a in home_appliances]):
        return jsonify({"error": "This home has appliances with service history and cannot be deleted"}), 409

    run_query("DELETE FROM appliances WHERE home_id = %s", (home_id,), commit=True)
    run_query(
        "DELETE FROM homes WHERE home_id = %s AND customer_id = %s",
        (home_id, session["user_id"]), commit=True,
    )
    return jsonify({"message": "Home deleted"})


@customer_bp.route("/homes/<int:home_id>/set-current", methods=["POST"])
@login_required()
def set_current_home(home_id):
    user_id = session["user_id"]
    if not _home_belongs_to_customer(home_id, user_id):
        return jsonify({"error": "Home not found"}), 404
    run_query("UPDATE homes SET status = 'previous' WHERE customer_id = %s", (user_id,), commit=True)
    run_query(
        "UPDATE homes SET status = 'current' WHERE home_id = %s AND customer_id = %s",
        (home_id, user_id), commit=True,
    )
    return jsonify({"message": "Current home updated"})


# ---------------------------------------------------------------
# Appliances
# ---------------------------------------------------------------

def _home_belongs_to_customer(home_id, customer_id):
    return run_query(
        "SELECT home_id FROM homes WHERE home_id = %s AND customer_id = %s",
        (home_id, customer_id), fetch_one=True,
    ) is not None


def _appliances_in_use(appliance_ids):
    """True if any of these appliances is referenced by a service request, service
    history, maintenance reminder or move request. Those foreign keys would make
    MySQL reject the delete, and deleting them would erase the appliance history."""
    if not appliance_ids:
        return False
    placeholders = ", ".join(["%s"] * len(appliance_ids))
    for table in ("service_requests", "service_history", "maintenance_reminders", "move_appliances"):
        row = run_query(
            f"SELECT 1 AS used FROM {table} WHERE appliance_id IN ({placeholders}) LIMIT 1",
            tuple(appliance_ids), fetch_one=True,
        )
        if row:
            return True
    return False


@customer_bp.route("/homes/<int:home_id>/appliances", methods=["GET"])
@login_required()
def list_appliances(home_id):
    if not _home_belongs_to_customer(home_id, session["user_id"]):
        return jsonify({"error": "Home not found"}), 404
    appliances = run_query("SELECT * FROM appliances WHERE home_id = %s", (home_id,), fetch=True)
    return jsonify(appliances)


@customer_bp.route("/homes/<int:home_id>/appliances", methods=["POST"])
@login_required()
def add_appliance(home_id):
    if not _home_belongs_to_customer(home_id, session["user_id"]):
        return jsonify({"error": "Home not found"}), 404
    data = request.get_json(force=True)
    if not data.get("name") or not data.get("category"):
        return jsonify({"error": "name and category are required"}), 400

    appliance_id = run_query(
        """INSERT INTO appliances (home_id, name, category, brand, model, purchase_date, warranty_expiry)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (home_id, data["name"], data["category"], data.get("brand"), data.get("model"),
         data.get("purchase_date"), data.get("warranty_expiry")),
        commit=True,
    )
    return jsonify({"message": "Appliance added", "appliance_id": appliance_id}), 201


@customer_bp.route("/appliances/<int:appliance_id>", methods=["GET"])
@login_required()
def get_appliance(appliance_id):
    appliance = run_query(
        """SELECT a.* FROM appliances a JOIN homes h ON h.home_id = a.home_id
           WHERE a.appliance_id = %s AND h.customer_id = %s""",
        (appliance_id, session["user_id"]), fetch_one=True,
    )
    if not appliance:
        return jsonify({"error": "Appliance not found"}), 404
    return jsonify(appliance)


@customer_bp.route("/appliances/<int:appliance_id>", methods=["PUT"])
@login_required()
def update_appliance(appliance_id):
    data = request.get_json(force=True)
    fields, params = [], []
    for field in ("name", "category", "brand", "model", "purchase_date", "warranty_expiry"):
        if field in data:
            fields.append(f"{field} = %s")
            params.append(data[field])
    if not fields:
        return jsonify({"error": "Nothing to update"}), 400

    owned = run_query(
        """SELECT a.appliance_id FROM appliances a JOIN homes h ON h.home_id = a.home_id
           WHERE a.appliance_id = %s AND h.customer_id = %s""",
        (appliance_id, session["user_id"]), fetch_one=True,
    )
    if not owned:
        return jsonify({"error": "Appliance not found"}), 404

    params.append(appliance_id)
    run_query(f"UPDATE appliances SET {', '.join(fields)} WHERE appliance_id = %s", tuple(params), commit=True)
    return jsonify({"message": "Appliance updated"})


@customer_bp.route("/appliances/<int:appliance_id>", methods=["DELETE"])
@login_required()
def delete_appliance(appliance_id):
    owned = run_query(
        """SELECT a.appliance_id FROM appliances a JOIN homes h ON h.home_id = a.home_id
           WHERE a.appliance_id = %s AND h.customer_id = %s""",
        (appliance_id, session["user_id"]), fetch_one=True,
    )
    if not owned:
        return jsonify({"error": "Appliance not found"}), 404
    if _appliances_in_use([appliance_id]):
        return jsonify({"error": "This appliance has service history or requests and cannot be deleted"}), 409
    run_query("DELETE FROM appliances WHERE appliance_id = %s", (appliance_id,), commit=True)
    return jsonify({"message": "Appliance deleted"})


# ---------------------------------------------------------------
# Service History (read-only — Pavan's booking/completion flow writes
# these rows; this is the customer's view of their own history)
# ---------------------------------------------------------------

@customer_bp.route("/appliances/<int:appliance_id>/history", methods=["GET"])
@login_required()
def appliance_history(appliance_id):
    owned = run_query(
        """SELECT a.appliance_id FROM appliances a JOIN homes h ON h.home_id = a.home_id
           WHERE a.appliance_id = %s AND h.customer_id = %s""",
        (appliance_id, session["user_id"]), fetch_one=True,
    )
    if not owned:
        return jsonify({"error": "Appliance not found"}), 404

    history = run_query(
        """SELECT history_id, service_type, cost, completed_date, notes, booking_id
           FROM service_history WHERE appliance_id = %s
           ORDER BY completed_date DESC""",
        (appliance_id,), fetch=True,
    )
    return jsonify(history)


@customer_bp.route("/history", methods=["GET"])
@login_required()
def full_service_history():
    """Service history across every appliance the customer owns, most recent first."""
    history = run_query(
        """SELECT sh.history_id, sh.appliance_id, a.name AS appliance_name, a.category,
                  sh.service_type, sh.cost, sh.completed_date, sh.notes
           FROM service_history sh
           JOIN appliances a ON a.appliance_id = sh.appliance_id
           JOIN homes h ON h.home_id = a.home_id
           WHERE h.customer_id = %s
           ORDER BY sh.completed_date DESC""",
        (session["user_id"],), fetch=True,
    )
    return jsonify(history)
