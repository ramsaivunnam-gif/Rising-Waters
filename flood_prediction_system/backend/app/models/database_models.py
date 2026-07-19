"""
SQLAlchemy ORM models for the Flood Prediction System.

Two tables:
- HistoricalRecord: the rainfall/flood historical dataset (seeded from CSV)
- PredictionLog: every prediction made through the API, for audit/history
"""

from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class HistoricalRecord(db.Model):
    """Historical rainfall & flood records, one row per subdivision-year."""

    __tablename__ = "historical_records"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    subdivision = db.Column(db.String(100), nullable=False, index=True)
    year = db.Column(db.Integer, nullable=False, index=True)

    jan = db.Column(db.Float, nullable=False)
    feb = db.Column(db.Float, nullable=False)
    mar = db.Column(db.Float, nullable=False)
    apr = db.Column(db.Float, nullable=False)
    may = db.Column(db.Float, nullable=False)
    jun = db.Column(db.Float, nullable=False)
    jul = db.Column(db.Float, nullable=False)
    aug = db.Column(db.Float, nullable=False)
    sep = db.Column(db.Float, nullable=False)
    oct = db.Column(db.Float, nullable=False)
    nov = db.Column(db.Float, nullable=False)
    dec = db.Column(db.Float, nullable=False)

    annual_rainfall = db.Column(db.Float, nullable=False)
    monsoon_rainfall = db.Column(db.Float, nullable=False)
    river_water_level_m = db.Column(db.Float, nullable=False)
    flood_threshold_m = db.Column(db.Float, nullable=False)
    flood_occurred = db.Column(db.Boolean, nullable=False, default=False)

    __table_args__ = (
        db.UniqueConstraint("subdivision", "year", name="uq_subdivision_year"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "subdivision": self.subdivision,
            "year": self.year,
            "monthly_rainfall": {
                "jan": self.jan, "feb": self.feb, "mar": self.mar, "apr": self.apr,
                "may": self.may, "jun": self.jun, "jul": self.jul, "aug": self.aug,
                "sep": self.sep, "oct": self.oct, "nov": self.nov, "dec": self.dec,
            },
            "annual_rainfall": self.annual_rainfall,
            "monsoon_rainfall": self.monsoon_rainfall,
            "river_water_level_m": self.river_water_level_m,
            "flood_threshold_m": self.flood_threshold_m,
            "flood_occurred": self.flood_occurred,
        }


class PredictionLog(db.Model):
    """Every prediction request/response made through the API."""

    __tablename__ = "prediction_logs"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    subdivision = db.Column(db.String(100), nullable=False)

    # Input features supplied by the caller
    input_monsoon_rainfall = db.Column(db.Float, nullable=False)
    input_annual_rainfall = db.Column(db.Float, nullable=False)
    input_month = db.Column(db.Integer, nullable=True)

    # Model outputs
    predicted_flood_risk = db.Column(db.String(20), nullable=False)   # "LOW"/"MODERATE"/"HIGH"/"SEVERE"
    predicted_flood_probability = db.Column(db.Float, nullable=False)  # 0..1 from classifier
    predicted_water_level_m = db.Column(db.Float, nullable=False)      # from regressor
    flood_threshold_m = db.Column(db.Float, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat(),
            "subdivision": self.subdivision,
            "input": {
                "monsoon_rainfall": self.input_monsoon_rainfall,
                "annual_rainfall": self.input_annual_rainfall,
                "month": self.input_month,
            },
            "prediction": {
                "flood_risk": self.predicted_flood_risk,
                "flood_probability": self.predicted_flood_probability,
                "predicted_water_level_m": self.predicted_water_level_m,
                "flood_threshold_m": self.flood_threshold_m,
            },
        }
