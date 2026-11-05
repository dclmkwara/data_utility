"""Setup Identity Modal Component for quick pre-service configuration."""
from __future__ import annotations

from typing import Any
from fasthtml.common import Div, Form, I, Label, Small
from faststrap import Button, Input, Modal, Select

from ...core.constants import CHURCH_TYPES, PROGRAM_DOMAINS, PROGRAM_TYPES_BY_DOMAIN


def setup_modal() -> Any:
    """Pop-up modal dialog for updating the active 6-field ecclesiastical identity."""
    form_content = Form(
        Div(
            Label("1. Church Wing / Section", for_="modal_church_type", cls="form-label small fw-bold text-muted mb-1"),
            Select(
                "modal_church_type",
                ("", "Select Section..."),
                *[(key, label) for key, label in CHURCH_TYPES],
                id="modal_church_type",
                cls="mb-3",
                required=True,
            ),
            cls="mb-1"
        ),
        Div(
            Label("2. Program Domain", for_="modal_program_domain", cls="form-label small fw-bold text-muted mb-1"),
            Select(
                "modal_program_domain",
                ("", "Select Domain..."),
                *[(key, label) for key, label in PROGRAM_DOMAINS],
                id="modal_program_domain",
                cls="mb-3",
                required=True,
            ),
            cls="mb-1"
        ),
        Div(
            Label("3. Program / Service Type", for_="modal_program_type", cls="form-label small fw-bold text-muted mb-1"),
            Select(
                "modal_program_type",
                ("", "Select Program..."),
                *[(item, item) for types in PROGRAM_TYPES_BY_DOMAIN.values() for item in types],
                id="modal_program_type",
                cls="mb-3",
                required=True,
            ),
            cls="mb-1"
        ),
        Div(
            Label("4. Reporting level", for_="modal_program_level", cls="form-label small fw-bold text-muted mb-1"),
            Select(
                "modal_program_level",
                ("Local", "Location", True), ("Group", "Group"), ("Region", "Region"), ("State", "State"),
                id="modal_program_level",
                cls="mb-3",
                required=True,
            ),
        ),
        Div(
            Label("5. Reporting Location ID (editable)", for_="modal_reporting_scope_code", cls="form-label small fw-bold text-muted mb-1"),
            Input("modal_reporting_scope_code", input_type="text", id="modal_reporting_scope_code",
                  cls="mb-1", placeholder="DCL-234-KW-ILR-ILE-003", required=True, autocomplete="off"),
            Small("Defaults to your location. For a Group or Region service, select its scheduled event; the ID must match that event's authorized scope.",
                  cls="form-text d-block mb-3"),
        ),
        Div(
            Label("Collection location", for_="modal_location_label", cls="form-label small fw-bold text-muted mb-1"),
            Input("modal_location_label", input_type="text", id="modal_location_label", cls="mb-1 bg-light", readonly=True,
                  placeholder="Loaded from your signed-in account"),
            Input("modal_location_id", input_type="hidden", id="modal_location_id"),
            Small("The signed-in account remains the collection source. The scheduled event controls broader reporting scope.", cls="form-text d-block mb-3"),
            cls="mb-1"
        ),
        Div(
            Label("6. Service Date", for_="modal_service_date", cls="form-label small fw-bold text-muted mb-1"),
            Input(
                "modal_service_date",
                input_type="date",
                id="modal_service_date",
                cls="mb-4",
                required=True,
            ),
            cls="mb-1"
        ),
        Div(
            Label("7. Scheduled Event (optional)", for_="modal_event_id", cls="form-label small fw-bold text-muted mb-1"),
            Select("modal_event_id", ("", "Select date and program first"), id="modal_event_id",
                   disabled=True),
            Small("Select the matching scheduled event for combined Group/Region/State services. Crusade reports always require an event.",
                  cls="form-text d-block mb-3"),
        ),
        Div(
            Button(
                "Cancel",
                type="button",
                data_bs_dismiss="modal",
                variant="secondary", outline=True, pill=True, cls="px-4"
            ),
            Button(
                "Save & Apply Identity",
                type="button",
                id="btn-save-modal-setup",
                variant="primary", pill=True, cls="px-4 fw-semibold"
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
