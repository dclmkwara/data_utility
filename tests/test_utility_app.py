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
from app.core.constants import PROGRAM_DOMAINS, PROGRAM_TYPES_BY_DOMAIN, PROGRAM_LEVELS
from app.schemas.counts import CountItem
from app.schemas.offerings import OfferingItem
from app.schemas.records import RecordItem
from app.schemas.attendance import WorkerAttendanceItem
from app.services.backend_client import BackendClient

app = create_app()
client = TestClient(app)


def test_capture_taxonomy_matches_canonical_domains_and_levels():
    assert [key for key, _ in PROGRAM_DOMAINS] == ["Weekly", "Crusade", "Retreat", "Conference", "Special"]
    assert "Home Caring Fellowship" not in {item for options in PROGRAM_TYPES_BY_DOMAIN.values() for item in options}
    assert dict(PROGRAM_LEVELS)["Local"].startswith("Location scope (pastoral level 2)")


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
        "/settings",
        "/health",
    ]
    for path in paths:
        response = client.get(path)
        assert response.status_code == 200, f"Path {path} returned {response.status_code}"
        assert "DCLM" in response.text


def test_fellowship_attendance_form_has_six_explicit_population_categories():
    response = client.get("/fellowship")
    assert response.status_code == 200
    for label in ("Adult Male", "Adult Female", "Youth Male", "Youth Female", "Boys", "Girls"):
        assert label in response.text
    for legacy_label in (">Men<", ">Women<", ">Youths<", ">Children<"):
        assert legacy_label not in response.text


def test_information_sheet_is_backend_driven_and_proxy_requires_session():
    page = client.get("/information")
    assert page.status_code == 200
    assert 'id="info-sws-reading"' in page.text
    assert "/api/information/latest" in page.text
    assert "The Believer's Heavenly Walk and Warfare" not in page.text

    response = client.get("/api/information/latest")
    assert response.status_code == 401
    assert response.json()["ok"] is False


def test_active_assignment_proxy_requires_session_and_returns_backend_assignments(monkeypatch):
    response = client.get("/api/events/assigned-to-me")
    assert response.status_code == 401

    test_client = _authenticated_client(monkeypatch)
    expected = [{"assignment_id": "assignment-1", "event": {"id": "event-1"}}]
    fetch = AsyncMock(return_value=expected)
    monkeypatch.setattr(backend_client, "get_my_active_event_assignments", fetch)
    response = test_client.get("/api/events/assigned-to-me")
    assert response.status_code == 200
    assert response.json()["items"] == expected
    fetch.assert_awaited_once()


def test_assigned_event_restricts_location_capture_to_approved_assignee(monkeypatch):
    test_client = _authenticated_client(monkeypatch)
    monkeypatch.setattr(backend_client, "get_event", AsyncMock(return_value={
        "id": "event-1", "event_mode": "regular", "reporting_scope": "location", "alpha_location_id": None,
    }))
    monkeypatch.setattr(backend_client, "get_event_assignments", AsyncMock(return_value=[{
        "id": "assignment-1", "worker_id": "worker-1", "status": "pending", "assignment_type": "count",
    }]))
    pending = test_client.get("/api/events/event-1/field-assignments?location_id=11111111-1111-4111-8111-111111111111")
    assert pending.status_code == 200
    assert pending.json()["required"] is True
    assert pending.json()["count_assignments"] == []

    monkeypatch.setattr(backend_client, "get_event_assignments", AsyncMock(return_value=[{
        "id": "assignment-1", "worker_id": "worker-1", "status": "approved", "assignment_type": "count",
    }]))
    approved = test_client.get("/api/events/event-1/field-assignments?location_id=11111111-1111-4111-8111-111111111111")
    assert approved.json()["count_assignments"] == [{"assignment_id": "assignment-1", "label": "Count assignment"}]


