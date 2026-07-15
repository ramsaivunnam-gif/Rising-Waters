"""
Application configuration.

Loads settings from environment variables (via a .env file if present)
and exposes a single Config object used by the Flask app factory.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Project root is three levels up from this file: backend/app/config.py -> project root
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Load .env from project root if it exists
load_dotenv(BASE_DIR / ".env")


def _bool_env(key: str, default: bool = False) -> bool:
    value = os.environ.get(key)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


class Config:
    """Base configuration shared across environments."""

    # Core Flask settings
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
    DEBUG = _bool_env("DEBUG", False)

    # Server
    HOST = os.environ.get("HOST", "0.0.0.0")
    PORT = int(os.environ.get("PORT", 5000))

    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", f"sqlite:///{BASE_DIR / 'flood_prediction.db'}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # CORS
    CORS_ORIGINS = os.environ.get(
        "CORS_ORIGINS", "http://localhost:5000,http://127.0.0.1:5000"
    ).split(",")

    # ML artifact paths (resolved relative to project root)
    CLASSIFIER_MODEL_PATH = str(
        BASE_DIR / os.environ.get("CLASSIFIER_MODEL_PATH", "ml/artifacts/flood_classifier.joblib")
    )
    REGRESSOR_MODEL_PATH = str(
        BASE_DIR / os.environ.get("REGRESSOR_MODEL_PATH", "ml/artifacts/flood_regressor.joblib")
    )
    FEATURE_SCALER_PATH = str(
        BASE_DIR / os.environ.get("FEATURE_SCALER_PATH", "ml/artifacts/feature_scaler.joblib")
    )
    LABEL_ENCODER_PATH = str(
        BASE_DIR / os.environ.get("LABEL_ENCODER_PATH", "ml/artifacts/subdivision_encoder.joblib")
    )

    # Data paths
    RAW_DATA_PATH = str(BASE_DIR / "data" / "raw" / "rainfall_flood_data.csv")
    PROCESSED_DATA_PATH = str(BASE_DIR / "data" / "processed" / "rainfall_flood_processed.csv")


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"


config_by_name = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}


def get_config():
    env = os.environ.get("FLASK_ENV", "production").lower()
    return config_by_name.get(env, ProductionConfig)
