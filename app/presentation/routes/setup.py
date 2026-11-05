"""Ecclesiastical Setup screen route."""
from __future__ import annotations

from typing import Any
from fasthtml.common import Div, Form, H3, I, Label, Small, Span
from faststrap import Button, Card, Fx, Input, Select

from ...core.constants import CHURCH_TYPES, PROGRAM_DOMAINS, PROGRAM_TYPES_BY_DOMAIN
from ..components.shell import app_shell


def setup_setup_routes(app: Any) -> None:
    @app.get("/setup")
    def setup_page():
        form_card = Card(
            Form(
                H3("Ecclesiastical Configuration", cls="h6 fw-bold text-dark mb-3"),

                # 1. Church Wing
                Div(
                    Label("1. Church Section / Wing *", for_="page_church_type", cls="form-label small fw-bold text-muted mb-1"),
                    Select(
                        "page_church_type",
                        ("", "Select Section..."),
                        *[(key, label) for key, label in CHURCH_TYPES],
                        id="page_church_type",
                        cls="mb-3",
                        required=True,
                    ),
                ),

                # 2. Program Domain
                Div(
                    Label("2. Program Domain *", for_="page_program_domain", cls="form-label small fw-bold text-muted mb-1"),
                    Select(
                        "page_program_domain",
                        ("", "Select Domain..."),
                        *[(key, label) for key, label in PROGRAM_DOMAINS],
                        id="page_program_domain",
                        cls="mb-3",
                        required=True,
                    ),
                ),

                # 3. Program Type
                Div(
                    Label("3. Program / Service Type *", for_="page_program_type", cls="form-label small fw-bold text-muted mb-1"),
                    Select(
                        "page_program_type",
                        ("", "Select Program..."),
                        *[(item, item) for types in PROGRAM_TYPES_BY_DOMAIN.values() for item in types],
                        id="page_program_type",
                        cls="mb-3",
                        required=True,
                    ),
                ),

                Div(
                    Label("4. Reporting level", for_="page_program_level", cls="form-label small fw-bold text-muted mb-1"),
                    Select(
                        "page_program_level",
                        ("Local", "Location", True), ("Group", "Group"), ("Region", "Region"), ("State", "State"),
                        id="page_program_level",
                        cls="mb-3",
                        required=True,
                    ),
                ),
                Div(
                    Label("5. Reporting Location ID (editable)", for_="page_reporting_scope_code", cls="form-label small fw-bold text-muted mb-1"),
                    Input("page_reporting_scope_code", input_type="text", id="page_reporting_scope_code",
                          cls="mb-1", placeholder="DCL-234-KW-ILR-ILE-003", required=True, autocomplete="off"),
                    Small("Defaults to your location. For a Group or Region service, select its scheduled event; the ID must match that event's authorized scope.",
                          cls="form-text d-block mb-3"),
                ),
                Div(
                    Label("Collection location", for_="page_location_label", cls="form-label small fw-bold text-muted mb-1"),
                    Input("page_location_label", input_type="text", id="page_location_label", cls="mb-1 bg-light", readonly=True,
                          placeholder="Loaded from your signed-in account"),
                    Input("page_location_id", input_type="hidden", id="page_location_id"),
                    Small("The signed-in account remains the collection source. The scheduled event controls broader reporting scope.", cls="form-text d-block mb-3"),
                ),

                # 6. Service Date
                Div(
                    Label("6. Service Date *", for_="page_service_date", cls="form-label small fw-bold text-muted mb-1"),
                    Input(
                        "page_service_date",
                        input_type="date",
                        id="page_service_date",
                        cls="mb-4",
                        required=True,
                    ),
                ),

                Div(
                    Label("7. Scheduled Event (optional)", for_="page_event_id", cls="form-label small fw-bold text-muted mb-1"),
                    Select("page_event_id", ("", "Select date and program first"), id="page_event_id",
                           disabled=True),
                    Small("Select the matching scheduled event for combined Group/Region/State services. Crusade reports always require an event.",
                          cls="form-text d-block mb-3"),
                ),

                # Action Button
                Button(
                    I(cls="bi bi-check2-circle me-1"), "Save Ecclesiastical Identity",
                    type="button",
                    id="btn-save-page-setup",
                    variant="primary", pill=True,
                    cls=f"w-100 py-3 fw-bold {Fx.base} {Fx.hover_lift}"
                ),
                id="page-setup-form",
            ),
            cls="dclm-card mb-4"
        )

        return app_shell(
            active_screen="setup",
            page_title="Program Setup",
            subtitle="Define the active church wing, location scope, and service date.",
            content=Div(
                form_card,
            ),
        )
