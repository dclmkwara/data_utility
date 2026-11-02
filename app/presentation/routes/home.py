"""Home Dashboard route for DCLM Field Utility."""
from __future__ import annotations

from typing import Any
from fasthtml.common import A, Div, H2, H3, I, P, Small, Span
from faststrap import Card, Col, Fx, Row

from ..components.shell import app_shell


def setup_home_routes(app: Any) -> None:
    @app.get("/")
    def home_page():
        # Top Welcome Hero Banner
        hero_card = Card(
            Div(
                Span("Deeper Life Bible Church", cls="dclm-hero-tagline d-block"),
                H2("Field Utility", cls="dclm-hero-title mb-1"),
                P("Offline-first headcounts, attendance & field registration.", cls="small mb-0", style="color: rgba(255,255,255,0.65)"),
                cls="dclm-total-display py-4"
            ),
            cls=f"dclm-card dclm-card--navy mb-3 {Fx.base} {Fx.fade_in}"
        )

        queue_card = A(
            Div(
                Div(
                    I(cls="bi bi-cloud-arrow-up-fill fs-4 text-primary me-3"),
                    Div(
                        H3("Pending uploads", cls="h6 fw-bold text-dark mb-1"),
                        Small("Your saved records stay on this device until they sync.",
                              id="home-queue-caption", cls="text-muted d-block"),
                    ),
                    cls="d-flex align-items-center min-w-0",
                ),
                Span("Checking…", id="home-queue-count", cls="badge text-bg-light border"),
                cls="d-flex align-items-center justify-content-between gap-2 p-3",
            ),
            href="/queues",
            id="home-queue-card",
            cls="dclm-card d-block text-decoration-none mb-3",
            aria_label="Review pending uploads",
        )

        # Four primary tools; the sync queue is promoted above this grid.
        tools_grid = Row(
            Col(
                A(
                    Div(
                        I(cls="bi bi-people-fill text-primary fs-1 mb-2 d-block"),
                        H3("Population Count", cls="h6 fw-bold text-dark mb-1"),
                        Small("6-group demographic counter with haptics", cls="text-muted d-block"),
                        cls="p-3 text-center"
                    ),
                    href="/counter",
                    cls=f"dclm-card d-block text-decoration-none h-100 {Fx.base} {Fx.hover_lift}"
                ),
                cols=6, cls="mb-3"
            ),
            Col(
                A(
                    Div(
                        I(cls="bi bi-person-check-fill text-success fs-1 mb-2 d-block"),
                        H3("Workers Attendance", cls="h6 fw-bold text-dark mb-1"),
                        Small("Roster search, check-in & usher review", cls="text-muted d-block"),
                        cls="p-3 text-center"
                    ),
                    href="/attendance",
                    cls=f"dclm-card d-block text-decoration-none h-100 {Fx.base} {Fx.hover_lift}"
                ),
                cols=6, cls="mb-3"
            ),
            Col(
                A(
                    Div(
                        I(cls="bi bi-person-plus-fill text-info fs-1 mb-2 d-block"),
                        H3("Newcomer / Convert", cls="h6 fw-bold text-dark mb-1"),
                        Small("Field registration & follow-up intake", cls="text-muted d-block"),
                        cls="p-3 text-center"
                    ),
                    href="/registration",
                    cls=f"dclm-card d-block text-decoration-none h-100 {Fx.base} {Fx.hover_lift}"
                ),
                cols=6, cls="mb-3"
            ),
            Col(
                A(
                    Div(
                        I(cls="bi bi-house-heart-fill text-danger fs-1 mb-2 d-block"),
                        H3("Home Fellowship", cls="h6 fw-bold text-dark mb-1"),
                        Small("Attendance, member intake & fellowship offering", cls="text-muted d-block"),
                        cls="p-3 text-center"
                    ),
                    href="/fellowship",
                    cls=f"dclm-card d-block text-decoration-none h-100 {Fx.base} {Fx.hover_lift}"
                ),
                cols=6, cls="mb-3"
            ),
            cls="g-2"
        )

        # Secondary Links
        secondary_card = Card(
            Div(
                A(
                    Div(
                        I(cls="bi bi-journal-text fs-4 text-primary me-3"),
                        Div(
                            Span("Program Information Sheet", cls="fw-bold text-dark d-block"),
                            Small("Bible study topics, scripture texts & notices", cls="text-muted"),
                        ),
                        cls="d-flex align-items-center"
                    ),
                    I(cls="bi bi-chevron-right text-muted"),
                    href="/information",
                    cls="text-decoration-none d-flex justify-content-between align-items-center p-2 mb-2 border-bottom"
                ),
                A(
                    Div(
                        I(cls="bi bi-sliders fs-4 text-secondary me-3"),
                        Div(
                            Span("Service setup", cls="fw-bold text-dark d-block"),
                            Small("Choose the church section and service details", cls="text-muted"),
                        ),
                        cls="d-flex align-items-center"
                    ),
                    I(cls="bi bi-chevron-right text-muted"),
                    href="/setup",
                    cls="text-decoration-none d-flex justify-content-between align-items-center p-2 mb-2 border-bottom"
                ),
                A(
                    Div(
                        I(cls="bi bi-gear-fill fs-4 text-secondary me-3"),
                        Div(
                            Span("App Settings", cls="fw-bold text-dark d-block"),
                            Small("Data management, sync status & info", cls="text-muted"),
                        ),
                        cls="d-flex align-items-center"
                    ),
                    I(cls="bi bi-chevron-right text-muted"),
                    href="/settings",
                    cls="text-decoration-none d-flex justify-content-between align-items-center p-2"
                ),
            ),
            cls="dclm-card mb-4"
        )

        return app_shell(
            active_screen="home",
            page_title="Home",
            content=Div(
                hero_card,
                queue_card,
                tools_grid,
                secondary_card,
                cls="dclm-page-content"
            ),
        )
