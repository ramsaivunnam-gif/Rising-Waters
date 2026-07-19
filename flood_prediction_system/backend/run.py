"""
Application entry point.

Local development:
    python backend/run.py

Production (recommended):
    gunicorn -w 4 -b 0.0.0.0:5000 "backend.run:app"
"""

import sys
from pathlib import Path

# Ensure the project root is importable when running this file directly
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.app import create_app  # noqa: E402

app = create_app()

if __name__ == "__main__":
    app.run(
        host=app.config.get("HOST", "0.0.0.0"),
        port=app.config.get("PORT", 5000),
        debug=app.config.get("DEBUG", False),
    )