def test_setup_exposes_editable_reporting_scope_and_keeps_collection_location_readonly():
    setup_page = client.get("/setup")
    assert setup_page.status_code == 200
    assert 'id="page_reporting_scope_code"' in setup_page.text
    assert 'id="page_program_level"' in setup_page.text
    assert 'id="page_location_label"' in setup_page.text
    assert 'id="page_location_label"' in setup_page.text and "readonly" in setup_page.text
    assert 'id="page_reporting_scope_code"' in setup_page.text
    assert "Reporting Location ID (editable)" in setup_page.text

    modal_page = client.get("/counter")
    assert 'id="modal_reporting_scope_code"' in modal_page.text
    assert 'id="modal_program_level"' in modal_page.text
    app_js = Path("assets/js/app.js").read_text(encoding="utf-8")
    assert "reportingScopeCodeFromPath(event.path)" in app_js
    assert "selectedScopeCode !== eventScopeCode" in app_js
    assert "A broader or different location scope requires a matching scheduled event." in app_js


def test_original_demographic_counter_with_optional_split_count_ui_is_present():
    counter = client.get("/counter")
    assert counter.status_code == 200
    assert 'id="count-mode"' in counter.text
    assert 'type="checkbox"' in counter.text
    assert "I'm counting only part of the congregation" in counter.text
    assert 'id="count-section-label"' in counter.text
    assert 'id="count-section-suggestion-chips"' in counter.text
    assert 'id="count-service-picker"' in counter.text
    assert 'id="count-service-id"' in counter.text
    assert 'id="count-group-summary"' in counter.text
    assert 'id="btn-finalize-count-batch"' in counter.text
    assert 'id="count-section-suggestions-manager"' in counter.text
    assert "Edit Numbers" in counter.text
    assert "Reset" in counter.text
    assert "TOTAL POPULATION COUNT" in counter.text
    assert "Rapid one-thumb demographic counting with haptic sensory feedback." in counter.text
    labels = [counter.text.index(label) for label in ("Adult Male", "Adult Female", "Youth Male", "Youth Female", "Boys", "Girls")]
    assert labels == sorted(labels)
    assert "Tithe &amp; Offering Collection" in counter.text
    assert "Save Count" in counter.text
    assert "Enter one congregation total" not in counter.text


def test_offline_submission_edits_are_queued_and_server_window_is_checked_on_sync():
    db_js = Path("assets/js/db.js").read_text(encoding="utf-8")
    sync_js = Path("assets/js/sync.js").read_text(encoding="utf-8")
    app_js = Path("assets/js/app.js").read_text(encoding="utf-8")
    assert "submission_edits_queue" in db_js
    assert "DB_VERSION = 9" in db_js
    assert "syncQueuedSubmissionEdits" in sync_js
    assert 'item.resource === "count"' in sync_js
    assert 'response.status >= 400 && response.status < 500' in sync_js
    assert "The server checks the edit window when syncing" in app_js
    assert "Edit refused:" in app_js
    assert "function escapeAttribute(value)" in app_js
    assert 'data-submitted-count-form="${escapeAttribute(item.id)}"' in app_js
    assert 'data-sync-id="${escapeAttribute(item.client_id)}"' in app_js
    assert 'service_id: qs("#count-service-id")?.value || "main"' in app_js
    assert "function isEditableSubmission(item)" in app_js
    assert "editableRecordsRefreshTimer" in app_js
    assert "25 * 60 * 60 * 1000" in db_js
    queue = client.get("/queues")
    assert queue.status_code == 200
    assert "Submitted counts you can still edit" in queue.text
    assert 'id="submitted-worker-attendance-edits"' in queue.text
    app_js = Path("assets/js/app.js").read_text(encoding="utf-8")
    sync_js = Path("assets/js/sync.js").read_text(encoding="utf-8")
    assert '"/api/counts/editable"' in app_js
    assert "edit_id: crypto.randomUUID()" in app_js
    assert 'count_mode: item.count_mode || "single"' in sync_js
    assert 'data-resolve-action="relabel_both"' in app_js
    assert 'data-resolve-action="replace"' not in app_js
    assert "confirmation_required" in app_js
    assert "Close anyway?" in app_js


