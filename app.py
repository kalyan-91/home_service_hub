from flask import Flask, jsonify
from config import Config

from routes.admin import admin_bp
from routes.booking import booking_bp
from routes.move import move_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

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
