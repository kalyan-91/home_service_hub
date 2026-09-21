from flask import Blueprint, request, jsonify
from database.connection import run_query

# Public (customer-facing) technician listing.
# Separate from technician_bp (/api/technician), which is for the logged-in technician's own data.
technicians_public_bp = Blueprint("technicians_public", __name__, url_prefix="/api/technicians")

# Whitelist of ORDER BY clauses -- never put raw user input into SQL.
SORT_OPTIONS = {
    "rating": "COALESCE(rt.avg_rating, 0) DESC, COALESCE(sk.years_experience, 0) DESC",
    "experience": "COALESCE(sk.years_experience, 0) DESC, COALESCE(rt.avg_rating, 0) DESC",
}


def _clean(row):
    """Convert Decimal values (AVG returns Decimal) to plain floats/ints for JSON."""
    if row.get("rating") is not None:
        row["rating"] = round(float(row["rating"]), 1)
    row["years_experience"] = int(row.get("years_experience") or 0)
    return row


# GET /api/technicians?sort=rating|experience
@technicians_public_bp.route("", methods=["GET"])
@technicians_public_bp.route("/", methods=["GET"])
def list_technicians():
    sort = request.args.get("sort", "rating")
    order_by = SORT_OPTIONS.get(sort, SORT_OPTIONS["rating"])

    rows = run_query(
        f"""SELECT u.user_id, u.name, t.service_area, t.verification_status,
                   rt.avg_rating AS rating,
                   COALESCE(rt.review_count, 0) AS review_count,
                   COALESCE(sk.years_experience, 0) AS years_experience
            FROM users u
            JOIN technicians t ON t.technician_id = u.user_id
            LEFT JOIN (
                SELECT technician_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
                FROM reviews
                GROUP BY technician_id
            ) rt ON rt.technician_id = u.user_id
            LEFT JOIN (
                SELECT technician_id, MAX(years_experience) AS years_experience
                FROM technician_skills
                GROUP BY technician_id
            ) sk ON sk.technician_id = u.user_id
            WHERE t.verification_status = 'Verified'
            ORDER BY {order_by}""",
        fetch=True,
    ) or []

    return jsonify([_clean(r) for r in rows])


# GET /api/technicians/<id>  (the cards link to /technicians/<id>)
@technicians_public_bp.route("/<int:technician_id>", methods=["GET"])
def get_technician(technician_id):
    tech = run_query(
        """SELECT u.user_id, u.name, t.service_area, t.verification_status,
                  rt.avg_rating AS rating,
                  COALESCE(rt.review_count, 0) AS review_count,
                  COALESCE(sk.years_experience, 0) AS years_experience
           FROM users u
           JOIN technicians t ON t.technician_id = u.user_id
           LEFT JOIN (
               SELECT technician_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
               FROM reviews GROUP BY technician_id
           ) rt ON rt.technician_id = u.user_id
           LEFT JOIN (
               SELECT technician_id, MAX(years_experience) AS years_experience
               FROM technician_skills GROUP BY technician_id
           ) sk ON sk.technician_id = u.user_id
           WHERE u.user_id = %s AND t.verification_status = 'Verified'""",
        (technician_id,), fetch_one=True,
    )
    if not tech:
        return jsonify({"error": "Technician not found"}), 404

    skills = run_query(
        "SELECT skill_category, years_experience FROM technician_skills WHERE technician_id = %s",
        (technician_id,), fetch=True,
    ) or []

    tech = _clean(tech)
    tech["skills"] = skills
    return jsonify(tech)
