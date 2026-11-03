"""Population Counter & Offering Entry screen."""
from __future__ import annotations

from typing import Any
from fasthtml.common import Button, Div, Form, H2, H3, I, Input, Label, Option, P, Select, Small, Span
from faststrap import Card, Col, Fx, Modal, Row

from ...core.constants import COUNT_CATEGORIES, FUND_TYPES, PAYMENT_METHODS
from ..components.identity_guard import setup_required_shield
from ..components.shell import app_shell


def edit_count_modal() -> Any:
    """Modal for manual headcount numeric adjustment."""
    rows = [
        Div(
            Label(cat["label"], for_=f"edit_{cat['key']}", cls="form-label small fw-bold text-muted mb-1"),
            Input(
                type="number",
                min="0",
                value="0",
                id=f"edit_{cat['key']}",
                cls="form-control form-control-lg text-end font-monospace mb-2",
            ),
            cls="mb-2"
        )
        for cat in COUNT_CATEGORIES
    ]

    return Modal(
        Form(
            *rows,
            Div(
                Button("Cancel", type="button", data_bs_dismiss="modal", cls="btn btn-outline-secondary rounded-pill px-4"),
                Button("Apply Corrections", type="button", id="btn-apply-manual-counts", cls="btn btn-primary rounded-pill px-4 fw-semibold"),
                cls="d-flex justify-content-end gap-2 pt-3 border-top mt-2"
            ),
            id="form-edit-counts",
        ),
        modal_id="editCountsModal",
        title="Manual Count Corrections",
    )


def setup_counter_routes(app: Any) -> None:
    @app.get("/counter")
    def counter_page():
        # Big Total Count Card
        total_card = Card(
            Div(
                Span("0", id="counter-grand-total", cls="dclm-total-number d-block", role="status", aria_live="polite", aria_atomic="true"),
                Span("Total Population Count", cls="dclm-total-label"),
                Div(
                    Button(
                        I(cls="bi bi-pencil-square me-1"), "Edit Numbers",
                        type="button",
                        data_bs_toggle="modal",
                        data_bs_target="#editCountsModal",
                        cls="btn btn-sm btn-outline-light rounded-pill px-3 mt-3 me-2"
                    ),
                    Button(
                        I(cls="bi bi-arrow-counterclockwise me-1"), "Reset",
                        type="button",
                        id="btn-reset-counter",
                        cls="btn btn-sm btn-outline-danger rounded-pill px-3 mt-3 text-white"
                    ),
                    cls="d-flex justify-content-center"
                ),
                cls="dclm-total-display dclm-total-display--compact"
            ),
            cls=f"dclm-card dclm-card--navy mb-3 {Fx.base} {Fx.fade_in}"
        )

        # 6 Demographic Touch Tiles
        counter_tiles = Div(
            *[
                Button(
                    Span("0", id=f"count-display-{cat['key']}", cls="dclm-count-num"),
                    Span(cat["label"], cls="dclm-count-label"),
                    type="button",
                    cls=f"dclm-count-tile tone-{cat['tone']} {Fx.base}",
                    data_category=cat["key"],
                    data_tone=cat["tone"],
                    aria_label=f"Add one to {cat['label']} count",
                )
                for cat in COUNT_CATEGORIES
            ],
            cls="dclm-counter-grid"
        )

        # Tithe & Offering Capture Strip
        offering_card = Card(
            Div(
                H3("Tithe & Offering Collection", cls="h6 fw-bold text-dark mb-2"),
                Div(
                    Select(
                        Option("Select collection type", value="", selected=True),
                        *[Option(label, value=key) for key, label in FUND_TYPES],
                        id="offering-fund-type",
                        cls="form-select rounded-3",
                        aria_label="Collection type",
                        required=True,
                    ),
                    Select(
                        *[Option(label, value=key) for key, label in PAYMENT_METHODS],
                        id="offering-payment-method",
                        cls="form-select rounded-3",
                        aria_label="Payment type",
                    ),
                    Div(
                        Span("NGN", cls="input-group-text bg-light fw-bold text-success border-end-0"),
                        Input(id="offering-amount-input", type="number", step="0.01", min="0", max="9999999999.99",
                              placeholder="Amount", cls="form-control border-start-0 font-monospace fw-bold"),
                        cls="input-group"
                    ),
                    Div(
                        Button(
                            "Save ", I(cls="bi bi-wallet2"),
                            type="button",
                            id="btn-submit-offering",
                            cls="btn btn-success rounded-pill px-4 py-2 fw-semibold d-flex align-items-center gap-2 ms-auto"
                        ),
                        cls="d-flex justify-content-end"
                    ),
                    cls="d-grid gap-2"
                ),
            ),
            cls="dclm-card mb-3"
        )

        # Queue Final Batch Submit
        bottom_actions = Div(
            Button(
                I(cls="bi bi-cloud-check-fill me-2"), "Save Count",
                type="button",
                id="btn-finalize-count-batch",
                cls="btn btn-primary rounded-pill px-4 py-2 fw-bold ms-auto d-block"
            ),
            cls="d-flex justify-content-end mb-4"
        )

        return app_shell(
            active_screen="counter",
            page_title="Population Counter",
            subtitle="Rapid one-thumb demographic counting with haptic sensory feedback.",
            content=Div(
                setup_required_shield("the Population Counter"),
                Div(
                    total_card,
                    counter_tiles,
                    offering_card,
                    bottom_actions,
                    id="counter-content-wrap"
                ),
                edit_count_modal(),
            ),
        )