def test_attendance_submission_obeys_queue_setting_and_online_validation_is_not_queued():
    app_js = Path("assets/js/app.js").read_text(encoding="utf-8")
    sync_js = Path("assets/js/sync.js").read_text(encoding="utf-8")
    settings = Path("app/presentation/routes/settings.py").read_text(encoding="utf-8")
    assert 'submitOrQueue("attendance_queue", attendanceCapture, { skipEditWarning: true })' in app_js
    assert "error.status = response.status" in sync_js
    assert "if (!retryableTransportFailure)" in sync_js
    assert "if (forceImmediate || !navigator.onLine)" in sync_js
    assert "queues only when the connection is unavailable" in settings
def test_submitted_count_edit_proxy_is_authenticated_and_scoped_to_backend_actor(monkeypatch):
    assert client.get("/api/counts/editable").status_code == 401
    test_client = _authenticated_client(monkeypatch)
    count_id = "11111111-1111-4111-8111-111111111111"
    rows = [{"id": count_id, "status": "pending", "edits_remaining": 3}]
    fetch = AsyncMock(return_value=rows)
    edit = AsyncMock(return_value={"id": count_id, "status": "pending", "revision": 1})
    monkeypatch.setattr(backend_client, "list_my_editable_counts", fetch)
    monkeypatch.setattr(backend_client, "edit_count_submission", edit)
    response = test_client.get("/api/counts/editable")
    assert response.status_code == 200
    assert response.json()["items"] == rows
    fetch.assert_awaited_once()
    response = test_client.post(f"/api/counts/{count_id}/edit", json={"edit_id": "edit", "base_revision": 0, "values": {}})
    assert response.status_code == 200
    edit.assert_awaited_once()


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
    assert cloud_client.get("/health").json() == {
        "status": "ok",
        "app": "DCLM Field Utility",
        "version": "1.1.1",
    }
    assert cloud_client.get("/login").status_code == 200
    assert cloud_client.get("/counter").status_code == 200


def test_service_worker_is_available_at_root_scope():
    response = client.get("/sw.js")
    assert response.status_code == 200
    assert response.headers["service-worker-allowed"] == "/"
    assert 'const CACHE_NAME = "dclm-utility-v40"' in response.text


def test_settings_explain_installation_for_android_and_ios():
    response = client.get("/settings")
    assert response.status_code == 200
    assert 'id="btn-install-app"' in response.text
    assert "Android: open this page in Chrome" in response.text
    assert "iPhone/iPad: open this page in Safari" in response.text
    assert "Powered by: Kwara State ICT Unit" in response.text


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

    group_identity = SetupIdentity(
        church_type="DCLM",
        program_domain="Weekly",
        program_type="Saturday Workers Meeting",
        program_level="Group",
        location_id="DCL-234-KW-ILR-ILE",
        service_date="2026-11-07",
    )
    assert group_identity.location_id == "DCL-234-KW-ILR-ILE"


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


def test_sync_requires_program_level_for_eventless_program_record(monkeypatch):
    test_client = _authenticated_client(monkeypatch)
    response = test_client.post("/api/sync", json={
        "counts": [{"client_id": "22222222-2222-4222-8222-222222222222", "location_id": "11111111-1111-4111-8111-111111111111",
                     "date": "2026-11-04T00:00:00Z", "church_type": "DCLM", "program_domain": "Weekly",
                     "program_type": "Workers Meeting"}],
    })
    assert response.status_code == 422, response.text
    assert "program level" in response.json()["error"]


