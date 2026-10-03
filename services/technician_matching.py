"""
Nearby Technician Matching (updated)
------------------------------------
Schema:
  technicians: technician_id, service_area, latitude, longitude,
               verification_status, registered_date
  technician_skills: skill_id, technician_id, skill_category, years_experience
  technician_availability: availability_id, technician_id, day_of_week,
               start_time, end_time, available (0/1)
  services: service_id, name, price_range ("500-800"), required_skill,
               estimated_duration, category
  reviews: review_id, booking_id, customer_id, technician_id, rating, ...

Matching steps:
  1. Skill      : technician_skills.skill_category == services.required_skill
                  (case-insensitive)
  2. Availability: available=1 on the requested day, and the requested time
                  falls inside start_time..end_time (time optional)
  3. Verified   : verification_status = 'Verified'
  4. Location   : Haversine distance if lat/long given (filtered by
                  max_distance_km); otherwise city/pincode substring match
                  on service_area. At least one location input is required.
  5. Price      : if customer_budget is given, compared with the service's
                  price_range. Below the minimum -> no results.
  6. Score      : distance (0.6) + rating (0.4), sorted descending.
"""

import math
import re
from datetime import datetime, date, time

from database.connection import run_query

WEIGHT_DISTANCE = 0.6
WEIGHT_RATING = 0.4
UNKNOWN_DISTANCE_SCORE = 0.3   # city/pincode-only matches rank a bit lower
NO_REVIEW_RATING_SCORE = 0.5   # neutral score for technicians with no reviews

