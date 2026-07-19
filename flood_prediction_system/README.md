# Flood Prediction System

A production-oriented system for predicting flood risk from rainfall data,
combining a classification model (flood / no flood) and a regression model
(predicted river water level) behind a Flask API, with a Chart.js dashboard.

## Project Status

Built module by module, with sign-off between each module.

- [x] **Module 1 — Project Scaffold & Data Layer**
- [x] **Module 2 — Frontend Dashboard** (this module)
- [ ] Module 3 — ML Prediction Model
- [ ] Module 4 — Flask Backend API
- [ ] Module 5 — Integration & Deployment

## Module 2 — Frontend Dashboard

Full "Hydro Telemetry" themed dashboard: Bootstrap 5 + custom glassmorphism,
dark/light mode, Chart.js, a signature animated water-level gauge, and 9
complete pages. Design plan and rationale are in the chat response; summary:

- **Palette:** Abyss `#060B16` bg, Deep Slate `#0D1830` panels, Current
  `#21C7C0` primary teal, plus a 4-tier risk scale (green/amber/orange/red).
- **Type:** Space Grotesk (display), Inter (body), IBM Plex Mono (data/stats).
- **Signature element:** the vertical gauge tube with an animated liquid
  fill rising toward a dashed threshold line — used on the home hero,
  predict/result flow, and repeated as a motif.

### Pages
`base.html` (navbar, footer, loading screen, theme toggle) →
`home.html`, `about.html`, `predict.html`, `result.html`, `history.html`,
`performance.html`, `contact.html`, `404.html`.

### API contract the frontend expects (build these in Module 4)
```
GET  /api/health
POST /api/predict            { subdivision, year, month, annual_rainfall, monsoon_rainfall }
                              -> { subdivision, flood_risk, flood_probability, predicted_water_level_m, flood_threshold_m }
GET  /api/history             ?subdivision=&year_from=&year_to=  -> { records: [...] }
GET  /api/history/trend       ?subdivision=  -> { years: [...], rainfall: [...], water_level: [...] }
GET  /api/history/flood-frequency -> { labels: [...], values: [...] }
GET  /api/dashboard/model-performance -> { classification: {...}, regression: {...}, confusion: {...}, featureImportance: [...] }
POST /api/contact             { name, email, subject, message }
```
**Every page works right now without the backend running.** Each fetch call
in `main.js`/`predict.js`/`charts.js` catches failures and falls back to a
clearly-labeled demo dataset (a toast says "offline demo estimate" /
"showing demo historical data") so the UI is fully clickable and testable
before Module 4 exists. Once the real endpoints are live, everything
switches over automatically — no frontend changes needed, as long as the
response shapes above are matched.

### Verified
- All 8 content templates + `base.html` render through Flask/Jinja with
  zero errors (checked via `render_template` in a throwaway app context).
- Every `url_for('static', ...)` reference in every template resolves to a
  file that actually exists on disk (checked programmatically).
- All 3 JS files pass `node --check` (syntax valid).
- All 3 CSS files have balanced braces.
- No TODO/FIXME/placeholder markers or empty files anywhere in `frontend/`.

## Project Structure

```
flood_prediction_system/
├── backend/
│   ├── run.py                     # App entry point (dev server / gunicorn target)
│   └── app/
│       ├── __init__.py            # Flask app factory (create_app)
│       ├── config.py              # Environment-driven configuration
│       ├── models/
│       │   └── database_models.py # SQLAlchemy models (HistoricalRecord, PredictionLog)
│       ├── routes/                # Flask blueprints (populated in Module 4)
│       ├── services/              # Business logic / ML inference glue (Module 3-4)
│       └── utils/
│           └── seed_db.py         # Loads CSV data into the database
├── data/
│   ├── generate_dataset.py        # Generates the historical rainfall/flood dataset
│   ├── raw/
│   │   └── rainfall_flood_data.csv
│   └── processed/                 # Cleaned/feature-engineered data (Module 3)
├── ml/
│   ├── training/                  # Model training scripts (Module 3)
│   └── artifacts/                 # Saved model files (.joblib) (Module 3)
├── frontend/
│   ├── templates/                 # Jinja2 / HTML pages (Module 5)
│   └── static/{css,js,img}/       # Dashboard assets (Module 5)
├── tests/
├── docs/
├── requirements.txt
├── .env.example
└── .gitignore
```

## Module 1 — What Was Built

### 1. Dataset (`data/generate_dataset.py`)
Generates a historical rainfall/flood dataset that follows the same schema
as the well-known public India rainfall-flood datasets:

```
SUBDIVISION, YEAR, JAN..DEC, ANNUAL_RAINFALL, MONSOON_RAINFALL,
RIVER_WATER_LEVEL_M, FLOOD_THRESHOLD_M, FLOODS (YES/NO)
```

Why generated rather than downloaded: this environment has no live
internet access, so a direct Kaggle/data.gov.in download isn't possible
here. Instead this script reproduces the same structure and monsoon-driven
seasonal pattern using per-subdivision climate profiles (10 Indian
meteorological subdivisions, 1980–2023), with:

- Realistic monsoon-heavy monthly rainfall distribution (Jun–Sep peak)
- Year-to-year climate variability (cyclical + random noise)
- A synthesized **continuous** `RIVER_WATER_LEVEL_M` field (the classic
  public dataset only has a binary flood label — we add this so the
  system can train a **regressor**, not just a classifier)
- A **probabilistic** flood label (logistic function of water level vs.
  threshold, not a hard cutoff) so the classification task has realistic
  noise instead of being trivially separable

**Validated output:** 440 rows, 10 subdivisions, 12.95% overall flood rate
(varies 4.5%–18.2% by subdivision — matches real-world flood frequency),
zero nulls, and only a moderate correlation (0.48) between water level and
the flood label — meaning there's real signal for a model to learn, not a
label that just leaks from one input column.

If you have a specific real dataset (Kaggle CSV, government data, your own
sensor data) you'd rather use instead, drop the file in `data/raw/` and
Module 3's training script can be pointed at it.

### 2. Database Layer (`backend/app/models/database_models.py`)
- `HistoricalRecord` — one row per subdivision/year, mirrors the CSV
- `PredictionLog` — every prediction served by the API, for history/audit

### 3. Seed Script (`backend/app/utils/seed_db.py`)
Idempotently loads the CSV into `HistoricalRecord`. Re-runnable safely.

### 4. Flask App Factory (`backend/app/__init__.py`, `backend/run.py`)
A real, running Flask app (not a stub) with:
- Environment-based config (`backend/app/config.py`)
- SQLAlchemy + CORS initialized
- `/api/health` endpoint
- JSON 404/500 error handlers
- Blueprint auto-registration that will pick up Module 4's routes with zero
  changes to this file

**Verified working** (health check returns `200 {"status": "ok", ...}`,
404 handler returns proper JSON) via an automated smoke test.

## Setup

```bash
# 1. Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy environment config
cp .env.example .env

# 4. Generate the dataset (if not already present)
python data/generate_dataset.py

# 5. Seed the database
python -m backend.app.utils.seed_db

# 6. Run the dev server
python backend/run.py
# -> visit http://localhost:5000/api/health
```

## Tech Stack

- **Backend:** Flask, Flask-SQLAlchemy, Flask-CORS
- **ML:** scikit-learn (classification + regression), pandas, numpy, joblib
- **Frontend:** HTML/CSS/JS + Chart.js
- **Database:** SQLite (dev) — swap `DATABASE_URL` for PostgreSQL in production
