"""Offline Queue and Cloud Sync Dashboard screen route."""
from __future__ import annotations

from typing import Any
from fasthtml.common import Button, Div, H3, I, P, Small, Span
from faststrap import Card, Col, Fx, Row

from ..components.shell import app_shell


def setup_queue_routes(app: Any) -> None:
    @app.get("/queues")
    def queues_page():
        # Top Sync Command Card
        sync_banner = Card(
            Div(
                Div(
                    H3("Offline Sync Manager", cls="h6 fw-bold text-white mb-1"),
                    P("Batches are stored securely in IndexedDB until pushed to the church cloud server.", cls="text-white-50 small mb-0"),
                ),
                Button(
                    I(cls="bi bi-cloud-arrow-up-fill me-2"), "Sync All Pending to Cloud",
                    type="button",
                    id="btn-sync-all-queues",
                    cls=f"btn btn-success btn-lg rounded-pill px-4 py-2 mt-3 fw-bold w-100 {Fx.base} {Fx.hover_lift}"
                ),
                cls="p-3 text-center"
            ),
            cls=f"dclm-card dclm-card--navy mb-3 {Fx.base} {Fx.fade_in}"
        )

        # Pending Batches Section
        pending_section = Div(
            Div(
                P("Older saved records have no account owner yet. Claiming assigns them to your signed-in account.",
                  id="legacy-queue-message", cls="small mb-2"),
                Button("Review and claim older saved records", type="button", id="btn-claim-legacy-queues",
                       cls="btn btn-sm btn-outline-primary rounded-pill"),
                id="legacy-queue-notice", cls="alert alert-warning d-none mb-3",
            ),
            Div(
                H3("Unsubmitted Batches", cls="small fw-bold text-muted text-uppercase tracking-wider mb-0"),
                Span("0 Batches", id="pending-queue-badge", cls="badge bg-warning-subtle text-warning-emphasis rounded-pill px-3"),
                cls="d-flex justify-content-between align-items-center mb-2 px-1"
            ),
            Div(
                Div(
                    I(cls="bi bi-inbox text-muted display-4 mb-2 d-block"),
                    P("All captured records are synced or no pending batches exist.", cls="text-muted small mb-0"),
                    id="pending-queue-empty",
                    cls="text-center py-4"
                ),
                id="pending-queue-list",
                cls="mb-4"
            )
        )

        # Recent History Section
        recent_section = Div(
            Div(
                H3("Recently Synced to Cloud", cls="small fw-bold text-muted text-uppercase tracking-wider mb-2 px-1"),
            ),
            Div(
                Div(
                    I(cls="bi bi-clock-history text-muted fs-2 mb-2 d-block"),
                    P("Recent cloud confirmations will appear here.", cls="text-muted small mb-0"),
                    id="recent-queue-empty",
                    cls="text-center py-4"
                ),
                id="recent-queue-list",
                cls="mb-4"
            )
        )

        return app_shell(
            active_screen="queues",
            page_title="Sync Queues",
            subtitle="Review pending offline batches and trigger cloud synchronization.",
            content=Div(
                sync_banner,
                pending_section,
                recent_section,
            ),
        )
