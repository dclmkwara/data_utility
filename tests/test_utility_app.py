"""Test suite for DCLM Field Utility application."""
from __future__ import annotations

import sys
from pathlib import Path
from starlette.testclient import TestClient
from unittest.mock import AsyncMock
import httpx

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.presentation.app_factory import create_app
from app.main import app as cloud_app
from app.presentation.routes.api_proxy import backend_client
from app.schemas.identity import SetupIdentity, validate_location_code
from app.schemas.counts import CountItem
from app.schemas.offerings import OfferingItem
from app.schemas.records import RecordItem
from app.schemas.attendance import WorkerAttendanceItem
from app.schemas.counts import CountItem
from app.schemas.offerings import OfferingItem
from app.schemas.records import RecordItem
from app.schemas.attendance import WorkerAttendanceItem
from app.services.backend_client import BackendClient

app = create_app()
client = TestClient(app)


def test_core_routes_render():
    """Verify all presentation pages load successfully."""
    paths = [
        "/",
        "/counter",
        "/attendance",
        "/attendance/review",
        "/registration",
        "/setup",
        "/queues",
        "/fellowship",
        "/information",
        "/health",
    ]
    for path in paths:
        response = client.get(path)
        assert response.status_code == 200, f"Path {path} returned {response.status_code}"
        assert "DCLM" in response.text


def test_production_session_configuration_requires_an_explicit_key(monkeypatch):
    from app.services import auth_session

    monkeypatch.setattr(auth_session, "APP_ENV", "production")
    monkeypatch.delenv("UTILITY_SESSION_KEY", raising=False)
    import pytest
    with pytest.raises(RuntimeError, match="UTILITY_SESSION_KEY must be configured"):
        auth_session.validate_session_configuration()

    monkeypatch.setenv("UTILITY_SESSION_KEY", "synthetic-deployment-test-key")
    auth_session.validate_session_configuration()


def test_fastapi_cloud_entrypoint_mounts_fasthtml_routes_and_health():
    cloud_client = TestClient(cloud_app)
    assert cloud_client.get("/health").json()["status"] == "ok"
    assert cloud_client.get("/login").status_code == 200
    assert cloud_client.get("/counter").status_code == 200


def test_service_worker_is_available_at_root_scope():
    response = client.get("/sw.js")
    assert response.status_code == 200
    assert response.headers["service-worker-allowed"] == "/"
    assert 'const CACHE_NAME = "dclm-utility-v16"' in response.text


def test_application_shell_does_not_require_remote_runtime_scripts():
    response = client.get("/counter")
    assert response.status_code == 200
    for remote_dependency in ("fonts.googleapis.com", "cdn.jsdelivr.net", "fasthtml.js", "surreal.js"):
        assert remote_dependency not in response.text


def test_location_code_hierarchy_validation():
    """Verify ecclesiastical level-aware location regex validator."""
    # Global: 1 segment (DCL)
    assert validate_location_code("Global", "DCL")[0] is True
    assert validate_location_code("Global", "DCL-234")[0] is False

    # National: 2 segments (DCL-234)
    assert validate_location_code("National", "DCL-234")[0] is True
    assert validate_location_code("National", "DCL-234-KW")[0] is False

    # State: 3 segments (DCL-234-KW)
    assert validate_location_code("State", "DCL-234-KW")[0] is True
    assert validate_location_code("State", "DCL-234-KW-ILR")[0] is False

    # Region: 4 segments (DCL-234-KW-ILR)
    assert validate_location_code("Region", "DCL-234-KW-ILR")[0] is True
    assert validate_location_code("Region", "DCL-234-KW-ILR-ILE")[0] is False

    # Group: 5 segments (DCL-234-KW-ILR-ILE)
    assert validate_location_code("Group", "DCL-234-KW-ILR-ILE")[0] is True
    assert validate_location_code("Group", "DCL-234-KW-ILR-ILE-003")[0] is False

    # Local: 6 segments (DCL-234-KW-ILR-ILE-003)
    assert validate_location_code("Local", "DCL-234-KW-ILR-ILE-003")[0] is True
    assert validate_location_code("Local", "DCL-234-KW-ILR-ILE-ABC")[0] is False  # Must end in 3 digits
    assert validate_location_code("Local", "DCL-234-KW-ILR")[0] is False


def test_setup_identity_schema():
    """Verify SetupIdentity pydantic model enforces rules."""
    identity = SetupIdentity(
        church_type="DCLM",
        program_domain="Weekly",
        program_type="Sunday Worship Service",
        program_level="Local",
        location_id="DCL-234-KW-ILR-ILE-003",
        service_date="2026-11-01",
    )
    assert identity.location_id == "DCL-234-KW-ILR-ILE-003"
    assert "DCLM" in identity.compact_badge()
    assert "DCL-234-KW-ILR-ILE-003" in identity.cache_key()


