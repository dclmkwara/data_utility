"""Encrypted, HttpOnly browser session for delegated Church_server tokens."""
from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
from pathlib import Path
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from ..core.config import APP_ENV, BASE_DIR

SESSION_COOKIE = "dclm_utility_session"
SESSION_TTL_SECONDS = 30 * 24 * 60 * 60


def _fernet() -> Fernet:
    configured = os.getenv("UTILITY_SESSION_KEY")
    if configured:
        seed = configured.encode("utf-8")
    else:
        if APP_ENV.lower() in {"production", "prod"}:
            raise RuntimeError("UTILITY_SESSION_KEY must be configured in production")
        key_file = BASE_DIR / ".sesskey"
        try:
            seed = key_file.read_bytes().strip()
        except OSError:
            seed = secrets.token_bytes(48)
            flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
            fd = os.open(key_file, flags, 0o600)
            with os.fdopen(fd, "wb") as key_handle:
                key_handle.write(seed)
        if not seed:
            raise RuntimeError("Local session key file is empty")
    derived = hashlib.sha256(b"dclm-field-utility-session-v1:" + seed).digest()
    return Fernet(base64.urlsafe_b64encode(derived))


def validate_session_configuration() -> None:
    """Validate encryption-key availability during production startup."""
    _fernet()


def encode_session(access_token: str, refresh_token: str, user: dict[str, Any]) -> str:
    payload = json.dumps(
        {"access_token": access_token, "refresh_token": refresh_token, "user": user},
        separators=(",", ":"),
    ).encode("utf-8")
    return _fernet().encrypt(payload).decode("ascii")


def decode_session(value: str | None) -> dict[str, Any] | None:
    if not value:
        return None
    try:
        payload = _fernet().decrypt(value.encode("ascii"), ttl=SESSION_TTL_SECONDS)
        session = json.loads(payload)
    except (InvalidToken, UnicodeEncodeError, json.JSONDecodeError, TypeError, ValueError):
        return None
    if not isinstance(session, dict) or not session.get("access_token") or not session.get("refresh_token"):
        return None
    return session


def set_session_cookie(response: Any, value: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        value,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=APP_ENV.lower() in {"production", "prod"},
        samesite="strict",
        path="/",
    )


def clear_session_cookie(response: Any) -> None:
    response.delete_cookie(
        SESSION_COOKIE,
        httponly=True,
        secure=APP_ENV.lower() in {"production", "prod"},
        samesite="strict",
        path="/",
    )


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    """Return only the identity fields needed by the browser UI."""
    roles = user.get("roles") or []
    return {
        "user_id": str(user.get("user_id") or ""),
        "worker_id": str(user.get("worker_id") or ""),
        "name": str(user.get("name") or "Church worker"),
        "email": str(user.get("email") or ""),
        "location_id": str(user.get("location_id") or ""),
        "church_type": str(user.get("church_type") or "DCLM"),
        "roles": [str(role.get("role_name") or role.get("name") or "") for role in roles if isinstance(role, dict)],
        "permissions": [str(item) for item in (user.get("permissions") or [])],
    }
