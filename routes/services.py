from flask import Blueprint, jsonify, request
from database.connection import run_query

services_bp = Blueprint("services", __name__, url_prefix="/api/services")


@services_bp.route("", methods=["GET"])
def list_services():
    """Public catalog browse. Supports ?category=Electrical filtering."""
    category = request.args.get("category")
    if category:
        services = run_query(
            "SELECT * FROM services WHERE category = %s", (category,), fetch_all=True
        )
    else:
        services = run_query("SELECT * FROM services", fetch_all=True)
    return jsonify(services)


@services_bp.route("/<int:service_id>", methods=["GET"])
def get_service(service_id):
    service = run_query(
        "SELECT * FROM services WHERE service_id = %s", (service_id,), fetch_one=True
    )
    if not service:
        return jsonify({"error": "Service not found"}), 404
    return jsonify(service)


@services_bp.route("/categories", methods=["GET"])
def list_categories():
    rows = run_query("SELECT DISTINCT category FROM services", fetch_all=True)
    return jsonify([r["category"] for r in rows])
