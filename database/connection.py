import mysql.connector
from mysql.connector import pooling
from config import Config

_pool = None


def get_pool():
    """Create (once) and return a connection pool shared across the app."""
    global _pool
    if _pool is None:
        _pool = mysql.connector.pooling.MySQLConnectionPool(
            pool_name="hsh_pool",
            pool_size=5,
            host=Config.DB_HOST,
            port=Config.DB_PORT,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
            database=Config.DB_NAME,
        )
    return _pool


def get_db_connection():
    """Grab a connection from the pool. Caller is responsible for closing it
    (use a `with` block or call conn.close() when done — this returns the
    connection to the pool rather than actually dropping it)."""
    return get_pool().get_connection()


def run_query(query, params=None, fetch=False, fetch_one=False, commit=False):
    """Small helper to cut down on boilerplate in route files.

    fetch=True       -> returns list of dict rows
    fetch_one=True    -> returns a single dict row (or None)
    commit=True       -> commits the transaction (for INSERT/UPDATE/DELETE)
    returns the cursor.lastrowid when commit=True and it's an INSERT
    """
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(query, params or ())
        result = None
        if fetch_one:
            result = cursor.fetchone()
        elif fetch:
            result = cursor.fetchall()
        if commit:
            conn.commit()
            result = cursor.lastrowid
        return result
    finally:
        cursor.close()
        conn.close()
