"""Offline Queue and Cloud Sync Dashboard screen route."""
from __future__ import annotations

from typing import Any
from fasthtml.common import Button, Div, H3, I, Input, Label, P, Small, Span
from faststrap import Card, Col, Fx, Modal, Row

from ...core.constants import COUNT_CATEGORIES

from ..components.shell import app_shell


def setup_queue_routes(app: Any) -> None:
    @app.get("/queues")
    def queues_page():
        # Top Sync Command Card
        sync_banner = Card(
            Div(
                Div(
                    H3("Offline Sync Manager", cls="h6 fw-bold text-white mb-1"),
                P("Saved records stay on this device until they are submitted to the church records service.", cls="text-white-50 small mb-0"),
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

        submitted_counts = Card(
            Div(
                H3("Submitted counts you can still edit", cls="h6 fw-bold mb-1"),
                P("Only your own pending or returned counts appear here. Approval locks a count. Returned reports show the pastor's reason.", cls="small text-muted mb-2"),
                Div(P("Loading your submitted counts…", cls="small text-muted"), id="submitted-count-edits"),
            ),
            cls="dclm-card mb-3",
        )

        submitted_offerings = Card(
            Div(
                H3("Submitted offerings you can still edit", cls="h6 fw-bold mb-1"),
                P("Your offering edits are limited to 24 hours and three changes; approval locks the record. A pastor may return it to reopen the edit window.", cls="small text-muted mb-2"),
                Div(P("Loading your submitted offerings…", cls="small text-muted"), id="submitted-offering-edits"),
            ),
            cls="dclm-card mb-3",
        )

        submitted_attendance = Card(
            Div(H3("Submitted worker attendance you can still edit", cls="h6 fw-bold mb-1"),
                P("Your own attendance captures can be edited for 24 hours, up to three times. Each change is recorded.", cls="small text-muted mb-2"),
                Div(P("Loading your submitted worker attendance…", cls="small text-muted"), id="submitted-worker-attendance-edits")),
            cls="dclm-card mb-3",
        )
        submitted_fellowship = Card(
            Div(H3("Submitted fellowship records you can still edit", cls="h6 fw-bold mb-1"),
                P("Fellowship attendance and offerings can be edited for 24 hours, up to three times. Each change is recorded.", cls="small text-muted mb-2"),
                Div(P("Loading your submitted fellowship attendance…", cls="small text-muted"), id="submitted-fellowship-attendance-edits"),
                Div(P("Loading your submitted fellowship offerings…", cls="small text-muted"), id="submitted-fellowship-offering-edits")),
            cls="dclm-card mb-3",
        )

        count_edit_rows = [
            Div(
                Label(category["label"], for_=f"queued_edit_{category['key']}", cls="form-label small fw-semibold"),
                Input(id=f"queued_edit_{category['key']}", type="number", min="0", step="1", inputmode="numeric",
                      cls="form-control", required=True),
                cls="mb-2",
            )
            for category in COUNT_CATEGORIES
        ]
        edit_count_modal = Modal(
            Div(
                *count_edit_rows,
                Div(
                    Button("Cancel", type="button", data_bs_dismiss="modal", cls="btn btn-outline-secondary rounded-pill px-4"),
                    Button("Save changes", type="button", id="btn-save-queued-count", cls="btn btn-primary rounded-pill px-4 fw-semibold"),
                    cls="d-flex justify-content-end gap-2 pt-3 border-top mt-3",
                ),
                id="queued-count-edit-form",
            ),
            modal_id="queuedCountEditModal",
            title="Edit pending population count",
        )

        return app_shell(
            active_screen="queues",
            page_title="Sync Queues",
            subtitle="Review pending offline batches and trigger cloud synchronization.",
            content=Div(
                sync_banner,
                pending_section,
                submitted_counts,
                submitted_offerings,
                submitted_attendance,
                submitted_fellowship,
                recent_section,
                edit_count_modal,
            ),
        )