def test_sync_forwards_valid_record_with_authenticated_session(monkeypatch):
    test_client = _authenticated_client(monkeypatch)
    expected = {"ok": True, "counts": {"synced": 1, "duplicates": 0, "errors": 0,
                                        "details": [{"client_id": "22222222-2222-4222-8222-222222222222", "status": "synced"}]}}
    push = AsyncMock(return_value=expected)
    monkeypatch.setattr(backend_client, "push_sync_batch", push)
    response = test_client.post("/api/sync", json={
        "counts": [{"client_id": "22222222-2222-4222-8222-222222222222", "event_id": "33333333-3333-4333-8333-333333333333",
                    "location_id": "11111111-1111-4111-8111-111111111111", "date": "2026-11-04T00:00:00Z",
                    "church_type": "DCLM", "program_level": "Local", "program_type": "Sunday Worship Service"}],
    })
    assert response.status_code == 200
    assert response.json()["counts"]["details"][0]["status"] == "synced"
    push.assert_awaited_once()


def test_worker_attendance_submission_forwards_complete_backend_metadata(monkeypatch):
    test_client = _authenticated_client(monkeypatch)
    client_id = "22222222-2222-4222-8222-222222222222"
    worker_id = "44444444-4444-4444-8444-444444444444"
    location_id = "11111111-1111-4111-8111-111111111111"
    assignment_id = "55555555-5555-4555-8555-555555555555"
    expected = {"ok": True, "worker_attendance_submissions": {
        "synced": 1, "duplicates": 0, "errors": 0,
        "details": [{"client_id": client_id, "status": "synced"}],
    }}
    push = AsyncMock(return_value=expected)
    monkeypatch.setattr(backend_client, "push_sync_batch", push)
    response = test_client.post("/api/sync", json={
        "worker_attendance_submissions": [{
            "client_id": client_id, "location_id": location_id,
            "assignment_id": assignment_id, "date": "2026-11-10T00:00:00Z",
            "church_type": "DCLM", "program_level": "Local",
            "program_domain": "Weekly", "program_type": "Workers Meeting",
            "expected_workers_count": 1,
            "present_workers": [{"worker_id": worker_id, "worker_name": "Synthetic Worker"}],
            "submitted_by_worker_id": worker_id,
        }],
    })
    assert response.status_code == 200, response.text
    forwarded = push.await_args.args[0]["worker_attendance_submissions"][0]
    assert forwarded["assignment_id"] == assignment_id
    assert forwarded["program_level"] == "Local"
    assert forwarded["program_domain"] == "Weekly"
    assert forwarded["expected_workers_count"] == 1
    assert forwarded["present_workers"] == [{"worker_id": worker_id, "worker_name": "Synthetic Worker"}]


def test_worker_attendance_submission_schema_matches_sync_metadata():
    from app.schemas.sync import WorkerAttendanceSubmissionItem

    item = WorkerAttendanceSubmissionItem(
        client_id="22222222-2222-4222-8222-222222222222",
        location_id="11111111-1111-4111-8111-111111111111",
        assignment_id="55555555-5555-4555-8555-555555555555",
        date="2026-11-10T00:00:00Z", church_type="DCLM", program_level="Local",
        program_domain="Weekly", program_type="Workers Meeting", expected_workers_count=1,
        present_workers=[{"worker_id": "44444444-4444-4444-8444-444444444444", "worker_name": "Synthetic Worker"}],
    )
    assert item.assignment_id
    assert item.program_level == "Local"


def test_worker_attendance_rejects_malformed_assignment_parameter_before_forwarding(monkeypatch):
    test_client = _authenticated_client(monkeypatch)
    push = AsyncMock()
    monkeypatch.setattr(backend_client, "push_sync_batch", push)
    response = test_client.post("/api/sync", json={
        "worker_attendance_submissions": [{
            "client_id": "22222222-2222-4222-8222-222222222222",
            "location_id": "11111111-1111-4111-8111-111111111111",
            "assignment_id": "not-a-uuid", "date": "2026-11-10T00:00:00Z",
            "church_type": "DCLM", "program_level": "Local",
            "program_domain": "Weekly", "program_type": "Workers Meeting",
            "expected_workers_count": 1,
            "present_workers": [{"worker_id": "44444444-4444-4444-8444-444444444444", "worker_name": "Synthetic Worker"}],
        }],
    })
    assert response.status_code == 422
    assert "invalid UUID" in response.json()["error"]
    push.assert_not_awaited()


