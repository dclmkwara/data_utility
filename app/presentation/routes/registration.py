"""Newcomer and Convert Registration Form route."""
from __future__ import annotations

from typing import Any
from fasthtml.common import Button, Details, Div, Form, I, Input, Label, Option, P, Select, Span, Summary, Textarea
from faststrap import Card, Col, Fx, Row

from ...core.constants import MARITAL_STATUSES, SALVATION_TYPES, SOCIAL_STATUSES
from ..components.identity_guard import setup_required_shield
from ..components.shell import app_shell


def setup_registration_routes(app: Any) -> None:
    @app.get("/registration")
    def registration_page():
        # Segmented Decision Toggle: Convert vs Newcomer
        decision_toggle = Div(
            Row(
                Col(
                    Button(
                        I(cls="bi bi-heart-fill me-1"), "Fresh Convert",
                        type="button",
                        id="toggle-btn-convert",
                        cls="btn btn-primary w-100 rounded-pill py-2 fw-semibold",
                    ),
                    cols=6
                ),
                Col(
                    Button(
                        I(cls="bi bi-person-badge me-1"), "First-Time Guest",
                        type="button",
                        id="toggle-btn-newcomer",
                        cls="btn btn-outline-secondary w-100 rounded-pill py-2 fw-semibold",
                    ),
                    cols=6
                ),
                cls="g-2 mb-3"
            )
        )

        form_card = Card(
            Form(
                # Hidden record_type tracker
                Input(type="hidden", id="reg_record_type", value="convert"),

                # Full Name
                Div(
                    Label("Full Name *", for_="reg_full_name", cls="form-label small fw-bold text-muted mb-1"),
                    Input(
                        id="reg_full_name",
                        type="text",
                        placeholder="Brother / Sister full name",
                        maxlength="120",
                        cls="form-control rounded-3 mb-3",
                        required=True,
                    ),
                ),

                # Gender & Phone
                Row(
                    Col(
                        Label("Gender *", for_="reg_gender", cls="form-label small fw-bold text-muted mb-1"),
                        Select(
                            Option("Select...", value=""),
                            Option("Male", value="Male"),
                            Option("Female", value="Female"),
                            id="reg_gender",
                            cls="form-select rounded-3 mb-3",
                            required=True,
                        ),
                        cols=5
                    ),
                    Col(
                        Label("Phone Number *", for_="reg_phone", cls="form-label small fw-bold text-muted mb-1"),
                        Input(
                            id="reg_phone",
                            type="tel",
                            placeholder="080...",
                            maxlength="30",
                            cls="form-control rounded-3 mb-3",
                            required=True,
                        ),
                        cols=7
                    ),
                    cls="g-2"
                ),

                Details(
                    Summary("Optional follow-up details", cls="fw-semibold text-primary py-2"),
                    Div(
                P("Only record extra personal details that are needed for follow-up. You can leave these fields blank.",
                  cls="text-muted small"),
                # Address
                Div(
                    Label("Residential Address", for_="reg_address", cls="form-label small fw-bold text-muted mb-1"),
                    Textarea(
                        "",
                        id="reg_address",
                        rows=2,
                        placeholder="Street, area, nearest bus stop",
                        maxlength="300",
                        cls="form-control rounded-3 mb-3",
                    ),
                ),

                # Marital & Social Status
                Row(
                    Col(
                        Label("Marital Status", for_="reg_marital_status", cls="form-label small fw-bold text-muted mb-1"),
                        Select(
                            Option("Select...", value=""),
                            *[Option(label, value=key) for key, label in MARITAL_STATUSES],
                            id="reg_marital_status",
                            cls="form-select rounded-3 mb-3",
                        ),
                        cols=6
                    ),
                    Col(
                        Label("Social Status", for_="reg_social_status", cls="form-label small fw-bold text-muted mb-1"),
                        Select(
                            Option("Select...", value=""),
                            *[Option(label, value=key) for key, label in SOCIAL_STATUSES],
                            id="reg_social_status",
                            cls="form-select rounded-3 mb-3",
                        ),
                        cols=6
                    ),
                    cls="g-2"
                ),

                # Profession & Workplace
                Row(
                    Col(
                        Label("Profession / School", for_="reg_profession", cls="form-label small fw-bold text-muted mb-1"),
                        Input(id="reg_profession", type="text", maxlength="120", placeholder="Occupation or course", cls="form-control rounded-3 mb-3"),
                        cols=6
                    ),
                    Col(
                        Label("Work / School Address", for_="reg_work_address", cls="form-label small fw-bold text-muted mb-1"),
                        Input(id="reg_work_address", type="text", maxlength="300", placeholder="Company or campus location", cls="form-control rounded-3 mb-3"),
                        cols=6
                    ),
                    cls="g-2"
                ),

                # Class Level & Invited By
                Row(
                    Col(
                        Label("Class Level (Youth/Campus)", for_="reg_class_level", cls="form-label small fw-bold text-muted mb-1"),
                        Input(id="reg_class_level", type="text", maxlength="60", placeholder="e.g. 200L, SS2", cls="form-control rounded-3 mb-3"),
                        cols=6
                    ),
                    Col(
                        Label("Invited By", for_="reg_invited_by", cls="form-label small fw-bold text-muted mb-1"),
                        Input(id="reg_invited_by", type="text", maxlength="120", placeholder="Name of inviting member", cls="form-control rounded-3 mb-3"),
                        cols=6
                    ),
                    cls="g-2"
                ),

                # Salvation Decision Type
                Div(
                    Label("Spiritual Decision / Salvation Type", for_="reg_salvation_type", cls="form-label small fw-bold text-muted mb-1"),
                    Select(
                        Option("Select spiritual status...", value=""),
                        *[Option(label, value=key) for key, label in SALVATION_TYPES],
                        id="reg_salvation_type",
                        cls="form-select rounded-3 mb-4",
                    ),
                ),
                    ),
                    cls="mb-3",
                ),

                # Actions
                Row(
                    Col(
                        Button("Clear Form", type="reset", id="btn-reset-reg-form", cls="btn btn-outline-secondary w-100 rounded-pill py-2"),
                        cols=4
                    ),
                    Col(
                        Button(
                            I(cls="bi bi-person-check-fill me-1"), "Register & Save Offline",
                            type="button",
                            id="btn-submit-registration",
                            cls=f"btn btn-primary w-100 rounded-pill py-2 fw-semibold {Fx.base} {Fx.hover_lift}"
                        ),
                        cols=8
                    ),
                    cls="g-2 pt-2 border-top"
                ),
                id="registration-entry-form",
            ),
            cls="dclm-card mb-4"
        )

        return app_shell(
            active_screen="registration",
            page_title="Field Registration",
            subtitle="Capture converts and first-time guests for church integration and pastoral follow-up.",
            content=Div(
                setup_required_shield("Field Registration"),
                Div(
                    decision_toggle,
                    form_card,
                    id="registration-content-wrap"
                ),
            ),
        )
