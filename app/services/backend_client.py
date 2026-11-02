"""Backend HTTP Client for communicating with Church_server FastAPI endpoints."""
from __future__ import annotations

import logging
from typing import Any
import httpx

from ..core.config import API_TIMEOUT_SECONDS, BACKEND_API_URL, BACKEND_LOCAL_API_URL

logger = logging.getLogger(__name__)


class BackendAPIError(RuntimeError):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class BackendClient:
    """Communicates directly with FastAPI backend for workers, metadata, and sync."""

    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (base_url or BACKEND_API_URL).rstrip("/")
        self.local_url = BACKEND_LOCAL_API_URL.rstrip("/")
        self.timeout = API_TIMEOUT_SECONDS

    async def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        """Attempts cloud endpoint first, falling back to local backend if configured."""
        targets = [self.base_url]
        if self.local_url and self.local_url != self.base_url:
            targets.append(self.local_url)

        last_error = None
        for target in targets:
            url = f"{target}{path}"
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.request(method, url, **kwargs)
                    return resp
            except Exception as exc:
                last_error = exc
                logger.warning("Failed request to %s: %s", url, exc)

        raise RuntimeError(f"All backend targets unreachable. Last error: {last_error}")

    @staticmethod
    def _raise_for_error(resp: httpx.Response) -> None:
        if resp.is_success:
            return
        try:
            body = resp.json()
            detail = body.get("detail") or body.get("error") or resp.text
        except (ValueError, AttributeError):
            detail = resp.text
        raise BackendAPIError(resp.status_code, str(detail)[:500])

    async def login(self, username: str, password: str) -> dict[str, Any]:
        resp = await self._request(
            "POST",
            "/api/v1/auth/login",
            data={"username": username, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        self._raise_for_error(resp)
        return resp.json()

    async def get_current_user(self, access_token: str) -> dict[str, Any]:
        resp = await self._request(
            "GET",
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        self._raise_for_error(resp)
        return resp.json()

    async def get_location(self, location_id: str, access_token: str) -> dict[str, Any]:
        """Fetch the authenticated user's location metadata by its backend UUID."""
        resp = await self._request(
            "GET", f"/api/v1/locations/{location_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        self._raise_for_error(resp)
        data = resp.json()
        if not isinstance(data, dict):
            raise BackendAPIError(502, "Church_server returned invalid location metadata")
        return data

    async def get_fellowships(self, location_id: str, access_token: str) -> list[dict[str, Any]]:
        resp = await self._request(
            "GET", "/api/v1/fellowships/",
            params={"location_id": location_id, "limit": 500},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        self._raise_for_error(resp)
        data = resp.json()
        if not isinstance(data, list):
            raise BackendAPIError(502, "Church_server returned invalid fellowship data")
        return data

    async def refresh(self, refresh_token: str) -> dict[str, Any]:
        resp = await self._request(
            "POST",
            "/api/v1/auth/refresh",
            headers={"Authorization": f"Bearer {refresh_token}"},
        )
        self._raise_for_error(resp)
        return resp.json()

    async def logout(self, refresh_token: str) -> None:
        resp = await self._request(
            "POST",
            "/api/v1/auth/logout",
            json={"refresh_token": refresh_token},
        )
        self._raise_for_error(resp)

    async def get_workers(self, location_id: str, access_token: str) -> list[dict[str, Any]]:
        """Fetch worker roster from FastAPI backend GET /api/v1/attendance/workers."""
        resp = await self._request(
            "GET",
            "/api/v1/attendance/workers",
            params={"location_id": location_id, "limit": 500},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        self._raise_for_error(resp)
        data = resp.json()
        if not isinstance(data, list):
            raise BackendAPIError(502, "Church_server returned an invalid worker roster")
        workers = []
        for item in data:
            workers.append({
                "worker_id": item.get("worker_id") or item.get("id"),
                "user_id": item.get("user_id"),
                "name": item.get("full_name") or item.get("name") or "Church Worker",
                "phone": item.get("phone") or "",
                "unit": item.get("department") or item.get("unit") or "General Worker",
                "location_id": str(item.get("location_id") or location_id),
                "location_name": item.get("location_name"),
                "church_type": item.get("church_type", "DCLM"),
            })
        return workers

    async def get_events(self, *, location_id: str, service_date: str, program_type: str,
                         access_token: str) -> list[dict[str, Any]]:
        """Return backend events visible to this account at the selected location/date."""
        params = {"location_id": location_id, "date": service_date, "program_type": program_type, "limit": 100}
        resp = await self._request(
            "GET", "/api/v1/programs/events", params=params,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        self._raise_for_error(resp)
        data = resp.json()
        if not isinstance(data, list):
            raise BackendAPIError(502, "Church_server returned an invalid event list")
        return [
            {**item, "location_id": str(item.get("alpha_location_id") or location_id)}
            for item in data
        ]

    async def get_event(self, event_id: str, access_token: str) -> dict[str, Any]:
        resp = await self._request(
            "GET", f"/api/v1/programs/events/{event_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        self._raise_for_error(resp)
        data = resp.json()
        if not isinstance(data, dict):
            raise BackendAPIError(502, "Church_server returned an invalid event")
        return data

    async def get_event_assignments(self, event_id: str, access_token: str) -> list[dict[str, Any]]:
        resp = await self._request(
            "GET", f"/api/v1/programs/events/{event_id}/assignments",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        self._raise_for_error(resp)
        data = resp.json()
        if not isinstance(data, list):
            raise BackendAPIError(502, "Church_server returned invalid event assignments")
        return data

    async def push_sync_batch(self, payload: dict[str, Any], access_token: str) -> dict[str, Any]:
        """Submits batch synchronization to FastAPI backend POST /api/v1/sync/batch."""
        endpoints = ["/api/v1/sync/batch", "/api/v1/sync"]
        last_error = None
        for endpoint in endpoints:
            try:
                resp = await self._request(
                    "POST",
                    endpoint,
                    json=payload,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                if resp.status_code in (200, 201):
                    data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                    return {"ok": True, **data}
                elif resp.status_code in (401, 403):
                    return {
                        "ok": False,
                        "status_code": resp.status_code,
                        "error": "Your field session has expired. Sign in again to continue syncing.",
                    }
                elif resp.status_code != 404:
                    return {
                        "ok": False,
                        "status_code": resp.status_code,
                        "error": f"Server status {resp.status_code}: {resp.text[:120]}",
                    }
                last_error = f"Status {resp.status_code}"
            except Exception as exc:
                last_error = str(exc)
                logger.error("Sync batch transmission failed on %s: %s", endpoint, exc)

        return {
            "ok": False,
            "error": f"Unable to reach sync endpoint ({last_error}). Batches preserved locally.",
        }


backend_client = BackendClient()
