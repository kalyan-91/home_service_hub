import pandas as pd
from database.connection import run_query


def _stats_from_series(series):
    """Common descriptive stats for a numeric pandas Series."""
    if series.empty:
        return {"mean": None, "median": None, "mode": None, "std_dev": None,
                "variance": None, "q1": None, "q3": None}
    return {
        "mean": round(series.mean(), 2),
        "median": round(series.median(), 2),
        "mode": round(series.mode().iloc[0], 2) if not series.mode().empty else None,
        "std_dev": round(series.std(), 2) if len(series) > 1 else 0,
        "variance": round(series.var(), 2) if len(series) > 1 else 0,
        "q1": round(series.quantile(0.25), 2),
        "q3": round(series.quantile(0.75), 2),
    }


def customer_statistics(customer_id):
    rows = run_query(
        """SELECT b.booking_id, b.service_cost, b.booking_date
           FROM bookings b
           WHERE b.customer_id = %s AND b.status = 'Completed'""",
        (customer_id,), fetch=True
    ) or []
    df = pd.DataFrame(rows)
    if df.empty:
        return {"total_services": 0, "total_spending": 0, "average_cost": 0, "monthly_expenses": {}}

    df["booking_date"] = pd.to_datetime(df["booking_date"])
    monthly = df.groupby(df["booking_date"].dt.to_period("M"))["service_cost"].sum()

    return {
        "total_services": len(df),
        "total_spending": round(df["service_cost"].sum(), 2),
        "average_cost": round(df["service_cost"].mean(), 2),
        "monthly_expenses": {str(k): round(v, 2) for k, v in monthly.items()},
        "cost_stats": _stats_from_series(df["service_cost"]),
    }


def technician_statistics(technician_id):
    bookings = run_query(
        """SELECT booking_id, status, service_cost FROM bookings WHERE technician_id = %s""",
        (technician_id,), fetch=True
    ) or []
    reviews = run_query(
        """SELECT rating FROM reviews WHERE technician_id = %s""",
        (technician_id,), fetch=True
    ) or []

    df_bookings = pd.DataFrame(bookings)
    df_reviews = pd.DataFrame(reviews)

    completed = df_bookings[df_bookings["status"] == "Completed"] if not df_bookings.empty else df_bookings
    cancelled = df_bookings[df_bookings["status"] == "Cancelled"] if not df_bookings.empty else df_bookings
    total = len(df_bookings)

    return {
        "jobs_completed": len(completed),
        "average_rating": round(df_reviews["rating"].mean(), 2) if not df_reviews.empty else None,
        "cancellation_rate": round(len(cancelled) / total * 100, 2) if total else 0,
        "total_earnings": round(completed["service_cost"].sum(), 2) if not completed.empty else 0,
    }


def admin_statistics(filters=None):
    """filters: optional dict with keys like start_date, end_date, service_id,
    location, technician_id, status — extend the WHERE clause as needed."""
    customers = run_query("SELECT COUNT(*) AS c FROM users WHERE role='customer'", fetch_one=True)
    technicians = run_query("SELECT COUNT(*) AS c FROM users WHERE role='technician'", fetch_one=True)
    bookings = run_query("SELECT status, service_cost, booking_date FROM bookings", fetch=True) or []

    df = pd.DataFrame(bookings)
    total_bookings = len(df)
    completed = df[df["status"] == "Completed"] if not df.empty else df
    cancelled = df[df["status"] == "Cancelled"] if not df.empty else df

    popular = run_query(
        """SELECT service_id, COUNT(*) AS bookings_count
           FROM bookings GROUP BY service_id ORDER BY bookings_count DESC LIMIT 5""",
        fetch=True
    ) or []

    return {
        "total_customers": customers["c"] if customers else 0,
        "total_technicians": technicians["c"] if technicians else 0,
        "total_bookings": total_bookings,
        "completed_bookings": len(completed),
        "cancelled_bookings": len(cancelled),
        "total_revenue": round(completed["service_cost"].sum(), 2) if not completed.empty else 0,
        "average_booking_value": round(df["service_cost"].mean(), 2) if not df.empty else 0,
        "popular_services": popular,
    }
