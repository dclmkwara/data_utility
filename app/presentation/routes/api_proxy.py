"""Authenticated, fail-closed proxy routes for the field utility."""
from __future__ import annotations

from typing import Any
from uuid import UUID
from datetime import date

from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from ...schemas.identity import validate_location_code
from ...services.auth_session import (
    SESSION_COOKIE,
    clear_session_cookie,
    decode_session,
    encode_session,
    public_user,
    set_session_cookie,
)
from ...services.backend_client import BackendAPIError, backend_client


def _response_error(exc: Exception) -> JSONResponse:
    if isinstance(exc, BackendAPIError):
        status_code = exc.status_code
        detail = exc.detail
    else:
        status_code = 502
        detail = "The church records service could not be reached. Your saved records are still on this device."
    return JSONResponse({"ok": False, "error": detail}, status_code=status_code)


def _session(request: Request) -> dict[str, Any] | None:
    return decode_session(request.cookies.get(SESSION_COOKIE))


def _actor_payload(user: dict[str, Any]) -> dict[str, Any]:
    actor = public_user(user)
    return {
        "user_id": actor["user_id"],
        "worker_id": actor["worker_id"],
        "name": actor["name"],
        "email": actor["email"],
        "location_id": actor["location_id"],
        "church_type": actor["church_type"],
        "roles": actor["roles"],
        "permissions": actor["permissions"],
    }


def _store_login(response: JSONResponse, tokens: dict[str, Any], user: dict[str, Any]) -> None:
    cookie = encode_session(
        str(tokens["access_token"]),
        str(tokens["refresh_token"]),
        _actor_payload(user),
    )
    set_session_cookie(response, cookie)