def test_api_workers_requires_authenticated_backend_identity():
    """The utility must not expose a fabricated roster to unauthenticated callers."""
    response = client.get("/api/workers?location_id=DCL-234-KW-ILR-ILE-003")
    assert response.status_code == 401
    assert response.json()["items"] == []


def _authenticated_client(monkeypatch):
    monkeypatch.setattr(backend_client, "login", AsyncMock(return_value={
        "access_token": "access-test", "refresh_token": "refresh-test",
    }))
    monkeypatch.setattr(backend_client, "get_current_user", AsyncMock(return_value={
        "user_id": "user-1", "worker_id": "worker-1", "name": "Field Worker",
        "email": "field@example.org", "location_id": "11111111-1111-4111-8111-111111111111",
        "roles": [{"role_name": "Location Worker"}], "permissions": ["programs:read", "sync:batch"],
    }))
    test_client = TestClient(create_app())
    response = test_client.post("/api/auth/login", json={"username": "field@example.org", "password": "test"})
    assert response.status_code == 200
    test_client.login_cookie_header = response.headers.get("set-cookie", "")
    return test_client


def test_login_uses_http_only_cookie_and_exposes_no_tokens(monkeypatch):
    test_client = _authenticated_client(monkeypatch)
    response = test_client.get("/api/auth/state")
    assert response.status_code == 200
    assert response.json()["authenticated"] is True
    assert "access_token" not in response.text
    assert "refresh_token" not in response.text
    assert "HttpOnly" in test_client.login_cookie_header


def test_sync_requires_event_location_and_stable_client_id(monkeypatch):
    test_client = _authenticated_client(monkeypatch)
    response = test_client.post("/api/sync", json={
        "counts": [{"client_id": "22222222-2222-4222-8222-222222222222", "location_id": "11111111-1111-4111-8111-111111111111"}],
    })
    assert response.status_code == 422
    assert "event_id" in response.json()["error"]


def test_sync_forwards_valid_record_with_authenticated_session(monkeypatch):
    test_client = _authenticated_client(monkeypatch)
    expected = {"ok": True, "counts": {"synced": 1, "duplicates": 0, "errors": 0,
                                        "details": [{"client_id": "22222222-2222-4222-8222-222222222222", "status": "synced"}]}}
    push = AsyncMock(return_value=expected)
    monkeypatch.setattr(backend_client, "push_sync_batch", push)
    response = test_client.post("/api/sync", json={
        "counts": [{"client_id": "22222222-2222-4222-8222-222222222222", "event_id": "33333333-3333-4333-8333-333333333333",
                    "location_id": "11111111-1111-4111-8111-111111111111"}],
    })
    assert response.status_code == 200
    assert response.json()["counts"]["details"][0]["status"] == "synced"
    push.assert_awaited_once()


def test_alpha_crusade_returns_only_approved_assignments_for_signed_in_worker(monkeypatch):
    test_client = _authenticated_client(monkeypatch)
    monkeypatch.setattr(backend_client, "get_event", AsyncMock(return_value={
        "event_mode": "crusade", "alpha_location_id": "11111111-1111-4111-8111-111111111111",
    }))
    monkeypatch.setattr(backend_client, "get_event_assignments", AsyncMock(return_value=[
        {"id": "count-1", "worker_id": "worker-1", "status": "approved", "assignment_type": "count"},
        {"id": "convert-1", "worker_id": "worker-1", "status": "approved", "assignment_type": "convert"},
        {"id": "pending-1", "worker_id": "worker-1", "status": "pending", "assignment_type": "both"},
        {"id": "other-1", "worker_id": "worker-2", "status": "approved", "assignment_type": "both"},
    ]))
    response = test_client.get(
        "/api/events/33333333-3333-4333-8333-333333333333/field-assignments?location_id=11111111-1111-4111-8111-111111111111"
    )
    assert response.status_code == 200
    assert [item["assignment_id"] for item in response.json()["count_assignments"]] == ["count-1"]
    assert [item["assignment_id"] for item in response.json()["convert_assignments"]] == ["convert-1"]


def test_api_location_validator_route():
    """Verify /api/validate-location endpoint."""
    resp = client.get("/api/validate-location?level=Region&location_id=DCL-234-KW-ILR")
    assert resp.status_code == 200
    assert resp.json()["valid"] is True

    resp_bad = client.get("/api/validate-location?level=Region&location_id=DCL-234")
    assert resp_bad.status_code == 200
    assert resp_bad.json()["valid"] is False


def test_empty_backend_roster_stays_empty(monkeypatch):
    """A genuinely empty authorized roster must not be replaced with demo workers."""
    test_client = _authenticated_client(monkeypatch)
    monkeypatch.setattr(backend_client, "get_workers", AsyncMock(return_value=[]))
    response = test_client.get("/api/workers?location_id=11111111-1111-4111-8111-111111111111")
    assert response.status_code == 200
    assert response.json() == {"ok": True, "source": "backend", "items": []}


