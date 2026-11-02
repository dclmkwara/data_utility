"""Sign-in and local sign-out pages for the field utility."""
from __future__ import annotations

from typing import Any

from fasthtml.common import Body, Button, Div, Form, H1, Img, Input, Label, Main, P, Small, Title
from faststrap import Card

from ...core.config import APP_NAME


def setup_auth_routes(app: Any) -> None:
    @app.get("/login")
    def login_page():
        form = Form(
            Div(
                Label("Email address", for_="login-email", cls="form-label"),
                Input(type="email", id="login-email", name="username", required=True,
                      autocomplete="username", placeholder="name@example.com", cls="form-control"),
                cls="mb-3",
            ),
            Div(
                Label("Password", for_="login-password", cls="form-label"),
                Input(type="password", id="login-password", name="password", required=True,
                      autocomplete="current-password", placeholder="Your password", cls="form-control"),
                cls="mb-3",
            ),
            P("Sign in with your approved field account.", cls="text-muted small"),
            Div(id="login-error", role="alert", aria_live="polite", cls="alert alert-danger d-none"),
            Button("Sign in", type="submit", id="login-submit", cls="btn btn-primary w-100 py-2"),
            action="/api/auth/login", method="post", id="login-form",
        )
        card = Card(form, cls="p-4 shadow-sm border-0")
        return (
            Title(f"Sign in | {APP_NAME}"),
            Body(
                Main(
                    Div(
                        Img(src="/assets/icon-512.png", alt="Deeper Life Bible Church logo",
                            cls="dclm-login-logo mb-3"),
                        H1("Field Utility", cls="h3 fw-bold"),
                        P("Sign in to capture and synchronize church records.", cls="text-muted"),
                        card,
                        Small("Offline access is available on this device after a successful sign-in.",
                              cls="text-muted d-block mt-3 text-center"),
                        cls="w-100", style="max-width: 440px; margin: 10vh auto; padding: 1rem;",
                    ),
                    cls="container",
                ),
                data_auth_page="login",
            ),
        )
