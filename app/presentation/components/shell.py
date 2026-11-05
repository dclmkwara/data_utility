"""Master Mobile Shell layout for DCLM Field Utility."""
from __future__ import annotations

import json
from typing import Any
from fasthtml.common import A, Body, Button, Div, Footer, H1, Header, I, Main, Nav, P, Script, Small, Span, Title
from faststrap import BottomNav, BottomNavItem, Container, Modal

from ...core.config import APP_NAME
from ...core.constants import PROGRAM_TYPES_BY_DOMAIN
from .identity_guard import identity_bar
from .setup_modal import setup_modal


def top_bar(active_screen: str, page_title: str) -> Any:
    """Sticky top app header with DCLM brand and live network connectivity status."""
    return Header(
        Div(
            Div(
                Span("DCLM", cls="dclm-brand-mark"),
                Span("Field Utility", cls="dclm-brand-badge ms-2"),
                cls="d-flex align-items-center"
            ),
            Div(
                Span(
                    Span(cls="dclm-status-dot"),
                    Span("Online", id="network-status-text"),
                    id="network-status-pill",
                    cls="dclm-status-pill is-online"
                ),
                Span("", id="auth-user-name", title="Signed-in field account", cls="dclm-user-chip"),
                A(
                    I(cls="bi bi-gear-fill"),
                    href="/settings",
                    title="App settings",
                    aria_label="App settings",
                    cls="btn btn-sm btn-light rounded-circle ms-2 text-secondary d-flex align-items-center justify-content-center",
                    style="width: 36px; height: 36px;"
                ),
                A(
                    I(cls="bi bi-box-arrow-right"),
                    href="/login",
                    id="btn-sign-out",
                    cls="btn btn-sm btn-outline-secondary rounded-circle ms-2 d-flex align-items-center justify-content-center",
                    style="width: 36px; height: 36px;",
                    aria_label="Sign out",
                    title="Sign out of this field account",
                ),
                cls="d-flex align-items-center"
            ),
            cls="d-flex align-items-center justify-content-between"
        ),
        cls="dclm-topbar"
    )


def bottom_nav_bar(active_screen: str) -> Any:
    """Fixed bottom navigation bar with touch-friendly tabs."""
    return Div(
        BottomNav(
            BottomNavItem("Home", href="/", active=active_screen == "home", icon="house-door"),
            BottomNavItem("Counter", href="/counter", active=active_screen == "counter", icon="plus-slash-minus"),
            BottomNavItem("Attendance", href="/attendance", active=active_screen == "attendance", icon="person-check"),
            BottomNavItem("Register", href="/registration", active=active_screen == "registration", icon="person-plus"),
            BottomNavItem("Fellowship", href="/fellowship", active=active_screen == "fellowship", icon="house-heart"),
            variant="light",
            fixed=True,
            cls="dclm-bottom-nav"
        )
    )


def confirmation_modal() -> Any:
    return Modal(
        Div(Span("Confirm this action", id="dclm-confirm-message"), cls="text-body"),
        modal_id="dclmConfirmModal",
        title="Please confirm",
        footer=Div(
            Button("Cancel", type="button", data_bs_dismiss="modal", id="dclm-confirm-cancel", cls="btn btn-outline-secondary rounded-pill px-4"),
            Button("Continue", type="button", id="dclm-confirm-accept", cls="btn btn-primary rounded-pill px-4 fw-semibold"),
            cls="d-flex justify-content-end gap-2",
        ),
    )


def app_shell(
    *,
    active_screen: str,
    page_title: str,
    subtitle: str | None = None,
    content: Any,
    client_payload: dict[str, Any] | None = None,
) -> tuple[Any, ...]:
    """Wraps any page content inside the complete DCLM Mobile PWA Shell."""
    boot_data = {
        "active_screen": active_screen,
        "api_base": "/api",
        "program_types_by_domain": PROGRAM_TYPES_BY_DOMAIN,
        "payload": client_payload or {},
    }

    return (
        Title(f"{page_title} | {APP_NAME}"),
        Body(
            Div(
                top_bar(active_screen, page_title),
                Main(
                    Container(
                        identity_bar(),
                        Div(
                            H1(page_title, cls="h4 fw-bold text-dark mb-1"),
                            P(subtitle, cls="text-muted small mb-3") if subtitle else Span(),
                            cls="pt-2 px-1"
                        ) if page_title != "Home" else Span(),
                        Div(content, cls="dclm-page-content"),
                        cls="px-2"
                    ),
                    Footer(
                        P("Powered Kwara State ICT Unit", cls="small text-muted text-center mb-0 py-2"),
                        role="contentinfo",
                    ),
                    cls="flex-grow-1"
                ),
                setup_modal(),
                confirmation_modal(),
                bottom_nav_bar(active_screen),
                Div(id="dclm-toast-container", cls="dclm-toast"),
                Script(f"window.__DCLM_UTILITY_BOOT__ = {json.dumps(boot_data)};"),
                cls="dclm-mobile-frame"
            ),
            data_screen=active_screen,
            data_auth_state="checking",
        ),
    )