def test_worker_candidate_sync_forwards_only_candidate_fields(monkeypatch):
    test_client = _authenticated_client(monkeypatch)
    expected = {"ok": True, "worker_candidates": {"synced": 1, "duplicates": 0, "errors": 0,
                "details": [{"client_id": "44444444-4444-4444-8444-444444444444", "status": "synced"}]}}
    push = AsyncMock(return_value=expected)
    monkeypatch.setattr(backend_client, "push_sync_batch", push)
    response = test_client.post("/api/sync", json={"worker_candidates": [{
        "client_id": "44444444-4444-4444-8444-444444444444", "name": "Candidate Worker",
        "gender": "Female", "phone": "+2348012345678", "email": "candidate@example.org",
        "unit": "Ushering", "address": "Test address",
    }]})
    assert response.status_code == 200, response.text
    forwarded = push.await_args.args[0]["worker_candidates"][0]
    assert forwarded["client_id"] == "44444444-4444-4444-8444-444444444444"
    assert forwarded["unit"] == "Ushering"
    assert "location_id" not in forwarded


def test_worker_candidate_proxy_rejects_invalid_details_before_backend(monkeypatch):
    test_client = _authenticated_client(monkeypatch)
    push = AsyncMock()
    monkeypatch.setattr(backend_client, "push_sync_batch", push)
    response = test_client.post("/api/sync", json={"worker_candidates": [{
        "client_id": "44444444-4444-4444-8444-444444444444", "name": "", "gender": "",
        "phone": "1", "email": "bad", "unit": "",
    }]})
    assert response.status_code == 422
    push.assert_not_awaited()


def test_registration_page_includes_worker_candidate_intake(monkeypatch):
    test_client = _authenticated_client(monkeypatch)
    response = test_client.get("/registration")
    assert response.status_code == 200
    assert "Worker Candidate" in response.text
    assert "worker-candidate-form" in response.text
    assert "pending until reviewed by the Group Pastor" in response.text
    assert "Submit Worker Candidate" in response.text
    app_js = Path("assets/js/app.js").read_text(encoding="utf-8")
    assert 'qs("#worker-candidate-form")?.closest(".dclm-card")' in app_js
    assert 'qs("#worker-candidate-form")?.reset()' in app_js


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
                "date": "2026-11-04T00:00:00Z", "church_type": "DCLM", "program_level": "Local",
                "program_type": "Sunday Worship Service",
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
    assert kwargs["params"] == {"location_id": "DCL-234-KW-ILR-ILE-003&limit=1", "skip": 0, "limit": 500}


def test_sync_batch_uses_extended_timeout_for_offline_queue_batches():
    client = BackendClient(base_url="https://backend.example")
    client.local_url = ""
    client._request = AsyncMock(return_value=httpx.Response(200, json={"worker_candidates": {"synced": 50}}))
    import asyncio
    asyncio.run(client.push_sync_batch({"worker_candidates": [{}]}, "access"))
    assert client._request.await_args.kwargs["timeout"] == 90


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


def test_fellowship_sync_forwards_six_category_values(monkeypatch):
    test_client = _authenticated_client(monkeypatch)
    push = AsyncMock(return_value={"ok": True, "fellowship_attendance": {"details": []}})
    monkeypatch.setattr(backend_client, "push_sync_batch", push)
    categories = {"adult_male": 1, "adult_female": 2, "youth_male": 3,
                  "youth_female": 4, "boys": 5, "girls": 6}
    response = test_client.post("/api/sync", json={
        "fellowship_attendance": [{
            "client_id": "44444444-4444-4444-8444-444444444444",
            "fellowship_id": "55555555-5555-4555-8555-555555555555",
            "date": "2026-11-08T00:00:00Z",
            **categories,
        }],
    })
    assert response.status_code == 200
    forwarded = push.await_args.args[0]["fellowship_attendance"][0]
    assert {key: forwarded[key] for key in categories} == categories


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
