"""
Flask application factory.

This module wires together configuration, the database, CORS, and
(in later modules) blueprints for the prediction, history, and dashboard
APIs. Kept as a factory function (`create_app`) so tests and scripts
(e.g. the DB seed script) can spin up an app instance without running
a live server.
"""

from flask import Flask, jsonify
from flask_cors import CORS

from backend.app.config import get_config
from backend.app.models.database_models import db


def create_app(config_object=None):
    app = Flask(__name__)

    if config_object is None:
        config_object = get_config()
    app.config.from_object(config_object)

    # --- Extensions ---
    db.init_app(app)
    CORS(app, origins=app.config.get("CORS_ORIGINS", ["*"]))

    # --- Blueprints (registered here as they are built module by module) ---
    _register_blueprints(app)

    # --- Infrastructure routes ---
    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "ok",
            "service": "flood-prediction-api",
        }), 200

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": "Not found", "message": str(error)}), 404

    @app.errorhandler(500)
    def server_error(error):
        return jsonify({"error": "Internal server error", "message": str(error)}), 500

    return app


def _register_blueprints(app):
    """
    Registers all Flask blueprints. Populated incrementally as backend
    modules are built. Left as a real function (not a stub) so it can be
    called safely right now with zero blueprints registered.
    """
    registered = []

    try:
        from backend.app.routes.prediction_routes import prediction_bp
        app.register_blueprint(prediction_bp, url_prefix="/api/predict")
        registered.append("prediction_bp")
    except ImportError:
        pass

    try:
        from backend.app.routes.history_routes import history_bp
        app.register_blueprint(history_bp, url_prefix="/api/history")
        registered.append("history_bp")
    except ImportError:
        pass

    try:
        from backend.app.routes.dashboard_routes import dashboard_bp
        app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
        registered.append("dashboard_bp")
    except ImportError:
        pass

    try:
        from backend.app.routes.views import views_bp
        app.register_blueprint(views_bp)
        registered.append("views_bp")
    except ImportError:
        pass

    app.config["_REGISTERED_BLUEPRINTS"] = registered
