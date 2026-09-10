import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Flask + MySQL configuration. Values come from environment variables
    so real credentials never get committed to GitHub."""

    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")

    # Primary DB config
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = int(os.getenv("DB_PORT", "3306"))
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "home_service_hub")

    # Aliases — in case any file imports these names instead
    MYSQL_HOST = DB_HOST
    MYSQL_USER = DB_USER
    MYSQL_PASSWORD = DB_PASSWORD
    MYSQL_DB = DB_NAME
    MYSQL_PORT = DB_PORT

    SESSION_TYPE = "filesystem"

    # Nearby matching default search radius in kilometers
    MATCH_RADIUS_KM = float(os.getenv("MATCH_RADIUS_KM", "15"))
