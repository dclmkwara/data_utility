"""Theme tokens and branding for DCLM Field Utility."""
from __future__ import annotations

from faststrap import create_theme

APP_TITLE = "DCLM Field Utility"
APP_SUBTITLE = "Offline-First Program Data Capture & Verification"

# DCLM Design Tokens
DCLM_PALETTE = {
    "primary": "#1d4ed8",          # DCLM Royal Blue
    "primary_dark": "#173b77",     # Deep Navy Accent
    "sidebar": "#0f2752",          # Church Midnight Navy
    "page_bg": "#f1f5f9",          # Crisp, clean neutral-slate background
    "surface": "#ffffff",          # Pure white cards
    "surface_subtle": "#f8fafc",   # Elevated micro-surfaces
    "border": "#e2e8f0",          # Soft clean divider
    "border_focus": "#3b82f6",    # Blue glow
    "text_main": "#0f172a",        # High contrast slate-900
    "text_muted": "#64748b",       # Readable slate-500
    "accent_success": "#10b981",   # Emerald confirmation
    "accent_warning": "#f59e0b",   # Amber pending/caution
    "accent_danger": "#ef4444",    # Crimson error/alert
    "accent_info": "#0284c7",      # Sky blue tags
}

FASTSTRAP_THEME = create_theme(
    primary=DCLM_PALETTE["primary"],
    secondary=DCLM_PALETTE["sidebar"],
    success=DCLM_PALETTE["accent_success"],
    warning=DCLM_PALETTE["accent_warning"],
    danger=DCLM_PALETTE["accent_danger"],
    info=DCLM_PALETTE["accent_info"],
    light=DCLM_PALETTE["surface_subtle"],
    dark=DCLM_PALETTE["sidebar"],
)
