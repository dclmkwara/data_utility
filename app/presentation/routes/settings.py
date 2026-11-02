"""App Settings and Configuration route."""
from __future__ import annotations

from typing import Any
from fasthtml.common import A, Button, Div, H3, I, P, Small, Span
from faststrap import Card, Col, Fx, Row

from ..components.shell import app_shell


def setup_settings_routes(app: Any) -> None:
    @app.get("/settings")
    def settings_page():
        # Sync Status Card
        sync_card = Card(
            Div(
                H3("Cloud Sync Status", cls="h6 fw-bold text-dark mb-2"),
                Div(
                    Div(
                        Span("Last Sync", cls="text-muted small"),
                        Span("Not yet synced", id="settings-last-sync", cls="small fw-bold text-dark d-block"),
                    ),
                    cls="p-2 bg-light rounded-3 mb-3"
                ),
                Button(
                    I(cls="bi bi-arrow-repeat me-1"), "Clear Worker Roster Cache",
                    type="button",
                    id="btn-clear-roster-cache",
                    cls="btn btn-outline-secondary w-100 rounded-pill py-2 mb-2"
                ),
                Button(
                    I(cls="bi bi-trash3 me-1"), "Clear My Offline Data",
                    type="button",
                    id="btn-clear-all-data",
                    cls="btn btn-outline-danger w-100 rounded-pill py-2"
                ),
            ),
            cls="dclm-card mb-3"
        )

        # App Info Card
        info_card = Card(
            Div(
                H3("Application Information", cls="h6 fw-bold text-dark mb-3"),
                Div(
                    Row(
                        Col(Span("App Version", cls="text-muted small"), cols=6),
                        Col(Span("1.0.0 (Field Utility)", cls="small fw-bold text-dark text-end"), cols=6),
                        cls="mb-2"
                    ),
                    Row(
                        Col(Span("Backend API", cls="text-muted small"), cols=5),
                        Col(Span("DCLM Church Server", cls="small fw-bold text-dark text-end"), cols=7),
                        cls="mb-2"
                    ),
                    Row(
                        Col(Span("Storage", cls="text-muted small"), cols=5),
                        Col(Span("IndexedDB (Offline-First)", cls="small fw-bold text-dark text-end"), cols=7),
                        cls="mb-2"
                    ),
                    Row(
                        Col(Span("PWA Mode", cls="text-muted small"), cols=5),
                        Col(Span("Service Worker Active", cls="small fw-bold text-success text-end"), cols=7),
                    ),
                    cls="p-2 bg-light rounded-3"
                ),
            ),
            cls="dclm-card mb-3"
        )

        # Quick Links
        links_card = Card(
            Div(
                A(
                    Div(
                        I(cls="bi bi-sliders fs-4 text-primary me-3"),
                        Div(
                            Span("Ecclesiastical Setup", cls="fw-bold text-dark d-block"),
                            Small("Update church wing, location & service date", cls="text-muted"),
                        ),
                        cls="d-flex align-items-center"
                    ),
                    I(cls="bi bi-chevron-right text-muted"),
                    href="/setup",
                    cls="text-decoration-none d-flex justify-content-between align-items-center p-2 mb-2 border-bottom"
                ),
                A(
                    Div(
                        I(cls="bi bi-cloud-arrow-up fs-4 text-success me-3"),
                        Div(
                            Span("Sync Queues", cls="fw-bold text-dark d-block"),
                            Small("View and push all pending offline records", cls="text-muted"),
                        ),
                        cls="d-flex align-items-center"
                    ),
                    I(cls="bi bi-chevron-right text-muted"),
                    href="/queues",
                    cls="text-decoration-none d-flex justify-content-between align-items-center p-2 mb-2 border-bottom"
                ),
                A(
                    Div(
                        I(cls="bi bi-journal-text fs-4 text-info me-3"),
                        Div(
                            Span("Program Information", cls="fw-bold text-dark d-block"),
                            Small("Service outline, study notes & announcements", cls="text-muted"),
                        ),
                        cls="d-flex align-items-center"
                    ),
                    I(cls="bi bi-chevron-right text-muted"),
                    href="/information",
                    cls="text-decoration-none d-flex justify-content-between align-items-center p-2"
                ),
            ),
            cls="dclm-card mb-4"
        )

        return app_shell(
            active_screen="settings",
            page_title="App Settings",
            subtitle="Data management, sync status, and application configuration.",
            content=Div(
                sync_card,
                info_card,
                links_card,
                cls="dclm-page-content"
            ),
        )
