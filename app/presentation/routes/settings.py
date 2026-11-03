"""App Settings and Configuration route."""
from __future__ import annotations

from typing import Any
from fasthtml.common import A, Button, Div, H3, I, Input, Label, Option, P, Select, Small, Span
from faststrap import Card, Col, Fx, Row

from ..components.shell import app_shell


def setup_settings_routes(app: Any) -> None:
    @app.get("/settings")
    def settings_page():
        account_card = Card(
            Div(
                H3("Signed-in account", cls="h6 fw-bold text-dark mb-3"),
                Row(Col(Span("Name", cls="text-muted small"), cols=4),
                    Col(Span("Loading account…", id="settings-user-name", cls="small fw-semibold text-dark text-end"), cols=8), cls="mb-2"),
                Row(Col(Span("Email", cls="text-muted small"), cols=4),
                    Col(Span("", id="settings-user-email", cls="small fw-semibold text-dark text-end"), cols=8), cls="mb-2"),
                Row(Col(Span("Role", cls="text-muted small"), cols=4),
                    Col(Span("", id="settings-user-role", cls="small fw-semibold text-dark text-end"), cols=8), cls="mb-2"),
                Row(Col(Span("Location", cls="text-muted small"), cols=4),
                    Col(Span("", id="settings-user-location", cls="small fw-semibold text-dark text-end"), cols=8)),
            ),
            cls="dclm-card mb-3"
        )

        storage_card = Card(
            Div(
                H3("Offline data & sync", cls="h6 fw-bold text-dark mb-2"),
                P("Pending records are stored on this device until the connection is available.", cls="text-muted small mb-3"),
                Label("Record submission", for_="submission-mode", cls="form-label small fw-semibold"),
                Select(
                    Option("Submit as soon as I save", value="instant"),
                    Option("Queue first; submit when I choose Sync", value="queue_first"),
                    id="submission-mode", cls="form-select mb-2",
                ),
                Small("Instant mode sends records directly while online and saves them on this device if submission fails. Queue-first mode keeps them here until you submit from Sync Queues.",
                      id="submission-mode-help", cls="text-muted d-block mb-3"),
                Div(
                    Div(
                        Div(Span("Touch vibration", cls="fw-semibold text-dark d-block"), Small("Haptic feedback for counts and attendance", cls="text-muted")),
                        Input(type="checkbox", id="setting-haptics-enabled", role="switch", cls="form-check-input ms-3", aria_label="Enable touch vibration"),
                        cls="d-flex align-items-center justify-content-between",
                    ),
                    Button("Test vibration", type="button", id="btn-test-haptics", cls="btn btn-sm btn-outline-primary rounded-pill mt-2"),
                    Small("Checking vibration support...", id="settings-haptics-status", cls="text-muted d-block mt-2"),
                    cls="p-3 bg-light rounded-3 mb-3",
                ),
                Div(
                    Span("Last successful sync", cls="text-muted small"),
                    Span("Not yet synced", id="settings-last-sync", cls="small fw-semibold text-dark d-block"),
                    cls="p-2 bg-light rounded-3 mb-3"
                ),
                A(I(cls="bi bi-cloud-arrow-up me-2"), "Review pending uploads", href="/queues",
                  cls="btn btn-outline-primary w-100 mb-3"),
                Button(I(cls="bi bi-arrow-repeat me-1"), "Clear worker roster cache", type="button",
                       id="btn-clear-roster-cache", cls="btn btn-outline-secondary w-100 mb-2"),
                Button(I(cls="bi bi-trash3 me-1"), "Clear offline data", type="button",
                       id="btn-clear-all-data", cls="btn btn-outline-danger w-100"),
            ),
            cls="dclm-card mb-3"
        )

        app_info_card = Card(
            Div(
                H3("About this app", cls="h6 fw-bold text-dark mb-3"),
                P("DCLM Field Utility · Version 1.0.0", cls="small text-dark mb-2"),
                P("Church records are protected by your assigned account and location access.", cls="text-muted small mb-0"),
                Div(id="settings-connection-status", cls="small text-muted mt-3"),
            ),
            cls="dclm-card mb-4"
        )

        links_card = Card(
            Div(
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
                account_card,
                storage_card,
                app_info_card,
                links_card,
                cls="dclm-page-content"
            ),
        )
