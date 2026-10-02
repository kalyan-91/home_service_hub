"""
Nearby Technician Matching
--------------------------
Matches the REAL confirmed schema:

  technicians: technician_id, service_area, latitude, longitude,
               verification_status, registered_date
               (no city/pincode/rating columns — service_area is free text,
               rating is computed from reviews)
  technician_skills: skill_id, technician_id, skill_category, years_experience
               (matched against services.required_skill, both free text)
  technician_availability: availability_id, technician_id, day_of_week
               (enum Mon..Sun), start_time, end_time, available (0/1)
  services: service_id, name, price_range (STRING like "500-800"),
               required_skill, estimated_duration, category
  reviews: review_id, booking_id, customer_id, technician_id, rating,
               review_text, review_date

Matching strategy:
  1. Filter to technicians whose skill_category matches the service's
     required_skill, AND who are verified, AND who have an available=1 slot
     today (day-of-week level — not checking exact time overlap yet).
  2. If customer lat/long given, compute real distance (Haversine) and filter
     to max_distance_km. Otherwise fall back to matching customer_city or
     customer_pincode as a substring of the technician's service_area text.
  3. Score + sort by distance and average rating (price_range is a per-service
     string, not per-technician, so it's informational only — shown but not
     used to differentiate technicians doing the same service).
"""

import math
from datetime import datetime
from database.connection import run_query

WEIGHT_DISTANCE = 0.6
WEIGHT_RATING = 0.4

DAY_ENUM = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (math.sin(d_phi / 2) ** 2
         + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def get_service_info(service_id):
    return run_query(
        "SELECT required_skill, price_range, name FROM services WHERE service_id=%s",
        (service_id,), fetch_one=True
    )


def get_skilled_technician_ids(required_skill):
    rows = run_query(
        "SELECT DISTINCT technician_id FROM technician_skills WHERE skill_category=%s",
        (required_skill,), fetch=True
    )
    return {row["technician_id"] for row in rows}


def get_available_today_technician_ids(day_of_week=None):
    """day_of_week should be 'Mon'/'Tue'/etc. Defaults to today."""
    if day_of_week is None:
        day_of_week = DAY_ENUM[datetime.now().weekday()]
    rows = run_query(
        "SELECT DISTINCT technician_id FROM technician_availability WHERE day_of_week=%s AND available=1",
        (day_of_week,), fetch=True
    )
    return {row["technician_id"] for row in rows}


def get_average_ratings(technician_ids):
    if not technician_ids:
        return {}
    placeholders = ",".join(["%s"] * len(technician_ids))
    rows = run_query(
        f"""SELECT technician_id, AVG(rating) AS avg_rating
            FROM reviews WHERE technician_id IN ({placeholders})
            GROUP BY technician_id""",
        tuple(technician_ids), fetch=True
    )
    return {row["technician_id"]: float(row["avg_rating"]) for row in rows}


def _normalize(value, min_val, max_val, invert=False):
    if max_val == min_val:
        return 1.0
    score = (value - min_val) / (max_val - min_val)
    return 1 - score if invert else score


def find_nearby_technicians(service_id, customer_lat=None, customer_lon=None,
                             customer_city=None, customer_pincode=None,
                             max_distance_km=15, limit=10):
    service = get_service_info(service_id)
    if not service or not service.get("required_skill"):
        return []

    required_skill = service["required_skill"]
    price_range = service.get("price_range")

    skilled_ids = get_skilled_technician_ids(required_skill)
    available_ids = get_available_today_technician_ids()
    eligible_ids = skilled_ids & available_ids

    if not eligible_ids:
        return []

    placeholders = ",".join(["%s"] * len(eligible_ids))
    technicians = run_query(
        f"""SELECT technician_id, service_area, latitude, longitude, verification_status
            FROM technicians
            WHERE technician_id IN ({placeholders}) AND verification_status='Verified'""",
        tuple(eligible_ids), fetch=True
    )

    use_distance = customer_lat is not None and customer_lon is not None
    results = []

    for tech in technicians:
        distance_km = None

        if use_distance and tech.get("latitude") is not None and tech.get("longitude") is not None:
            distance_km = haversine_km(customer_lat, customer_lon, tech["latitude"], tech["longitude"])
            if distance_km > max_distance_km:
                continue
        elif customer_city or customer_pincode:
            area = (tech.get("service_area") or "").lower()
            city_match = customer_city and customer_city.lower() in area
            pincode_match = customer_pincode and customer_pincode in area
            if not (city_match or pincode_match):
                continue
        # No location info given at all -> don't filter by location, just rank below.

        tech["distance_km"] = round(distance_km, 2) if distance_km is not None else None
        results.append(tech)

    if not results:
        return []

    ratings = get_average_ratings([r["technician_id"] for r in results])
    for r in results:
        r["average_rating"] = round(ratings.get(r["technician_id"], 0), 2) if r["technician_id"] in ratings else None

    distances = [r["distance_km"] for r in results if r["distance_km"] is not None]
    rating_values = [r["average_rating"] for r in results if r["average_rating"] is not None]
    min_dist, max_dist = (min(distances), max(distances)) if distances else (0, 0)
    min_rating, max_rating = (min(rating_values), max(rating_values)) if rating_values else (0, 5)

    for r in results:
        dist_score = (
            _normalize(r["distance_km"], min_dist, max_dist, invert=True)
            if r["distance_km"] is not None else 0.5
        )
        rating_score = (
            _normalize(r["average_rating"], min_rating, max_rating)
            if r["average_rating"] is not None else 0.5
        )
        r["match_score"] = round(dist_score * WEIGHT_DISTANCE + rating_score * WEIGHT_RATING, 4)
        r["price_range"] = price_range  # informational — same for all, service-level not technician-level

    results.sort(key=lambda r: r["match_score"], reverse=True)
    return results[:limit]