def test_sync_proxy_enforces_batch_cap_before_backend_call(monkeypatch):
    test_client = _authenticated_client(monkeypatch)
    push = AsyncMock()
    monkeypatch.setattr(backend_client, "push_sync_batch", push)
    response = test_client.post("/api/sync", json={
        "counts": [{
            "client_id": f"{index:08d}-0000-4000-8000-000000000000",
            "event_id": "33333333-3333-4333-8333-333333333333",
            "location_id": "11111111-1111-4111-8111-111111111111",
        } for index in range(501)],
    })
    assert response.status_code == 413
    push.assert_not_awaited()


def test_worker_roster_location_is_passed_as_encoded_query_param():
    client = BackendClient(base_url="https://backend.example")
    client.local_url = ""
    client._request = AsyncMock(return_value=httpx.Response(200, json=[]))
    import asyncio
    asyncio.run(client.get_workers("DCL-234-KW-ILR-ILE-003&limit=1", "access"))
    kwargs = client._request.await_args.kwargs
    assert kwargs["params"] == {"location_id": "DCL-234-KW-ILR-ILE-003&limit=1", "limit": 500}


def test_fellowship_sync_requires_fellowship_id_not_program_event(monkeypatch):
    test_client = _authenticated_client(monkeypatch)
    push = AsyncMock(return_value={"ok": True, "fellowship_attendance": {"details": []}})
    monkeypatch.setattr(backend_client, "push_sync_batch", push)
    response = test_client.post("/api/sync", json={
        "fellowship_attendance": [{
            "client_id": "44444444-4444-4444-8444-444444444444", "fellowship_id": "55555555-5555-4555-8555-555555555555",
            "date": "2026-11-01T00:00:00Z", "men": 2,
        }],
    })
    assert response.status_code == 200
    assert "event_id" not in push.await_args.args[0]["fellowship_attendance"][0]


def test_fellowship_sync_rejects_invalid_uuid_and_bad_meeting_date(monkeypatch):
    test_client = _authenticated_client(monkeypatch)
    push = AsyncMock()
    monkeypatch.setattr(backend_client, "push_sync_batch", push)
    invalid_uuid = test_client.post("/api/sync", json={
        "fellowship_attendance": [{"client_id": "not-a-uuid", "fellowship_id": "55555555-5555-4555-8555-555555555555", "date": "2026-11-02"}],
    })
    assert invalid_uuid.status_code == 422
    invalid_date = test_client.post("/api/sync", json={
        "fellowship_attendance": [{"client_id": "59c34942-f720-45fe-a019-9b4f484a8112",
            "fellowship_id": "55555555-5555-4555-8555-555555555555", "date": "next Sunday"}],
    })
    assert invalid_date.status_code == 422
    push.assert_not_awaited()


def test_fellowship_context_is_bound_to_signed_in_location(monkeypatch):
    test_client = _authenticated_client(monkeypatch)
    get_fellowships = AsyncMock(return_value=[])
    monkeypatch.setattr(backend_client, "get_fellowships", get_fellowships)
    monkeypatch.setattr(backend_client, "get_location", AsyncMock(return_value={
        "location_id": "11111111-1111-4111-8111-111111111111", "location_name": "Igbaja", "location_code": "KW-003",
    }))
    response = test_client.get("/api/fellowship-context")
    assert response.status_code == 200
    assert response.json()["items"] == []
    get_fellowships.assert_awaited_once_with("11111111-1111-4111-8111-111111111111", "access-test")


def test_location_context_uses_backend_location_and_uuid(monkeypatch):
    test_client = _authenticated_client(monkeypatch)
    monkeypatch.setattr(backend_client, "get_location", AsyncMock(return_value={
        "location_id": "11111111-1111-4111-8111-111111111111", "location_name": "Igbaja", "location_code": "KW-003",
    }))
    response = test_client.get("/api/location-context")
    assert response.status_code == 200
    assert response.json()["location"]["location_id"] == "11111111-1111-4111-8111-111111111111"
    assert response.json()["location"]["formatted_id"] == "KW-003"


def test_event_data_schemas_require_uuid_event_and_location_and_accept_assignments():
    import uuid
    event_id = uuid.uuid4()
    location_id = uuid.uuid4()
    CountItem(client_id=uuid.uuid4(), event_id=event_id, location_id=location_id, assignment_id=uuid.uuid4())
    OfferingItem(client_id=uuid.uuid4(), event_id=event_id, location_id=location_id, amount="1.25")
    RecordItem(client_id=uuid.uuid4(), event_id=event_id, location_id=location_id,
               record_type="convert", name="Test", gender="Female", phone="08000000000", assignment_id=uuid.uuid4())
    WorkerAttendanceItem(client_id=uuid.uuid4(), event_id=event_id, location_id=location_id, worker_id=uuid.uuid4())


    RecordItem(client_id=uuid.uuid4(), event_id=event_id, location_id=location_id,
               record_type="convert", name="Test", gender="Female", phone="08000000000", assignment_id=uuid.uuid4())
    WorkerAttendanceItem(client_id=uuid.uuid4(), event_id=event_id, location_id=location_id, worker_id=uuid.uuid4())
