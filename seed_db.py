"""
seed_db.py

Loads data/raw/rainfall_flood_data.csv into the historical_records table.
Safe to re-run: it clears and re-seeds the table each time (idempotent).

Usage:
    python -m backend.app.utils.seed_db
(run from the project root, with the virtualenv activated)
"""

import sys
from pathlib import Path

import pandas as pd

# Allow running this file directly as a script
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.app import create_app
from backend.app.models.database_models import db, HistoricalRecord


def seed_from_csv(csv_path: str = None):
    if csv_path is None:
        csv_path = str(PROJECT_ROOT / "data" / "raw" / "rainfall_flood_data.csv")

    df = pd.read_csv(csv_path)

    app = create_app()
    with app.app_context():
        db.create_all()

        deleted = db.session.query(HistoricalRecord).delete()
        db.session.commit()
        print(f"Cleared {deleted} existing historical records.")

        records = []
        for _, row in df.iterrows():
            record = HistoricalRecord(
                subdivision=row["SUBDIVISION"],
                year=int(row["YEAR"]),
                jan=float(row["JAN"]), feb=float(row["FEB"]), mar=float(row["MAR"]),
                apr=float(row["APR"]), may=float(row["MAY"]), jun=float(row["JUN"]),
                jul=float(row["JUL"]), aug=float(row["AUG"]), sep=float(row["SEP"]),
                oct=float(row["OCT"]), nov=float(row["NOV"]), dec=float(row["DEC"]),
                annual_rainfall=float(row["ANNUAL_RAINFALL"]),
                monsoon_rainfall=float(row["MONSOON_RAINFALL"]),
                river_water_level_m=float(row["RIVER_WATER_LEVEL_M"]),
                flood_threshold_m=float(row["FLOOD_THRESHOLD_M"]),
                flood_occurred=(row["FLOODS"] == "YES"),
            )
            records.append(record)

        db.session.bulk_save_objects(records)
        db.session.commit()
        print(f"Seeded {len(records)} historical records into the database.")


if __name__ == "__main__":
    seed_from_csv()
