from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from database.connection import run_query

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/register/customer", methods=["POST"])
def register_customer():
    data = request.get_json(force=True)
    required = ["name", "email", "phone", "password"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    existing = run_query(
        "SELECT user_id FROM users WHERE email = %s", (data["email"],), fetch_one=True
    )
    if existing:
        return jsonify({"error": "An account with this email already exists"}), 409

    password_hash = generate_password_hash(data["password"])

    user_id = run_query(
        """INSERT INTO users (name, email, phone, password_hash, role)
           VALUES (%s, %s, %s, %s, 'customer')""",
        (data["name"], data["email"], data["phone"], password_hash),
        commit=True,
    )

    # customers table is a 1:1 extension of users — same id
    run_query(
        "INSERT INTO customers (customer_id) VALUES (%s)",
        (user_id,),
        commit=True,
    )

    return jsonify({"message": "Customer registered", "customer_id": user_id}), 201


@auth_bp.route("/register/technician", methods=["POST"])
def register_technician():
    data = request.get_json(force=True)
    required = ["name", "email", "phone", "password", "service_area"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    existing = run_query(
        "SELECT user_id FROM users WHERE email = %s", (data["email"],), fetch_one=True
    )
    if existing:
        return jsonify({"error": "An account with this email already exists"}), 409

    password_hash = generate_password_hash(data["password"])

    user_id = run_query(
        """INSERT INTO users (name, email, phone, password_hash, role)
           VALUES (%s, %s, %s, %s, 'technician')""",
        (data["name"], data["email"], data["phone"], password_hash),
        commit=True,
    )

    run_query(
        """INSERT INTO technicians (technician_id, service_area, latitude, longitude)
           VALUES (%s, %s, %s, %s)""",
        (user_id, data["service_area"], data.get("latitude"), data.get("longitude")),
        commit=True,
    )

    return jsonify({"message": "Technician registered", "technician_id": user_id}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    """Shared login for customer, technician, and admin — role is read
    from the users table and used to route the frontend to the right
    dashboard."""
    data = request.get_json(force=True)
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = run_query(
        "SELECT user_id, name, password_hash, role, status FROM users WHERE email = %s",
        (email,),
        fetch_one=True,
    )
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid email or password"}), 401

    if user["status"] == "inactive":
        return jsonify({"error": "This account has been deactivated"}), 403

    session["user_id"] = user["user_id"]
    session["role"] = user["role"]

    return jsonify({
        "message": "Login successful",
        "user_id": user["user_id"],
        "name": user["name"],
        "role": user["role"],
    })


@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"})
