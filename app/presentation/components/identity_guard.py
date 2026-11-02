"""Identity Guard Components: Enforces active ecclesiastical setup."""
from __future__ import annotations

from typing import Any
from fasthtml.common import A, Button, Div, I, P, Small, Span
from faststrap import Card, Fx


def identity_bar(active_setup: dict[str, Any] | None = None) -> Any:
    """Persistent top status chip showing the ecclesiastical identity."""
    # Always render in missing state; JS will update to active state from IndexedDB on load
    return Div(
        Div(
            Div(
                I(cls="bi bi-shield-check fs-5 me-2", id="identity-bar-icon"),
                Div(
                    Span("Program Setup Required", id="identity-bar-title", cls="dclm-identity-val d-block"),
                    Small("Tap to set Church Wing, Program, Level, Location & Date",
                          id="identity-bar-sub", cls="dclm-identity-label"),
                ),
                cls="d-flex align-items-center"
            ),
            Button(
                "Set Up",
                type="button",
                id="identity-bar-btn",
                data_bs_toggle="modal",
                data_bs_target="#setupModal",
                cls="btn btn-sm btn-outline-primary rounded-pill px-3 ms-auto"
            ),
            cls="d-flex align-items-center justify-content-between w-100"
        ),
        id="persistent-identity-bar",
        cls="dclm-identity-bar is-missing",
    )


def setup_required_shield(feature_name: str = "this workflow") -> Any:
    """Card shown when active setup is missing to guard against unassociated data capture."""
    return Card(
        Div(
            I(cls="bi bi-shield-lock text-warning display-4 mb-2 d-block"),
            Span("Ecclesiastical Setup Required", cls="h5 fw-bold text-dark d-block mb-1"),
            P(
                f"Before entering {feature_name}, please select your Church Wing, Program, Level, Location ID, and Service Date. "
                "All church entries must be bound to a verified ecclesiastical location scope.",
                cls="text-muted small mb-3 px-2"
            ),
            Button(
                "Configure Program Setup",
                type="button",
                data_bs_toggle="modal",
                data_bs_target="#setupModal",
                cls=f"btn btn-primary rounded-pill px-4 py-2 fw-semibold {Fx.base} {Fx.hover_lift}",
            ),
            cls="dclm-shield-card my-3"
        ),
        id="setup-required-shield",
        cls="border-0 shadow-none bg-transparent d-none",
    )
