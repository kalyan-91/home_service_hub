import os
from dotenv import load_dotenv

load_dotenv()


def _get_int(key, default):
    value = os.getenv(key, "").strip()
    return int(value) if value else default


def _get_float(key, default):
    value = os.getenv(key, "").strip()
    return float(value) if value else default


def _get_str(key, default):
    value = os.getenv(key, "").strip()
    return value if value else default


class Config:
    """Flask + MySQL configuration. Values come from environment variables
    so real credentials never get committed to GitHub."""

    SECRET_KEY = _get_str("SECRET_KEY", "dev-secret-change-me")

    # Primary DB config
    DB_HOST = _get_str("DB_HOST", "localhost")
    DB_PORT = _get_int("DB_PORT", 3306)
    DB_USER = _get_str("DB_USER", "root")
    DB_PASSWORD = _get_str("DB_PASSWORD", "")
    DB_NAME = _get_str("DB_NAME", "home_service_hub")

    # Aliases — in case any file imports these names instead
    MYSQL_HOST = DB_HOST
    MYSQL_USER = DB_USER
    MYSQL_PASSWORD = DB_PASSWORD
    MYSQL_DB = DB_NAME
    MYSQL_PORT = DB_PORT

    SESSION_TYPE = "filesystem"

    # Nearby matching default search radius in kilometers
    MATCH_RADIUS_KM = _get_float("MATCH_RADIUS_KM", 15)
