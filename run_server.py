"""Entrypoint script for DCLM Field Utility server."""
from __future__ import annotations

import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fasthtml.common import serve
from app.core.config import HOST, PORT
from app.presentation.app_factory import create_app

app = create_app()

if __name__ == "__main__":
    print(f"Starting DCLM Field Utility on http://{HOST}:{PORT}")
    serve(port=PORT, host=HOST)
