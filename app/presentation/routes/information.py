"""Information Sheet route for church notices and study syllabus."""
from __future__ import annotations

from typing import Any
from fasthtml.common import Div, H3, I, Li, Ol, P, Small, Span
from faststrap import Card

from ..components.shell import app_shell


def setup_information_routes(app: Any) -> None:
    @app.get("/information")
    def information_page():
        # Topics Card
        topics_card = Card(
            Div(
                H3("Program Topics & Scriptures", cls="h6 fw-bold text-dark mb-3"),
                Div(
                    Div(Span("Monday Bible Study:", cls="text-muted small d-block"), Span("1 Peter 4 & 5 — Faithfulness in Suffering", cls="fw-bold text-dark"), cls="mb-2 pb-2 border-bottom"),
                    Div(Span("Sunday Worship Service:", cls="text-muted small d-block"), Span("The Believer's Heavenly Walk and Warfare", cls="fw-bold text-dark"), cls="mb-2 pb-2 border-bottom"),
                    Div(Span("Thursday Revival:", cls="text-muted small d-block"), Span("Total Overcoming Victory Through Divine Power", cls="fw-bold text-dark"), cls="mb-1"),
                ),
            ),
            cls="dclm-card mb-3"
        )

        # Home Caring Fellowship Syllabus
        hcf_card = Card(
            Div(
                H3("Home Caring Fellowship (HCF)", cls="h6 fw-bold text-dark mb-3"),
                Div(
                    Div(Span("Adult BTB Lesson:", cls="text-muted small d-block"), Span("Lesson 25, Volume 2 — Christian Stewardship", cls="fw-bold text-dark"), cls="mb-2 pb-2 border-bottom"),
                    Div(Span("Youth (YHSF) Lesson:", cls="text-muted small d-block"), Span("Lesson 25, Volume 2 — Purity in a Perverse World", cls="fw-bold text-dark"), cls="mb-2 pb-2 border-bottom"),
                    Div(Span("Children BTB Lesson:", cls="text-muted small d-block"), Span("Lesson 25, Volume 2 — Obedience Brings Blessings", cls="fw-bold text-dark"), cls="mb-1"),
                ),
            ),
            cls="dclm-card mb-3"
        )

        # Field Notices
        notices_card = Card(
            Div(
                H3("Field Operation Notices", cls="h6 fw-bold text-dark mb-3"),
                Ol(
                    Li("Verify your church section and location code before headcount commences.", cls="mb-2"),
                    Li("Ushers should confirm population tallies with the headcount coordinator before leaving the aisle.", cls="mb-2"),
                    Li("Keep the device charged and stay in offline-first mode if network connectivity fluctuates.", cls="mb-2"),
                    Li("Workers attendance must be reviewed and signed off by the head usher.", cls="mb-1"),
                    cls="small text-muted ps-3 mb-0"
                )
            ),
            cls="dclm-card mb-4"
        )

        return app_shell(
            active_screen="information",
            page_title="Information Sheet",
            subtitle="Study topics, scripture texts, and field operating instructions.",
            content=Div(
                topics_card,
                hcf_card,
                notices_card,
            ),
        )
