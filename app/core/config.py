"""Application Configuration."""
from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")

APP_NAME = os.getenv("APP_NAME", "DCLM Field Utility")
APP_ENV = os.getenv("APP_ENV", "development")
PORT = int(os.getenv("PORT", "5098"))
HOST = os.getenv("HOST", "127.0.0.1")

# Backend URLs
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "https://dclm-admin-app.fastapicloud.dev")
BACKEND_LOCAL_API_URL = os.getenv("BACKEND_LOCAL_API_URL", "http://127.0.0.1:8000")
API_TIMEOUT_SECONDS = int(os.getenv("API_TIMEOUT_SECONDS", "15"))
