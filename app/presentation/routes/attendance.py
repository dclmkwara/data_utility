"""Workers & Leaders Attendance with Instant Offline Roster Search."""
from __future__ import annotations

from typing import Any
from fasthtml.common import A, Button, Div, H3, I, Input, P, Small, Span
from faststrap import Card, Col, Fx, Row

from ..components.identity_guard import setup_required_shield
from ..components.shell import app_shell


def setup_attendance_routes(app: Any) -> None:
    @app.get("/attendance")
    def attendance_page():
        # Search & Metric Strip
        search_card = Div(
            Div(
                I(cls="bi bi-search dclm-search-icon"),
                Input(
                    id="worker-search-input",
                    type="search",
                    placeholder="Search by worker name, phone or unit...",
                    cls="form-control dclm-search-input w-100",
                    autocomplete="off",
                ),
                cls="dclm-search-wrap"
            ),
            Div(
                Div(
                    Span("Roster: ", cls="text-muted small"),
                    Span("0", id="roster-total-count", cls="fw-bold text-dark me-3"),
                    Span("Checked: ", cls="text-muted small"),
                    Span("0", id="roster-marked-count", cls="fw-bold text-success me-3"),
                    cls="d-flex align-items-center"
                ),
                Button(
                    I(cls="bi bi-arrow-repeat me-1"), "Refresh Roster",
                    type="button",
                    id="btn-refresh-worker-roster",
                    cls="btn btn-sm btn-outline-secondary rounded-pill px-3"
                ),
                cls="d-flex justify-content-between align-items-center mb-3 px-1"
            ),
        )

        # Worker List Container
        worker_list_container = Div(
            Div(
                I(cls="bi bi-people display-4 text-muted mb-2 d-block"),
                P("Configure your location setup to load workers for this service.", cls="text-muted small mb-0"),
                id="attendance-empty-state",
                cls="text-center py-5"
            ),
            id="worker-roster-list",
            cls="mb-4"
        )

        # Bottom Usher Review Link
        review_gate = Div(
            A(
                I(cls="bi bi-clipboard-check-fill me-2"), "Review & Approve Attendance",
                href="/attendance/review",
                cls=f"btn btn-primary w-100 btn-lg rounded-pill py-3 fw-bold {Fx.base} {Fx.hover_lift}"
            ),
            P(
                "Workers can mark their attendance above. Final batch submission is reserved for the usher review screen.",
                cls="text-muted small text-center mt-2 px-3"
            ),
            cls="mb-4"
        )

        return app_shell(
            active_screen="attendance",
            page_title="Workers Attendance",
            subtitle="Search cached workers locally, self-check-in with instant haptics.",
            content=Div(
                setup_required_shield("Workers Attendance"),
                Div(
                    search_card,
                    worker_list_container,
                    review_gate,
                    id="attendance-content-wrap"
                ),
            ),
        )

    @app.get("/attendance/review")
    def attendance_review_page():
        # Review & Approval Screen
        summary_card = Card(
            Div(
                H3("Attendance Submission Review", cls="h6 fw-bold text-dark mb-3"),
                Div(
                    Row(
                        Col(Span("Ecclesiastical Scope:", cls="text-muted small"), cols=5),
                        Col(Span("Not Set", id="review-setup-scope", cls="small fw-bold text-dark text-end"), cols=7),
                        cls="mb-2"
                    ),
                    Row(
                        Col(Span("Total Present:", cls="text-muted small"), cols=5),
                        Col(Span("0 Workers", id="review-present-count", cls="h5 fw-bold text-success text-end mb-0"), cols=7),
                        cls="mb-2"
                    ),
                    Row(
                        Col(Span("Total on Roster:", cls="text-muted small"), cols=5),
                        Col(Span("0 Workers", id="review-roster-count", cls="small text-muted text-end"), cols=7),
                        cls="mb-1"
                    ),
                    cls="p-2 bg-light rounded-3 mb-3"
                ),
                H3("Marked Workers Roster", cls="small fw-bold text-muted text-uppercase tracking-wider mb-2"),
                Div(id="review-marked-list", cls="d-flex flex-column gap-2 mb-3"),
            ),
            cls="dclm-card mb-3"
        )

        actions = Div(
            Row(
                Col(
                    A(
                        "Back to Check-in",
                        href="/attendance",
                        cls="btn btn-outline-secondary w-100 rounded-pill py-2"
                    ),
                    cols=5
                ),
                Col(
                    Button(
                        I(cls="bi bi-check2-circle me-1"), "Approve & Queue Batch",
                        type="button",
                        id="btn-approve-attendance-batch",
                        cls=f"btn btn-success w-100 rounded-pill py-2 fw-bold {Fx.base} {Fx.hover_lift}"
                    ),
                    cols=7
                ),
                cls="g-2"
            ),
            cls="mb-4"
        )

        return app_shell(
            active_screen="attendance",
            page_title="Attendance Review",
            subtitle="Head usher verification and sign-off before cloud synchronization.",
            content=Div(
                summary_card,
                actions,
            ),
        )