DAY_ENUM = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (math.sin(d_phi / 2) ** 2
         + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def parse_price_range(price_range):
    """
    '500-800', '₹300 - ₹600', 'Rs. 1,000 to 2,000' -> (low, high).
    A single number ('500') -> (500, 500). Returns (None, None) if unparseable.
    """
    if not price_range:
        return None, None
    nums = re.findall(r"\d+(?:\.\d+)?", str(price_range).replace(",", ""))
    if len(nums) >= 2:
        low, high = float(nums[0]), float(nums[1])
        return min(low, high), max(low, high)
    if len(nums) == 1:
        return float(nums[0]), float(nums[0])
    return None, None


def _resolve_day(requested_day=None, requested_date=None):
    """Return 'Mon'..'Sun'. Accepts a day string, a date/datetime, or None (today)."""
    if requested_day:
        day = str(requested_day).strip()[:3].title()
        if day not in DAY_ENUM:
            raise ValueError(f"Invalid requested_day: {requested_day!r}")
        return day
    if isinstance(requested_date, (date, datetime)):
        return DAY_ENUM[requested_date.weekday()]
    if isinstance(requested_date, str):
        return DAY_ENUM[datetime.strptime(requested_date, "%Y-%m-%d").weekday()]
    return DAY_ENUM[datetime.now().weekday()]


def _resolve_time(requested_time):
    """Return 'HH:MM:SS' string or None. Accepts time/datetime/'HH:MM'/'HH:MM:SS'."""
    if requested_time is None:
        return None
    if isinstance(requested_time, datetime):
        return requested_time.strftime("%H:%M:%S")
    if isinstance(requested_time, time):
        return requested_time.strftime("%H:%M:%S")
    text = str(requested_time).strip()
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(text, fmt).strftime("%H:%M:%S")
        except ValueError:
            continue
    raise ValueError(f"Invalid requested_time: {requested_time!r}")


def _placeholders(items):
    return ",".join(["%s"] * len(items))


# --------------------------------------------------------------------------
# Queries
# --------------------------------------------------------------------------
def get_service_info(service_id):
    return run_query(
        "SELECT required_skill, price_range, name FROM services WHERE service_id=%s",
        (service_id,), fetch_one=True
    )


def get_skilled_technician_ids(required_skill):
    rows = run_query(
        "SELECT DISTINCT technician_id FROM technician_skills "
        "WHERE LOWER(TRIM(skill_category)) = LOWER(TRIM(%s))",
        (required_skill,), fetch=True
    )
    return {row["technician_id"] for row in rows}


def get_available_technician_ids(day, at_time=None):
    """Technicians with an available=1 slot on `day`, covering `at_time` if given."""
    if at_time:
        rows = run_query(
            """SELECT DISTINCT technician_id FROM technician_availability
               WHERE day_of_week=%s AND available=1
                 AND start_time <= %s AND end_time >= %s""",
            (day, at_time, at_time), fetch=True
        )
    else:
        rows = run_query(
            """SELECT DISTINCT technician_id FROM technician_availability
               WHERE day_of_week=%s AND available=1""",
            (day,), fetch=True
        )
    return {row["technician_id"] for row in rows}


def get_rating_stats(technician_ids):
    """{technician_id: (avg_rating, review_count)}"""
    if not technician_ids:
        return {}
    ids = list(technician_ids)
    rows = run_query(
        f"""SELECT technician_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
            FROM reviews WHERE technician_id IN ({_placeholders(ids)})
            GROUP BY technician_id""",
        tuple(ids), fetch=True
    )
    return {r["technician_id"]: (float(r["avg_rating"]), int(r["review_count"]))
            for r in rows}


# --------------------------------------------------------------------------
# Price check
# --------------------------------------------------------------------------
def check_budget(price_low, price_high, customer_budget):
    """
    Returns (ok, status):
      no budget given / unparseable range -> (True, 'not_checked')
      budget >= high                      -> (True, 'within_budget')
      low <= budget < high                -> (True, 'partially_within_budget')
      budget < low                        -> (False, 'over_budget')
    """
    if customer_budget is None or price_low is None or price_high is None:
        return True, "not_checked"
    if customer_budget >= price_high:
        return True, "within_budget"
    if customer_budget >= price_low:
        return True, "partially_within_budget"
    return False, "over_budget"


# --------------------------------------------------------------------------
# Main matching
# --------------------------------------------------------------------------
def find_nearby_technicians(service_id,
                            customer_lat=None, customer_lon=None,
                            customer_city=None, customer_pincode=None,
                            customer_budget=None,
                            requested_day=None, requested_date=None,
                            requested_time=None,
                            max_distance_km=15, limit=10):
    """
    Returns a list of technician dicts sorted by match_score (best first).
    Raises ValueError if no location input is given.
    """
    use_distance = customer_lat is not None and customer_lon is not None
    if not (use_distance or customer_city or customer_pincode):
        raise ValueError("Provide customer lat/long, or a city, or a pincode.")

    service = get_service_info(service_id)
    if not service or not service.get("required_skill"):
        return []

    # --- Price (service-level) ------------------------------------------
    price_range = service.get("price_range")
    price_low, price_high = parse_price_range(price_range)
    budget_ok, budget_status = check_budget(price_low, price_high, customer_budget)
    if not budget_ok:
        return []

    # --- Skill + availability + verification ----------------------------
    day = _resolve_day(requested_day, requested_date)
    at_time = _resolve_time(requested_time)

    skilled_ids = get_skilled_technician_ids(service["required_skill"])
    available_ids = get_available_technician_ids(day, at_time)
    eligible_ids = list(skilled_ids & available_ids)
    if not eligible_ids:
        return []

    technicians = run_query(
        f"""SELECT technician_id, service_area, latitude, longitude, verification_status
            FROM technicians
            WHERE technician_id IN ({_placeholders(eligible_ids)})
              AND verification_status='Verified'""",
        tuple(eligible_ids), fetch=True
    )

    # --- Location filtering ---------------------------------------------
    city = customer_city.strip().lower() if customer_city else None
    pincode = customer_pincode.strip() if customer_pincode else None

    results = []
    for tech in technicians:
        distance_km = None
        has_coords = tech.get("latitude") is not None and tech.get("longitude") is not None

        if use_distance and has_coords:
            distance_km = haversine_km(customer_lat, customer_lon,
                                       float(tech["latitude"]), float(tech["longitude"]))
            if distance_km > max_distance_km:
                continue
        elif city or pincode:
            area = (tech.get("service_area") or "").lower()
            if not ((city and city in area) or (pincode and pincode in area)):
                continue
        else:
            # Coordinates only were given, but this technician has none -> can't place them.
            continue

        tech["distance_km"] = round(distance_km, 2) if distance_km is not None else None
        results.append(tech)

    if not results:
        return []

    # --- Ratings ----------------------------------------------------------
    stats = get_rating_stats([r["technician_id"] for r in results])

    # --- Scoring ----------------------------------------------------------
    for r in results:
        avg, count = stats.get(r["technician_id"], (None, 0))
        r["average_rating"] = round(avg, 2) if avg is not None else None
        r["review_count"] = count

        if r["distance_km"] is not None:
            # Absolute scale: 0 km -> 1.0, max_distance_km -> 0.0
            dist_score = max(0.0, 1 - r["distance_km"] / max_distance_km)
        else:
            dist_score = UNKNOWN_DISTANCE_SCORE

        rating_score = (avg / 5.0) if avg is not None else NO_REVIEW_RATING_SCORE

        r["match_score"] = round(dist_score * WEIGHT_DISTANCE
                                 + rating_score * WEIGHT_RATING, 4)

        # Service-level price info (same for every technician of this service)
        r["price_range"] = price_range
        r["price_low"] = price_low
        r["price_high"] = price_high
        r["budget_status"] = budget_status

    results.sort(key=lambda r: r["match_score"], reverse=True)
    return results[:limit]
