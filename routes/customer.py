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
    homes = run_query("SELECT * FROM homes WHERE customer_id = %s", (user_id,), fetch_all=True)
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
    homes = run_query("SELECT * FROM homes WHERE customer_id = %s", (session["user_id"],), fetch_all=True)
    return jsonify(homes)


@customer_bp.route("/homes", methods=["POST"])
@login_required()
def add_home():
    data = request.get_json(force=True)
    if not data.get("address") or not data.get("city"):
        return jsonify({"error": "address and city are required"}), 400

    home_id = run_query(
        """INSERT INTO homes (customer_id, address, city, state, pincode, latitude, longitude, home_type, status)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (session["user_id"], data["address"], data["city"], data.get("state"),
         data.get("pincode"), data.get("latitude"), data.get("longitude"),
         data.get("home_type", "owned"), data.get("status", "current")),
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
    run_query(
        "DELETE FROM homes WHERE home_id = %s AND customer_id = %s",
        (home_id, session["user_id"]), commit=True,
    )
    return jsonify({"message": "Home deleted"})


@customer_bp.route("/homes/<int:home_id>/set-current", methods=["POST"])
@login_required()
def set_current_home(home_id):
    user_id = session["user_id"]
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


@customer_bp.route("/homes/<int:home_id>/appliances", methods=["GET"])
@login_required()
def list_appliances(home_id):
    if not _home_belongs_to_customer(home_id, session["user_id"]):
        return jsonify({"error": "Home not found"}), 404
    appliances = run_query("SELECT * FROM appliances WHERE home_id = %s", (home_id,), fetch_all=True)
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
    run_query("DELETE FROM appliances WHERE appliance_id = %s", (appliance_id,), commit=True)
    return jsonify({"message": "Appliance deleted"})
