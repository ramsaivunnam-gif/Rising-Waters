"""
generate_dataset.py

Generates a realistic historical rainfall / flood dataset for the Flood
Prediction System.

Why this exists
----------------
The classic public "India rainfall & floods" datasets (the ones commonly
distributed on Kaggle/data.gov.in) contain, per subdivision and year:
    SUBDIVISION, YEAR, JAN, FEB, MAR, ..., DEC, ANNUAL RAINFALL, FLOODS (YES/NO)

That schema gives a clean binary classification target (FLOODS) but no
continuous target suitable for regression. This script reproduces that
same schema faithfully (monsoon-heavy seasonal rainfall distribution,
per-subdivision climate baselines, year-to-year variability) AND adds a
physically-plausible continuous RIVER_WATER_LEVEL_M column so the system
can train both a classifier (flood yes/no) and a regressor (predicted
water level / risk score) on the same underlying data.

Output: data/raw/rainfall_flood_data.csv
"""

import os
import numpy as np
import pandas as pd

RANDOM_SEED = 42
START_YEAR = 1980
END_YEAR = 2023

MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
          "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

# Subdivisions with distinct climate profiles (mean monsoon intensity mm,
# baseline flood threshold in meters, and variability factor).
# Modeled after real Indian meteorological subdivisions' rainfall character.
SUBDIVISIONS = {
    "KERALA":                 {"annual_base": 2800, "flood_threshold": 4.2, "variability": 0.28},
    "COASTAL ANDHRA PRADESH":  {"annual_base": 1100, "flood_threshold": 3.8, "variability": 0.32},
    "ASSAM & MEGHALAYA":       {"annual_base": 2600, "flood_threshold": 4.5, "variability": 0.30},
    "WEST BENGAL":             {"annual_base": 1700, "flood_threshold": 4.0, "variability": 0.27},
    "BIHAR":                  {"annual_base": 1200, "flood_threshold": 3.6, "variability": 0.33},
    "TAMIL NADU":              {"annual_base": 950,  "flood_threshold": 3.2, "variability": 0.35},
    "GUJARAT REGION":          {"annual_base": 850,  "flood_threshold": 3.0, "variability": 0.40},
    "MADHYA MAHARASHTRA":      {"annual_base": 780,  "flood_threshold": 2.9, "variability": 0.38},
    "EAST UTTAR PRADESH":      {"annual_base": 1000, "flood_threshold": 3.4, "variability": 0.31},
    "ODISHA":                  {"annual_base": 1450, "flood_threshold": 3.9, "variability": 0.29},
}

# Fraction of annual rainfall that falls within the JUN-SEP monsoon window,
# derived from MONTH_WEIGHTS below, so subdivision monsoon baselines stay
# mathematically consistent with the monthly distribution (avoids drift bugs).
MONSOON_SHARE_OF_ANNUAL = 0.145 + 0.190 + 0.175 + 0.140

# Fraction of annual rainfall that typically falls in each month (monsoon-heavy,
# June-Sept peak). These weights are normalized per row with random noise.
MONTH_WEIGHTS = np.array([
    0.015, 0.018, 0.025, 0.035, 0.055,  # Jan-May
    0.145, 0.190, 0.175, 0.140,          # Jun-Sep (monsoon peak)
    0.090, 0.060, 0.052,                 # Oct-Dec
])
MONTH_WEIGHTS = MONTH_WEIGHTS / MONTH_WEIGHTS.sum()


def generate_dataset(start_year=START_YEAR, end_year=END_YEAR, seed=RANDOM_SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []

    for subdivision, profile in SUBDIVISIONS.items():
        annual_base = profile["annual_base"]
        variability = profile["variability"]
        flood_threshold = profile["flood_threshold"]

        for year in range(start_year, end_year + 1):
            # Year-to-year climate variability (e.g. El Nino/La Nina-like cycles)
            cycle_effect = 0.12 * np.sin((year - start_year) / 4.3) 
            annual_rainfall = annual_base * (1 + cycle_effect) * rng.normal(1.0, variability * 0.5)
            annual_rainfall = max(annual_rainfall, annual_base * 0.25)  # floor to avoid negative/degenerate years

            # Distribute annual rainfall across months using monsoon-weighted noise
            month_noise = rng.normal(1.0, 0.18, size=12)
            month_noise = np.clip(month_noise, 0.3, 2.2)
            weights = MONTH_WEIGHTS * month_noise
            weights = weights / weights.sum()
            monthly_values = np.round(annual_rainfall * weights, 1)

            annual_rainfall_computed = round(float(monthly_values.sum()), 1)

            # Continuous regression target: river water level (meters).
            # Driven mainly by monsoon-season rainfall (Jun-Sep), with a
            # baseline for the subdivision and random hydrological noise.
            monsoon_rainfall = monthly_values[5:9].sum()  # JUN, JUL, AUG, SEP
            expected_monsoon = annual_base * MONSOON_SHARE_OF_ANNUAL

            # Water level = a dry-season baseline plus a contribution that
            # scales with how far this year's monsoon rainfall deviates from
            # the subdivision's long-run expected monsoon rainfall. A ratio
            # of 1.0 (an "average" monsoon) sits comfortably below threshold;
            # only unusually heavy monsoons push the level over the top.
            monsoon_ratio = monsoon_rainfall / expected_monsoon
            baseline_level = flood_threshold * 0.30
            rainfall_contribution = (monsoon_ratio - 1.0) * flood_threshold * 0.9 + flood_threshold * 0.45
            hydrological_noise = rng.normal(0, flood_threshold * 0.05)
            water_level = baseline_level + rainfall_contribution + hydrological_noise
            water_level = round(max(water_level, 0.1), 2)

            # Binary classification target: did a flood occur?
            # Probabilistic function of how far water level exceeds threshold,
            # so it's not a hard deterministic cutoff (mirrors real-world noise).
            exceedance = water_level - flood_threshold
            flood_probability = 1 / (1 + np.exp(-6.0 * exceedance))
            flood_occurred = 1 if rng.random() < flood_probability else 0

            row = {
                "SUBDIVISION": subdivision,
                "YEAR": year,
            }
            for month, value in zip(MONTHS, monthly_values):
                row[month] = value
            row["ANNUAL_RAINFALL"] = annual_rainfall_computed
            row["MONSOON_RAINFALL"] = round(float(monsoon_rainfall), 1)
            row["RIVER_WATER_LEVEL_M"] = water_level
            row["FLOOD_THRESHOLD_M"] = flood_threshold
            row["FLOODS"] = "YES" if flood_occurred else "NO"

            rows.append(row)

    df = pd.DataFrame(rows)
    column_order = ["SUBDIVISION", "YEAR"] + MONTHS + [
        "ANNUAL_RAINFALL", "MONSOON_RAINFALL", "RIVER_WATER_LEVEL_M",
        "FLOOD_THRESHOLD_M", "FLOODS"
    ]
    return df[column_order]


def main():
    output_dir = os.path.join(os.path.dirname(__file__), "raw")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "rainfall_flood_data.csv")

    df = generate_dataset()
    df.to_csv(output_path, index=False)

    print(f"Generated {len(df)} rows across {df['SUBDIVISION'].nunique()} subdivisions "
          f"({df['YEAR'].min()}-{df['YEAR'].max()})")
    print(f"Flood rate: {(df['FLOODS'] == 'YES').mean():.2%}")
    print(f"Saved to: {output_path}")


if __name__ == "__main__":
    main()
