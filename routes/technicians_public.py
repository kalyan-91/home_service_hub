from flask import Blueprint, request, jsonify
from database.connection import run_query
from services.technician_matching import find_nearby_technicians


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


# GET /api/technicians/nearby?service_id=1&city=Anantapur
#   optional: lat, lon, pincode, budget, date (YYYY-MM-DD), time (HH:MM), max_km
# (Must stay a fixed path; "/nearby" does not clash with "/<int:technician_id>".)
@technicians_public_bp.route("/nearby", methods=["GET"])
def nearby_technicians():
    a = request.args
    try:
        results = find_nearby_technicians(
            service_id=int(a["service_id"]),
            customer_lat=float(a["lat"]) if a.get("lat") else None,
            customer_lon=float(a["lon"]) if a.get("lon") else None,
            customer_city=a.get("city"),
            customer_pincode=a.get("pincode"),
            customer_budget=float(a["budget"]) if a.get("budget") else None,
            requested_date=a.get("date"),
            requested_time=a.get("time"),
            max_distance_km=float(a.get("max_km", 15)),
        )
    except KeyError:
        return jsonify({"error": "service_id is required"}), 400
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    # Add technician names (users.user_id == technicians.technician_id)
    if results:
        ids = [r["technician_id"] for r in results]
        placeholders = ",".join(["%s"] * len(ids))
        names = run_query(
            f"SELECT user_id, name FROM users WHERE user_id IN ({placeholders})",
            tuple(ids), fetch=True,
        ) or []
        name_map = {n["user_id"]: n["name"] for n in names}
        for r in results:
            r["name"] = name_map.get(r["technician_id"])
            # Decimal -> float so JSON is clean numbers, not strings
            for key in ("latitude", "longitude"):
                if r.get(key) is not None:
                    r[key] = float(r[key])

    return jsonify(results)


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
