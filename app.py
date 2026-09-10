from flask import Flask, jsonify
from config import Config
from database.connection import init_pool

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

    init_pool()

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

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
