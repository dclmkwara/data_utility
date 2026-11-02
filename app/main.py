"""FastAPI Cloud ASGI entrypoint wrapping the existing FastHTML application."""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from .core.config import APP_ENV, APP_NAME
from .presentation.app_factory import create_app
from .services.auth_session import validate_session_configuration

fasthtml_app = create_app()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Fail startup early when a production deployment lacks its stable key."""
    if APP_ENV.lower() in {"production", "prod"}:
        validate_session_configuration()
    yield


app = FastAPI(
    title=APP_NAME,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)


@app.get("/health", include_in_schema=False)
async def health() -> dict[str, str]:
    return {"status": "ok", "app": APP_NAME, "version": "1.0.0"}


# FastHTML remains responsible for all existing HTML, API proxy, and asset routes.
app.mount("/", fasthtml_app)
