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
    """Return technicians who offer the given service, ranked by
    distance (asc), rating (desc), experience (desc).

    Assumes Member 1's `technicians` and `technician_skills` tables:
      technicians(technician_id, name, latitude, longitude, rating, ...)
      technician_skills(technician_id, skill_id -> maps to service, experience_years)
      technician_availability(technician_id, day_of_week, available)
    """
    radius_km = radius_km or Config.MATCH_RADIUS_KM

    query = """
        SELECT t.technician_id, t.name, t.latitude, t.longitude,
               t.rating, ts.experience_years
        FROM technicians t
        JOIN technician_skills ts ON ts.technician_id = t.technician_id
        WHERE ts.skill_id = %s
    """
    candidates = run_query(query, (service_id,), fetch=True) or []

    ranked = []
    for tech in candidates:
        distance = haversine_km(customer_lat, customer_lon, tech.get("latitude"), tech.get("longitude"))
        if distance <= radius_km:
            tech["distance_km"] = round(distance, 2)
            ranked.append(tech)

    ranked.sort(key=lambda t: (t["distance_km"], -(t.get("rating") or 0), -(t.get("experience_years") or 0)))
    return ranked
