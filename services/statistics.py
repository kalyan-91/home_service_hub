import pandas as pd
from scipy import stats as scipy_stats
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


# ---------------------------------------------------------------
# Correlation, regression, and hypothesis testing
# ---------------------------------------------------------------

def cost_vs_rating_correlation():
    """Correlation between service_cost and the rating that booking received.
    Answers: do more expensive services tend to get better/worse reviews?
    Returns Pearson correlation coefficient (-1 to 1) and p-value.
    """
    rows = run_query(
        """SELECT b.service_cost, r.rating
           FROM bookings b
           JOIN reviews r ON r.booking_id = b.booking_id
           WHERE b.status = 'Completed'""",
        fetch=True
    ) or []
    df = pd.DataFrame(rows)
    if len(df) < 3:
        return {"error": "Not enough data points (need at least 3 completed+reviewed bookings)"}

    correlation, p_value = scipy_stats.pearsonr(df["service_cost"], df["rating"])
    return {
        "sample_size": len(df),
        "correlation_coefficient": round(correlation, 3),
        "p_value": round(p_value, 4),
        "interpretation": (
            "statistically significant" if p_value < 0.05 else "not statistically significant"
        ),
    }


def revenue_trend_regression():
    """Simple linear regression of monthly revenue over time.
    Returns slope (revenue change per month), intercept, R², and a
    naive next-month prediction.
    """
    rows = run_query(
        "SELECT booking_date, service_cost FROM bookings WHERE status='Completed'",
        fetch=True
    ) or []
    df = pd.DataFrame(rows)
    if df.empty:
        return {"error": "No completed bookings to analyze"}

    df["booking_date"] = pd.to_datetime(df["booking_date"])
    monthly = df.groupby(df["booking_date"].dt.to_period("M"))["service_cost"].sum().reset_index()
    if len(monthly) < 3:
        return {"error": "Not enough months of data (need at least 3)"}

    monthly["month_index"] = range(len(monthly))
    slope, intercept, r_value, p_value, std_err = scipy_stats.linregress(
        monthly["month_index"], monthly["service_cost"]
    )
    next_month_prediction = slope * len(monthly) + intercept

    return {
        "months_analyzed": len(monthly),
        "slope_revenue_per_month": round(slope, 2),
        "intercept": round(intercept, 2),
        "r_squared": round(r_value ** 2, 3),
        "p_value": round(p_value, 4),
        "next_month_prediction": round(next_month_prediction, 2),
    }


def compare_technician_ratings(technician_id_a, technician_id_b):
    """Independent-samples t-test comparing two technicians' ratings.
    Answers: is the difference in their average ratings statistically
    significant, or could it just be random variation?
    """
    ratings_a = run_query(
        "SELECT rating FROM reviews WHERE technician_id=%s", (technician_id_a,), fetch=True
    ) or []
    ratings_b = run_query(
        "SELECT rating FROM reviews WHERE technician_id=%s", (technician_id_b,), fetch=True
    ) or []

    series_a = pd.Series([r["rating"] for r in ratings_a])
    series_b = pd.Series([r["rating"] for r in ratings_b])

    if len(series_a) < 2 or len(series_b) < 2:
        return {"error": "Each technician needs at least 2 reviews to compare"}

    t_stat, p_value = scipy_stats.ttest_ind(series_a, series_b, equal_var=False)

    return {
        "technician_a": {"id": technician_id_a, "mean_rating": round(series_a.mean(), 2), "n": len(series_a)},
        "technician_b": {"id": technician_id_b, "mean_rating": round(series_b.mean(), 2), "n": len(series_b)},
        "t_statistic": round(t_stat, 3),
        "p_value": round(p_value, 4),
        "significant_difference": p_value < 0.05,
    }


def service_category_anova():
    """One-way ANOVA: does average service_cost differ significantly
    across service categories?
    """
    rows = run_query(
        """SELECT s.category, b.service_cost
           FROM bookings b
           JOIN services s ON s.service_id = b.service_id
           WHERE b.status = 'Completed'""",
        fetch=True
    ) or []
    df = pd.DataFrame(rows)
    if df.empty or df["category"].nunique() < 2:
        return {"error": "Need completed bookings across at least 2 service categories"}

    groups = [group["service_cost"].values for _, group in df.groupby("category")]
    groups = [g for g in groups if len(g) >= 2]
    if len(groups) < 2:
        return {"error": "Need at least 2 categories with 2+ bookings each"}

    f_stat, p_value = scipy_stats.f_oneway(*groups)

    return {
        "categories_compared": df["category"].nunique(),
        "f_statistic": round(f_stat, 3),
        "p_value": round(p_value, 4),
        "significant_difference": p_value < 0.05,
    }
