"""Ecclesiastical Setup screen route."""
from __future__ import annotations

from typing import Any
from fasthtml.common import Button, Div, Form, H2, H3, I, Input, Label, Option, P, Select, Small, Span
from faststrap import Card, Col, Fx, Row

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
                        Option("Select Section...", value=""),
                        *[Option(label, value=key) for key, label in CHURCH_TYPES],
                        id="page_church_type",
                        cls="form-select rounded-3 mb-3",
                        required=True,
                    ),
                ),

                # 2. Program Domain
                Div(
                    Label("2. Program Domain *", for_="page_program_domain", cls="form-label small fw-bold text-muted mb-1"),
                    Select(
                        Option("Select Domain...", value=""),
                        *[Option(label, value=key) for key, label in PROGRAM_DOMAINS],
                        id="page_program_domain",
                        cls="form-select rounded-3 mb-3",
                        required=True,
                    ),
                ),

                # 3. Program Type
                Div(
                    Label("3. Program / Service Type *", for_="page_program_type", cls="form-label small fw-bold text-muted mb-1"),
                    Select(
                        Option("Select Program...", value=""),
                        *[
                            Option(item, value=item, data_domain=domain)
                            for domain, types in PROGRAM_TYPES_BY_DOMAIN.items()
                            for item in types
                        ],
                        id="page_program_type",
                        cls="form-select rounded-3 mb-3",
                        required=True,
                    ),
                ),

                Input(id="page_program_level", type="hidden", value="Local"),
                Div(
                    Label("4. Assigned Church Location", for_="page_location_label", cls="form-label small fw-bold text-muted mb-1"),
                    Input(id="page_location_label", type="text", cls="form-control rounded-3 mb-1 bg-light", readonly=True,
                          placeholder="Loaded from your signed-in account"),
                    Input(id="page_location_id", type="hidden"),
                    Small("Your signed-in account determines the authorized location.", cls="form-text d-block mb-3"),
                ),

                # 6. Service Date
                Div(
                    Label("6. Service Date *", for_="page_service_date", cls="form-label small fw-bold text-muted mb-1"),
                    Input(
                        id="page_service_date",
                        type="date",
                        cls="form-control rounded-3 mb-4",
                        required=True,
                    ),
                ),

                Div(
                    Label("7. Scheduled Event (optional)", for_="page_event_id", cls="form-label small fw-bold text-muted mb-1"),
                    Select(Option("Select date and program first", value=""), id="page_event_id",
                           cls="form-select rounded-3 mb-1", disabled=True),
                    Small("Routine reports use the service metadata above. Crusade reports must select their scheduled event.",
                          cls="form-text d-block mb-3"),
                ),

                # Action Button
                Button(
                    I(cls="bi bi-check2-circle me-1"), "Save Ecclesiastical Identity",
                    type="button",
                    id="btn-save-page-setup",
                    cls=f"btn btn-primary w-100 rounded-pill py-3 fw-bold {Fx.base} {Fx.hover_lift}"
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
