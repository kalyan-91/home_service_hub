from datetime import timedelta

from flask import Flask, jsonify, render_template, send_from_directory, session, redirect
from flask.json.provider import DefaultJSONProvider
from config import Config
from database.connection import get_pool

from routes.auth import auth_bp
from routes.customer import customer_bp
from routes.technician import technician_bp
from routes.technicians_public import technicians_public_bp
from routes.services import services_bp
from routes.admin import admin_bp
from routes.booking import booking_bp
from routes.move import move_bp
from routes.payments import payments_bp


class CustomJSONProvider(DefaultJSONProvider):
    """MySQL TIME columns come back as timedelta, which Flask can't serialize by default."""

    @staticmethod
    def default(o):
        if isinstance(o, timedelta):
            return str(o)
        return DefaultJSONProvider.default(o)


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.json = CustomJSONProvider(app)

    get_pool()

    app.register_blueprint(auth_bp)
    app.register_blueprint(customer_bp)
    app.register_blueprint(technician_bp)
    app.register_blueprint(technicians_public_bp)
    app.register_blueprint(services_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(booking_bp)
    app.register_blueprint(move_bp)
    app.register_blueprint(payments_bp)

    # Makes {{ current_user_id }} available in every template, so pages can set
    # window.CURRENT_USER_ID = {{ current_user_id | tojson }};
    @app.context_processor
    def inject_user():
        return {"current_user_id": session.get("user_id")}

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

    # Uncomment once templates/technicians/detail.html exists
    # (the technician cards link to /technicians/<id>):
    #
    # @app.route("/technicians/<int:technician_id>")
    # def technician_detail_page(technician_id):
    #     return render_template("technicians/detail.html")

    @app.route("/services")
    def services_catalog_page():
        return render_template("services/catalog.html")

    @app.route("/services/<int:service_id>")
    def services_detail_page(service_id):
        return render_template("services/detail.html")

    @app.route("/bookings")
    def my_bookings_page():
        if "user_id" not in session:
            # No login page yet: show a clear message instead of redirecting to "/".
            # When you have one, use: return redirect("/your-login-url")
            return jsonify({"error": "Please log in first"}), 401
        return render_template("booking/tracker.html")

    @app.route("/payments")
    def payments_page():
        if "user_id" not in session:
            # No login page yet: show a clear message instead of redirecting to "/".
            # When you have one, use: return redirect("/your-login-url")
            return jsonify({"error": "Please log in first"}), 401
        return render_template("payments/summary.html")

    # CHECK: the URL must match the link your service detail page uses to open the
    # wizard (it keeps the ?service_id=... query string, e.g. /bookings/new?service_id=3).
    @app.route("/bookings/new")
    def booking_wizard_page():
        if "user_id" not in session:
            return jsonify({"error": "Please log in first"}), 401
        return render_template("booking/wizard.html")

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
