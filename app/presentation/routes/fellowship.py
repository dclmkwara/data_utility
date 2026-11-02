"""Offline capture for house fellowship activities."""
from __future__ import annotations

from typing import Any
from fasthtml.common import Button, Div, H3, Input, Label, Option, P, Select, Small
from faststrap import Card, Col, Row

from ...core.constants import FELLOWSHIP_GROUPS
from ..components.shell import app_shell


def setup_fellowship_routes(app: Any) -> None:
    @app.get("/fellowship")
    def fellowship_page():
        select = Select(Option("Choose your house fellowship", value=""), id="fellowship_id",
                        cls="form-select rounded-3", required=True)
        attendance = Card(
            H3("Fellowship Attendance", cls="h6 fw-bold mb-2"),
            P("Record the fellowship meeting separately from church service counts.", cls="text-muted small"),
            Label("Meeting date", for_="fellowship_attendance_date", cls="form-label small fw-semibold"),
            Input(id="fellowship_attendance_date", type="date", cls="form-control mb-3", required=True),
            Row(*[
                Col(Div(Label(label, for_=f"fellowship_{key}", cls="form-label small"),
                         Input(id=f"fellowship_{key}", type="number", min="0", step="1", value="0", inputmode="numeric",
                               cls="form-control", required=True)), cols=6, cls="mb-2")
                for key, label in (("men", "Men"), ("women", "Women"), ("youths", "Youths"), ("children", "Children"))
            ], cls="g-2"),
            Label("Topic (optional)", for_="fellowship_topic", cls="form-label small fw-semibold mt-2"),
            Input(id="fellowship_topic", maxlength="200", cls="form-control mb-3"),
            Button("Save attendance on this device", type="button", id="btn-save-fellowship-attendance", cls="btn btn-primary w-100 rounded-pill"),
            cls="dclm-card mb-3 p-3",
        )
        finance = Card(
            H3("Fellowship Offering", cls="h6 fw-bold mb-2"),
            Label("Meeting date", for_="fellowship_offering_date", cls="form-label small fw-semibold"),
            Input(id="fellowship_offering_date", type="date", cls="form-control mb-2", required=True),
            Label("Amount (NGN)", for_="fellowship_offering_amount", cls="form-label small fw-semibold"),
            Input(id="fellowship_offering_amount", type="number", min="0.01", max="9999999999.99", step="0.01", inputmode="decimal", cls="form-control mb-2", required=True),
            Label("Note (optional)", for_="fellowship_offering_note", cls="form-label small fw-semibold"),
            Input(id="fellowship_offering_note", maxlength="500", cls="form-control mb-3"),
            Button("Save offering on this device", type="button", id="btn-save-fellowship-offering", cls="btn btn-success w-100 rounded-pill"),
            cls="dclm-card mb-3 p-3",
        )
        member = Card(
            H3("Fellowship Member Intake", cls="h6 fw-bold mb-2"),
            P("Only collect details needed to connect this person with the fellowship.", cls="text-muted small"),
            Label("Full name", for_="fellowship_member_name", cls="form-label small fw-semibold"),
            Input(id="fellowship_member_name", maxlength="120", cls="form-control mb-2", required=True),
            Label("Fellowship group", for_="fellowship_group", cls="form-label small fw-semibold"),
            Select(Option("Select a group", value=""), *[Option(label, value=key) for key, label in FELLOWSHIP_GROUPS],
                   id="fellowship_group", cls="form-select mb-2", required=True),
            Label("Phone (optional)", for_="fellowship_member_phone", cls="form-label small fw-semibold"),
            Input(id="fellowship_member_phone", type="tel", maxlength="30", cls="form-control mb-3"),
            Label("Home address", for_="fellowship_member_address", cls="form-label small fw-semibold"),
            Input(id="fellowship_member_address", maxlength="300", autocomplete="street-address",
                  cls="form-control mb-3", required=True),
            Button("Save member on this device", type="button", id="btn-save-fellowship-member", cls="btn btn-outline-primary w-100 rounded-pill"),
            cls="dclm-card mb-3 p-3",
        )
        return app_shell(
            active_screen="fellowship", page_title="Home Fellowship",
            subtitle="Capture one report at a time for an authorized house fellowship.",
            content=Div(
                Card(Label("Fellowship", for_="fellowship_id", cls="form-label small fw-semibold"), select,
                     Small("Choose the authorized fellowship. Member group is selected separately in member intake.", cls="text-muted d-block mt-2"),
                     cls="dclm-card mb-3 p-3"),
                attendance, finance, member, id="fellowship-content-wrap",
            ),
        )
