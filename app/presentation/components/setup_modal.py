"""Setup Identity Modal Component for quick pre-service configuration."""
from __future__ import annotations

from typing import Any
from fasthtml.common import Button, Div, Form, H5, I, Input, Label, Option, Select, Small, Span
from faststrap import Modal

from ...core.constants import CHURCH_TYPES, PROGRAM_DOMAINS, PROGRAM_TYPES_BY_DOMAIN


def setup_modal() -> Any:
    """Pop-up modal dialog for updating the active 6-field ecclesiastical identity."""
    form_content = Form(
        Div(
            Label("1. Church Wing / Section", for_="modal_church_type", cls="form-label small fw-bold text-muted mb-1"),
            Select(
                Option("Select Section...", value=""),
                *[Option(label, value=key) for key, label in CHURCH_TYPES],
                id="modal_church_type",
                cls="form-select rounded-3 mb-3",
                required=True,
            ),
            cls="mb-1"
        ),
        Div(
            Label("2. Program Domain", for_="modal_program_domain", cls="form-label small fw-bold text-muted mb-1"),
            Select(
                Option("Select Domain...", value=""),
                *[Option(label, value=key) for key, label in PROGRAM_DOMAINS],
                id="modal_program_domain",
                cls="form-select rounded-3 mb-3",
                required=True,
            ),
            cls="mb-1"
        ),
        Div(
            Label("3. Program / Service Type", for_="modal_program_type", cls="form-label small fw-bold text-muted mb-1"),
            Select(
                Option("Select Program...", value=""),
                *[
                    Option(item, value=item, data_domain=domain)
                    for domain, types in PROGRAM_TYPES_BY_DOMAIN.items()
                    for item in types
                ],
                id="modal_program_type",
                cls="form-select rounded-3 mb-3",
                required=True,
            ),
            cls="mb-1"
        ),
        Input(id="modal_program_level", type="hidden", value="Local"),
        Div(
            Label("4. Assigned Church Location", for_="modal_location_label", cls="form-label small fw-bold text-muted mb-1"),
            Input(id="modal_location_label", type="text", cls="form-control rounded-3 mb-1 bg-light", readonly=True,
                  placeholder="Loaded from your signed-in account"),
            Input(id="modal_location_id", type="hidden"),
            Small("Your signed-in account determines the authorized location.", cls="form-text d-block mb-3"),
            cls="mb-1"
        ),
        Div(
            Label("6. Service Date", for_="modal_service_date", cls="form-label small fw-bold text-muted mb-1"),
            Input(
                id="modal_service_date",
                type="date",
                cls="form-control rounded-3 mb-4",
                required=True,
            ),
            cls="mb-1"
        ),
        Div(
            Label("7. Scheduled Event (optional)", for_="modal_event_id", cls="form-label small fw-bold text-muted mb-1"),
            Select(Option("Select date and program first", value=""), id="modal_event_id",
                   cls="form-select rounded-3 mb-1", disabled=True),
            Small("Routine reports use the service metadata above. Crusade reports must select their scheduled event.",
                  cls="form-text d-block mb-3"),
        ),
        Div(
            Button(
                "Cancel",
                type="button",
                data_bs_dismiss="modal",
                cls="btn btn-outline-secondary rounded-pill px-4"
            ),
            Button(
                "Save & Apply Identity",
                type="button",
                id="btn-save-modal-setup",
                cls="btn btn-primary rounded-pill px-4 fw-semibold"
            ),
            cls="d-flex justify-content-end gap-2 pt-2 border-top"
        ),
        id="modal-setup-form",
    )

    return Modal(
        form_content,
        modal_id="setupModal",
        title="Ecclesiastical Program Setup",
        size="lg",
    )
