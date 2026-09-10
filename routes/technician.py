from functools import wraps
from flask import Blueprint, request, jsonify, session
from database.connection import run_query

technician_bp = Blueprint("technician", __name__, url_prefix="/api/technician")


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if "user_id" not in session or session.get("role") != "technician":
            return jsonify({"error": "Login required"}), 401
        return fn(*args, **kwargs)
    return wrapper


# ---------------------------------------------------------------
# Profile
# ---------------------------------------------------------------

@technician_bp.route("/profile", methods=["GET"])
@login_required
def get_profile():
    technician_id = session["user_id"]
    profile = run_query(
        """SELECT u.user_id, u.name, u.email, u.phone, t.service_area,
                  t.latitude, t.longitude, t.verification_status, t.registered_date
           FROM users u JOIN technicians t ON t.technician_id = u.user_id
           WHERE u.user_id = %s""",
        (technician_id,), fetch_one=True,
    )
    if not profile:
        return jsonify({"error": "Profile not found"}), 404
    return jsonify(profile)


@technician_bp.route("/profile", methods=["PUT"])
@login_required
def update_profile():
    technician_id = session["user_id"]
    data = request.get_json(force=True)

    user_fields, user_params = [], []
    for field in ("name", "phone"):
        if field in data:
            user_fields.append(f"{field} = %s")
            user_params.append(data[field])
    if user_fields:
        user_params.append(technician_id)
        run_query(f"UPDATE users SET {', '.join(user_fields)} WHERE user_id = %s", tuple(user_params), commit=True)

    tech_fields, tech_params = [], []
    for field in ("service_area", "latitude", "longitude"):
        if field in data:
            tech_fields.append(f"{field} = %s")
            tech_params.append(data[field])
    if tech_fields:
        tech_params.append(technician_id)
        run_query(
            f"UPDATE technicians SET {', '.join(tech_fields)} WHERE technician_id = %s",
            tuple(tech_params), commit=True,
        )

    return jsonify({"message": "Profile updated"})


# ---------------------------------------------------------------
# Skills
# ---------------------------------------------------------------

@technician_bp.route("/skills", methods=["GET"])
@login_required
def list_skills():
    skills = run_query(
        "SELECT * FROM technician_skills WHERE technician_id = %s",
        (session["user_id"],), fetch_all=True,
    )
    return jsonify(skills)


@technician_bp.route("/skills", methods=["POST"])
@login_required
def add_skill():
    data = request.get_json(force=True)
    if not data.get("skill_category"):
        return jsonify({"error": "skill_category is required"}), 400

    skill_id = run_query(
        "INSERT INTO technician_skills (technician_id, skill_category, years_experience) VALUES (%s, %s, %s)",
        (session["user_id"], data["skill_category"], data.get("years_experience", 0)),
        commit=True,
    )
    return jsonify({"message": "Skill added", "skill_id": skill_id}), 201


@technician_bp.route("/skills/<int:skill_id>", methods=["DELETE"])
@login_required
def delete_skill(skill_id):
    run_query(
        "DELETE FROM technician_skills WHERE skill_id = %s AND technician_id = %s",
        (skill_id, session["user_id"]), commit=True,
    )
    return jsonify({"message": "Skill removed"})


# ---------------------------------------------------------------
# Availability
# ---------------------------------------------------------------

@technician_bp.route("/availability", methods=["GET"])
@login_required
def list_availability():
    slots = run_query(
        "SELECT * FROM technician_availability WHERE technician_id = %s",
        (session["user_id"],), fetch_all=True,
    )
    return jsonify(slots)


@technician_bp.route("/availability", methods=["POST"])
@login_required
def set_availability():
    data = request.get_json(force=True)
    required = ["day_of_week", "start_time", "end_time"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    availability_id = run_query(
        """INSERT INTO technician_availability (technician_id, day_of_week, start_time, end_time, available)
           VALUES (%s, %s, %s, %s, %s)""",
        (session["user_id"], data["day_of_week"], data["start_time"], data["end_time"],
         data.get("available", True)),
        commit=True,
    )
    return jsonify({"message": "Availability set", "availability_id": availability_id}), 201


@technician_bp.route("/availability/<int:availability_id>", methods=["DELETE"])
@login_required
def delete_availability(availability_id):
    run_query(
        "DELETE FROM technician_availability WHERE availability_id = %s AND technician_id = %s",
        (availability_id, session["user_id"]), commit=True,
    )
    return jsonify({"message": "Availability removed"})
