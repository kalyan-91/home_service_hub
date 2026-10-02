import math
from database.connection import run_query
from config import Config


def haversine_km(lat1, lon1, lat2, lon2):
    """Great-circle distance between two lat/long points, in kilometers."""
    if None in (lat1, lon1, lat2, lon2):
        return float("inf")
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def find_nearby_technicians(service_id, customer_lat, customer_lon, radius_km=None):
    """Return verified technicians who can perform the given service,
    ranked by distance (asc), rating (desc), experience (desc).

    Matching logic: services.service_id -> services.category ->
    technician_skills.skill_category -> technicians.technician_id.
    (technician_skills.skill_id is just that table's own primary key,
    it does NOT map to services.service_id.)
    """
    radius_km = radius_km or Config.MATCH_RADIUS_KM

    query = """
        SELECT t.technician_id, u.name, t.latitude, t.longitude,
               t.service_area, t.verification_status,
               ts.years_experience,
               COALESCE(rt.avg_rating, 0) AS rating
        FROM services s
        JOIN technician_skills ts ON ts.skill_category = s.category
        JOIN technicians t ON t.technician_id = ts.technician_id
        JOIN users u ON u.user_id = t.technician_id
        LEFT JOIN (
            SELECT technician_id, AVG(rating) AS avg_rating
            FROM reviews
            GROUP BY technician_id
        ) rt ON rt.technician_id = t.technician_id
        WHERE s.service_id = %s
          AND t.verification_status = 'Verified'
    """
    candidates = run_query(query, (service_id,), fetch=True) or []

    ranked = []
    for tech in candidates:
        distance = haversine_km(customer_lat, customer_lon, tech.get("latitude"), tech.get("longitude"))
        if distance <= radius_km:
            tech["distance_km"] = round(distance, 2)
            tech["rating"] = round(float(tech.get("rating") or 0), 1)
            tech["years_experience"] = int(tech.get("years_experience") or 0)
            ranked.append(tech)

    ranked.sort(key=lambda t: (t["distance_km"], -t["rating"], -t["years_experience"]))
    return ranked
