from flask import Flask, jsonify, render_template, send_from_directory
from config import Config
from database.connection import get_pool

from routes.auth import auth_bp
from routes.customer import customer_bp
from routes.technician import technician_bp
from routes.services import services_bp
from routes.admin import admin_bp
from routes.booking import booking_bp
from routes.move import move_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    get_pool()

    app.register_blueprint(auth_bp)
    app.register_blueprint(customer_bp)
    app.register_blueprint(technician_bp)
    app.register_blueprint(services_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(booking_bp)
    app.register_blueprint(move_bp)

    @app.route("/")
    def health_check():
        return jsonify({"status": "HomeService OS backend is running"})

    # ---------------------------------------------------------------
    # Page routes — serve the HTML templates
    # ---------------------------------------------------------------

    @app.route("/admin/dashboard")
    def admin_dashboard_page():
        return render_template("admin/dashboard.html")

    @app.route("/customer")
    def customer_page():
        return render_template("customer/customer.html")

    @app.route("/reviews/submit")
    def review_page():
        return render_template("reviews/submit.html")

    @app.route("/technicians")
    def technicians_page():
        return render_template("technicians/listing.html")

    @app.route("/services")
    def services_catalog_page():
        return render_template("services/catalog.html")

    @app.route("/services/<int:service_id>")
    def services_detail_page(service_id):
        return render_template("services/detail.html")

    @app.route("/technicians")
    def technicians_page():
        return render_template("technicians/listing.html")

    # ---------------------------------------------------------------
    # Serve CSS from styles/css (Flask's default static folder only
    # covers the top-level "static" directory, so this extra route
    # lets templates reference /styles/css/<file>.css)
    # ---------------------------------------------------------------

    @app.route("/styles/css/<path:filename>")
    def styles_css(filename):
        return send_from_directory("styles/css", filename)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