def setup_api_proxy_routes(app: Any) -> None:
    @app.post("/api/auth/login")
    async def login(request: Request):
        try:
            body = await request.json()
        except Exception:
            try:
                body = dict(await request.form())
            except Exception:
                body = {}
        username = str(body.get("username") or body.get("email") or "").strip()
        password = str(body.get("password") or "")
        if not username or not password:
            return JSONResponse({"ok": False, "error": "Enter your email and password."}, status_code=400)
        try:
            tokens = await backend_client.login(username, password)
            user = await backend_client.get_current_user(str(tokens["access_token"]))
        except Exception as exc:
            return _response_error(exc)
        response = JSONResponse({"ok": True, "user": public_user(user)})
        _store_login(response, tokens, user)
        return response

    @app.get("/api/auth/state")
    async def auth_state(request: Request):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": True, "authenticated": False})
        return JSONResponse({"ok": True, "authenticated": True, "user": session.get("user", {})})

    @app.get("/api/location-context")
    async def get_location_context(request: Request):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to load your assigned location."}, status_code=401)
        user = session.get("user", {})
        location_id = str(user.get("location_id") or "")
        if not location_id:
            return JSONResponse({"ok": False, "error": "This account has no assigned church location."}, status_code=422)
        try:
            location = await backend_client.get_location(location_id, session["access_token"])
        except Exception as exc:
            return _response_error(exc)
        return JSONResponse({
            "ok": True,
            "location": {
                "location_id": str(location.get("location_id") or location_id),
                "location_name": str(location.get("location_name") or "Church location"),
                "formatted_id": str(location.get("formatted_id") or location.get("location_code") or ""),
                "church_type": str(location.get("church_type") or "DCLM"),
                "program_level": "Local",
            },
        })

    @app.get("/api/auth/me")
    async def current_user(request: Request):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to continue."}, status_code=401)
        try:
            user = await backend_client.get_current_user(session["access_token"])
        except BackendAPIError as exc:
            if exc.status_code == 401:
                return JSONResponse({"ok": False, "error": "Your session needs to be refreshed."}, status_code=401)
            return _response_error(exc)
        except Exception as exc:
            return _response_error(exc)
        response = JSONResponse({"ok": True, "user": public_user(user)})
        set_session_cookie(
            response,
            encode_session(session["access_token"], session["refresh_token"], _actor_payload(user)),
        )
        return response

    @app.post("/api/auth/refresh")
    async def refresh_session(request: Request):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to continue."}, status_code=401)
        try:
            tokens = await backend_client.refresh(session["refresh_token"])
            user = await backend_client.get_current_user(str(tokens["access_token"]))
        except Exception as exc:
            response = _response_error(exc)
            if isinstance(exc, BackendAPIError) and exc.status_code == 401:
                clear_session_cookie(response)
            return response
        response = JSONResponse({"ok": True, "user": public_user(user)})
        _store_login(response, tokens, user)
        return response

    @app.post("/api/auth/logout")
    async def logout(request: Request):
        session = _session(request)
        revoked = False
        if session:
            try:
                await backend_client.logout(session["refresh_token"])
                revoked = True
            except Exception:
                # Local logout must still work while offline; server-side token
                # revocation can be reported and retried once connectivity returns.
                pass
        response = JSONResponse({"ok": True, "revoked": revoked})
        clear_session_cookie(response)
        return response

    @app.get("/api/workers")
    async def get_location_workers(request: Request, location_id: str = "", skip: int = 0, limit: int = 500):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to load workers.", "items": []}, status_code=401)
        norm_loc = location_id.strip()
        if not norm_loc:
            return JSONResponse({"ok": False, "error": "Location ID required.", "items": []}, status_code=400)
        try:
            items = await backend_client.get_workers(norm_loc, session["access_token"], skip=skip, limit=limit)
        except Exception as exc:
            return _response_error(exc)
        return JSONResponse({"ok": True, "source": "backend", "items": items})

    @app.get("/api/events")
    async def get_location_events(request: Request, location_id: str = "", date: str = "", program_type: str = ""):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to load program events.", "items": []}, status_code=401)
        if not location_id.strip() or not date.strip() or not program_type.strip():
            return JSONResponse({"ok": False, "error": "Location, service date, and program type are required.", "items": []}, status_code=400)
        try:
            items = await backend_client.get_events(
                location_id=location_id.strip(), service_date=date.strip(),
                program_type=program_type.strip(), access_token=session["access_token"],
            )
        except Exception as exc:
            return _response_error(exc)
        return JSONResponse({"ok": True, "source": "backend", "items": items})

    @app.get("/api/fellowship-context")
    async def get_fellowship_context(request: Request):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to load your assigned location."}, status_code=401)
        user = session.get("user", {})
        location_id = str(user.get("location_id") or "")
        if not location_id:
            return JSONResponse({"ok": False, "error": "This account has no assigned church location."}, status_code=422)
        try:
            location = await backend_client.get_location(location_id, session["access_token"])
            fellowships = await backend_client.get_fellowships(location_id, session["access_token"])
        except Exception as exc:
            return _response_error(exc)
        return JSONResponse({
            "ok": True,
            "location": {"location_id": location_id, "location_name": location.get("location_name"),
                         "formatted_id": location.get("formatted_id") or location.get("location_code")},
            "items": [{"fellowship_id": str(item.get("fellowship_id") or item.get("id") or ""),
                       "name": str(item.get("fellowship_name") or item.get("name") or "House Fellowship"),
                       "fellowship_group": str(item.get("fellowship_group") or ""),
                       "fellowship_group_label": {
                           "adult": "Adult Fellowship", "young_adult": "Young Adult Fellowship",
                           "campus": "Campus Fellowship", "youth": "Youth Fellowship",
                           "children": "Children Fellowship",
                       }.get(str(item.get("fellowship_group") or ""), "Category not configured"),
                       "code": str(item.get("fellowship_code") or "")} for item in fellowships],
        })

    @app.get("/api/events/{event_id}/field-assignments")
    async def get_field_assignments(request: Request, event_id: str, location_id: str = ""):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to verify count assignments."}, status_code=401)
        if not location_id.strip():
            return JSONResponse({"ok": False, "error": "Location is required."}, status_code=400)
        try:
            event = await backend_client.get_event(event_id, session["access_token"])
            is_alpha_crusade = (
                event.get("event_mode") == "crusade"
                and str(event.get("alpha_location_id") or "") == location_id.strip()
            )
            assignments = await backend_client.get_event_assignments(event_id, session["access_token"])
            requires_assignment = (
                is_alpha_crusade
                or str(event.get("reporting_scope") or "location").lower() in {"group", "region", "state"}
                or any(item.get("status") not in {"rejected", "revoked"} for item in assignments)
            )
            if not requires_assignment:
                return JSONResponse({"ok": True, "required": False, "requires_attendance": False, "count_assignments": [], "convert_assignments": [], "attendance_assignments": []})
            worker_id = str(session.get("user", {}).get("worker_id") or "")
            own = [
                item for item in assignments
                if str(item.get("worker_id") or "") == worker_id
                and item.get("status") == "approved"
            ]
            convert_assignments = [
                {"assignment_id": str(item.get("id")), "label": str(item.get("assignment_label") or "Convert assignment")}
                for item in own if item.get("assignment_type") in {"convert", "both", "all"}
            ]
            count_assignments = [
                {"assignment_id": str(item.get("id")), "label": str(item.get("assignment_label") or "Count assignment")}
                for item in own if item.get("assignment_type") in {"count", "both", "all"}
            ]
            attendance_assignments = [
                {"assignment_id": str(item.get("id")), "label": str(item.get("assignment_label") or "Attendance assignment")}
                for item in own if item.get("assignment_type") in {"attendance", "all"}
            ]
            is_combined_meeting = str(event.get("reporting_scope") or "location").lower() in {"group", "region", "state"}
            return JSONResponse({
                "ok": True, "required": True,
                "requires_attendance": is_combined_meeting,
                "count_assignments": count_assignments,
                "convert_assignments": convert_assignments,
                "attendance_assignments": attendance_assignments,
            })
        except Exception as exc:
            return _response_error(exc)

    @app.get("/api/events/{event_id}/attendance-roster")
    async def get_combined_attendance_roster(request: Request, event_id: str):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to load the assigned meeting roster."}, status_code=401)
        try:
            items = await backend_client.get_event_attendance_roster(event_id, session["access_token"])
        except Exception as exc:
            return _response_error(exc)
        return JSONResponse({"ok": True, "source": "assigned-event", "items": items})

    @app.get("/api/events/assigned-to-me")
    async def get_my_active_event_assignments(request: Request):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to load your assigned program setup."}, status_code=401)
        try:
            items = await backend_client.get_my_active_event_assignments(session["access_token"])
        except Exception as exc:
            return _response_error(exc)
        return JSONResponse({"ok": True, "source": "approved-active-assignments", "items": items})

    @app.get("/api/information/latest")
    async def get_latest_information(request: Request):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to load the weekly information sheet."}, status_code=401)
        try:
            item = await backend_client.get_latest_information(session["access_token"])
        except Exception as exc:
            return _response_error(exc)
        return JSONResponse({"ok": True, "source": "backend", "item": item})

    @app.post("/api/sync")
    async def proxy_sync(request: Request):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to sync saved records."}, status_code=401)
        try:
            body = await request.json()
        except Exception:
            return JSONResponse({"ok": False, "error": "Invalid JSON sync payload."}, status_code=400)
        if not isinstance(body, dict):
            return JSONResponse({"ok": False, "error": "Sync payload must be a JSON object."}, status_code=400)
        resource_names = (
            "counts", "offerings", "records", "worker_attendance", "worker_attendance_submissions",
            "worker_candidates", "fellowship_members", "fellowship_attendance", "fellowship_offerings",
        )
        total = sum(len(body.get(name, [])) for name in resource_names if isinstance(body.get(name, []), list))
        if total > 500:
            return JSONResponse({"ok": False, "error": "Sync accepts at most 500 records per request. Retry in smaller batches."}, status_code=413)
        for resource_name in resource_names:
            items = body.get(resource_name, [])
            if not isinstance(items, list):
                return JSONResponse({"ok": False, "error": f"{resource_name} must be a list."}, status_code=400)
            for index, item in enumerate(items):
                event_resource = resource_name in {"counts", "offerings", "records", "worker_attendance", "worker_attendance_submissions"}
                identity_keys = (("client_id",) if resource_name == "worker_candidates" else
                                 ("client_id", "location_id") if event_resource else ("client_id", "fellowship_id"))
                if not isinstance(item, dict) or any(not item.get(key) for key in identity_keys):
                    return JSONResponse({
                        "ok": False,
                        "error": f"{resource_name}[{index}] requires {', '.join(identity_keys)}.",
                    }, status_code=422)
                try:
                    UUID(str(item["client_id"]))
                    if event_resource:
                        UUID(str(item["location_id"]))
                        if item.get("event_id"):
                            UUID(str(item["event_id"]))
                        if item.get("assignment_id"):
                            UUID(str(item["assignment_id"]))
                    elif resource_name != "worker_candidates":
                        UUID(str(item["fellowship_id"]))
                except (ValueError, TypeError, AttributeError):
                    return JSONResponse({"ok": False, "error": f"{resource_name}[{index}] contains an invalid UUID."}, status_code=422)
                if event_resource:
                    try:
                        date.fromisoformat(str(item.get("date") or "")[:10])
                    except ValueError:
                        return JSONResponse({"ok": False, "error": f"{resource_name}[{index}] requires a valid service date."}, status_code=422)
                    if not item.get("program_type") or not item.get("church_type") or item.get("program_level") not in {"Local", "Group", "Region", "State", "National", "Global"}:
                        return JSONResponse({"ok": False, "error": f"{resource_name}[{index}] requires valid church section, program level, and program type metadata."}, status_code=422)
                    if not item.get("event_id") and not item.get("program_domain"):
                        return JSONResponse({"ok": False, "error": f"{resource_name}[{index}] requires a program domain when no scheduled event is selected."}, status_code=422)
                    if str(item.get("program_domain") or "").lower() == "crusade" and not item.get("event_id"):
                        return JSONResponse({"ok": False, "error": f"{resource_name}[{index}] crusade submissions require a scheduled event."}, status_code=422)
                if resource_name == "worker_attendance_submissions":
                    present = item.get("present_workers")
                    if not isinstance(present, list) or not present or len(present) > 5000:
                        return JSONResponse({"ok": False, "error": "Attendance capture must include between 1 and 5,000 present workers."}, status_code=422)
                    try:
                        if item.get("submitted_by_worker_id"):
                            UUID(str(item["submitted_by_worker_id"]))
                        worker_ids = [UUID(str(worker.get("worker_id"))) for worker in present if isinstance(worker, dict)]
                        if len(worker_ids) != len(present) or len(set(worker_ids)) != len(worker_ids):
                            raise ValueError("duplicate or malformed worker ID")
                    except (ValueError, TypeError, AttributeError):
                        return JSONResponse({"ok": False, "error": "Attendance capture contains an invalid or duplicate worker."}, status_code=422)
                    try:
                        expected_count = int(item.get("expected_workers_count", -1))
                    except (ValueError, TypeError):
                        expected_count = -1
                    if expected_count < len(present):
                        return JSONResponse({"ok": False, "error": "Present workers cannot exceed the expected roster count."}, status_code=422)
                if resource_name in {"fellowship_attendance", "fellowship_offerings"}:
                    raw_date = str(item.get("date") or "")
                    try:
                        date.fromisoformat(raw_date[:10])
                    except ValueError:
                        return JSONResponse({"ok": False, "error": f"{resource_name}[{index}] requires a valid ISO meeting date."}, status_code=422)
                if resource_name == "fellowship_members":
                    name = str(item.get("name") or "").strip()
                    address = str(item.get("address") or "").strip()
                    if (not name or len(name) > 120 or len(str(item.get("phone") or "")) > 30
                            or not address or len(address) > 300):
                        return JSONResponse({"ok": False, "error": f"fellowship_members[{index}] requires a valid name and home address; phone must be 30 characters or fewer."}, status_code=422)
                if resource_name == "worker_candidates":
                    name = str(item.get("name") or "").strip()
                    phone = str(item.get("phone") or "").strip()
                    email = str(item.get("email") or "").strip()
                    if (not name or len(name) > 255 or len(phone) < 7 or len(phone) > 30
                            or "@" not in email or len(email) > 254 or not item.get("gender") or not item.get("unit")):
                        return JSONResponse({"ok": False, "error": f"worker_candidates[{index}] requires name, gender, valid phone, email, and unit."}, status_code=422)
                if resource_name == "fellowship_offerings":
                    try:
                        amount = float(item.get("amount"))
                    except (TypeError, ValueError):
                        amount = 0
                    if not amount > 0 or amount > 9999999999.99:
                        return JSONResponse({"ok": False, "error": f"fellowship_offerings[{index}] requires a positive amount."}, status_code=422)
        refreshed_cookie = None
        try:
            result = await backend_client.push_sync_batch(body, session["access_token"])
            if int(result.get("status_code", 0)) == 401:
                tokens = await backend_client.refresh(session["refresh_token"])
                user = await backend_client.get_current_user(str(tokens["access_token"]))
                result = await backend_client.push_sync_batch(body, str(tokens["access_token"]))
                refreshed_cookie = encode_session(
                    str(tokens["access_token"]), str(tokens["refresh_token"]), _actor_payload(user)
                )
        except Exception as exc:
            return _response_error(exc)
        status_code = int(result.get("status_code", 200 if result.get("ok") else 502))
        response = JSONResponse(result, status_code=status_code)
        if refreshed_cookie:
            set_session_cookie(response, refreshed_cookie)
        return response

    @app.get("/api/counts/editable")
    async def list_editable_counts(request: Request):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to view your submitted counts."}, status_code=401)
        try:
            rows = await backend_client.list_my_editable_counts(session["access_token"])
            return JSONResponse({"ok": True, "items": rows})
        except Exception as exc:
            return _response_error(exc)

    @app.get("/api/offerings/editable")
    async def list_editable_offerings(request: Request):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to view your submitted offerings."}, status_code=401)
        try:
            rows = await backend_client.list_my_editable_offerings(session["access_token"])
            return JSONResponse({"ok": True, "items": rows})
        except Exception as exc:
            return _response_error(exc)

    @app.get("/api/offerings/preflight")
    async def offering_preflight(request: Request):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in before checking this offering."}, status_code=401)
        try:
            params = request.query_params
            item = await backend_client.check_offering_preflight(
                location_id=params.get("location_id", ""), service_date=params.get("service_date", ""),
                fund_type=params.get("fund_type", "offering"), program_domain=params.get("program_domain", ""),
                program_type=params.get("program_type", ""), event_id=params.get("event_id") or None,
                access_token=session["access_token"],
            )
            return JSONResponse({"ok": True, **item})
        except Exception as exc:
            return _response_error(exc)

    @app.post("/api/offerings/{offering_id}/edit")
    async def edit_submitted_offering(request: Request, offering_id: str):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to edit your submitted offering."}, status_code=401)
        try:
            UUID(offering_id)
            payload = await request.json()
            item = await backend_client.edit_offering_submission(offering_id, payload, session["access_token"])
            return JSONResponse({"ok": True, "item": item})
        except Exception as exc:
            return _response_error(exc)

    @app.post("/api/counts/{count_id}/edit")
    async def edit_submitted_count(request: Request, count_id: str):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to edit your submitted count."}, status_code=401)
        try:
            UUID(count_id)
            payload = await request.json()
            result = await backend_client.edit_count_submission(count_id, payload, session["access_token"])
            return JSONResponse({"ok": True, "item": result})
        except Exception as exc:
            return _response_error(exc)

    @app.get("/api/submissions/{resource}/editable")
    async def list_editable_submissions(request: Request, resource: str):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to view submitted records."}, status_code=401)
        try:
            rows = await backend_client.list_my_editable_records(resource, session["access_token"])
            return JSONResponse({"ok": True, "items": rows})
        except Exception as exc:
            return _response_error(exc)

    @app.post("/api/submissions/{resource}/{submission_id}/edit")
    async def edit_submitted_record(request: Request, resource: str, submission_id: str):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to edit this record."}, status_code=401)
        try:
            UUID(submission_id)
            payload = await request.json()
            result = await backend_client.edit_submission(resource, submission_id, payload, session["access_token"])
            return JSONResponse({"ok": True, "item": result})
        except Exception as exc:
            return _response_error(exc)

    @app.post("/api/counts/groups/{count_id}/close")
    async def close_submitted_count_group(request: Request, count_id: str):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to close this count group."}, status_code=401)
        try:
            UUID(count_id)
            payload = await request.json()
            result = await backend_client.close_count_group(count_id, payload, session["access_token"])
            return JSONResponse({"ok": True, **result})
        except Exception as exc:
            return _response_error(exc)

    @app.get("/api/counts/suggestions/{location_id}")
    async def list_count_section_suggestions(request: Request, location_id: str, program_domain: str = ""):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to view section suggestions."}, status_code=401)
        try:
            UUID(location_id)
            rows = await backend_client.list_count_section_suggestions(location_id, session["access_token"], program_domain)
            return JSONResponse({"ok": True, "items": rows})
        except Exception as exc:
            return _response_error(exc)

    @app.get("/api/counts/services/{location_id}")
    async def list_prior_count_services(request: Request, location_id: str, program_type: str = "", event_id: str = ""):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to view service options."}, status_code=401)
        try:
            UUID(location_id)
            service_date = request.query_params.get("date", "")
            date.fromisoformat(service_date[:10])
            services = await backend_client.list_prior_count_services(location_id, service_date[:10], program_type, event_id or None, session["access_token"])
            return JSONResponse({"ok": True, "services": services})
        except Exception as exc:
            return _response_error(exc)

    @app.put("/api/counts/suggestions/{location_id}")
    async def update_count_section_suggestions(request: Request, location_id: str):
        session = _session(request)
        if not session:
            return JSONResponse({"ok": False, "error": "Sign in to manage section suggestions."}, status_code=401)
        try:
            UUID(location_id)
            payload = await request.json()
            result = await backend_client.update_count_section_suggestions(location_id, payload, session["access_token"])
            return JSONResponse({"ok": True, **result})
        except Exception as exc:
            return _response_error(exc)

    @app.get("/api/validate-location")
    def validate_location(level: str = "", location_id: str = ""):
        """Syntax-only helper; authorization and existence are backend responsibilities."""
        ok, msg = validate_location_code(level, location_id)
        return JSONResponse({"valid": ok, "message": msg})
