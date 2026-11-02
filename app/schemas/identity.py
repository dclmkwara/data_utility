"""Data Identity & Setup validation schemas."""
from __future__ import annotations

from datetime import date as date_type
import re
from typing import Optional
from pydantic import BaseModel, Field, field_validator

# Level segment expectations:
# Global: DCM (1 segment)
# National: DCM-234 (2 segments)
# State: DCM-234-KW (3 segments)
# Region: DCM-234-KW-ILR (4 segments)
# Group: DCM-234-KW-ILR-ILE (5 segments)
# Local: DCM-234-KW-ILR-ILE-003 or DCM-234-KW-ILR-ILE-001 (6 segments)
EXPECTED_SEGMENTS: dict[str, int] = {
    "Global": 1,
    "National": 2,
    "State": 3,
    "Region": 4,
    "Group": 5,
    "Local": 6,
}

ALPHA_RE = re.compile(r"^[A-Z]{2,5}$")
NUMERIC_RE = re.compile(r"^\d{3}$")
ALNUM_RE = re.compile(r"^[A-Z0-9]{2,5}$")


def location_placeholder_for_level(level: str | None) -> str:
    """Returns sample valid location code for a given ecclesiastical level."""
    return {
        "Local": "DCL-234-KW-ILR-ILE-003",
        "Group": "DCL-234-KW-ILR-ILE",
        "Region": "DCL-234-KW-ILR",
        "State": "DCL-234-KW",
        "National": "DCL-234",
        "Global": "DCL",
    }.get(level or "", "DCL-234-KW-ILR-ILE-003")


def validate_location_code(level: str, location_id: str) -> tuple[bool, str]:
    """Validates location ID against ecclesiastical hierarchy rules."""
    normalized = (location_id or "").strip().upper()
    if not level:
        return False, "Please choose the ecclesiastical program level first."
    if not normalized:
        return False, "Location ID is required."

    expected = EXPECTED_SEGMENTS.get(level)
    if expected is None:
        return False, f"Unsupported program level: {level}"

    parts = normalized.split("-")
    if len(parts) != expected:
        return (
            False,
            f"{level} level expects exactly {expected} segments (e.g. '{location_placeholder_for_level(level)}'), received {len(parts)}.",
        )

    # 1st segment: 2-5 letter church prefix (e.g., DCL, DCM)
    if not ALPHA_RE.match(parts[0]):
        return False, "Location ID must begin with 2-5 uppercase church letters (e.g. DCL)."

    # 2nd segment if present: 3-digit country dialing code (e.g., 234)
    if expected >= 2 and not NUMERIC_RE.match(parts[1]):
        return False, "The second segment must be a 3-digit numeric country code (e.g. 234)."

    # Subsequent segments:
    if expected >= 3:
        for idx, part in enumerate(parts[2:], start=3):
            # Local level's last segment must be a 3-digit unit code (e.g. 001, 003)
            if level == "Local" and idx == expected:
                if not NUMERIC_RE.match(part):
                    return False, "Local church location code must terminate with a 3-digit number (e.g. 003)."
            elif not ALNUM_RE.match(part):
                return False, f"Segment '{part}' must contain 2-5 uppercase alphanumeric characters."

    return True, f"Valid {level} ecclesiastical identifier."


class SetupIdentity(BaseModel):
    """The 6-field ecclesiastical identity that binds every data capture."""
    church_type: str = Field(..., description="DCLM, YPF, DLCF, DLSO, ALL")
    program_domain: str = Field(..., description="Weekly, Crusade, Retreat, Conference, Special")
    program_type: str = Field(..., description="Canonical service name, e.g. Sunday Worship Service")
    program_level: str = Field(..., description="Local, Group, Region, State, National, Global")
    location_id: str = Field(..., description="Level-aware ecclesiastical code, e.g. DCL-234-KW-ILR-ILE-003")
    service_date: str = Field(..., description="ISO Service date YYYY-MM-DD")
    event_id: Optional[str] = Field(None, description="Backend Program Event UUID if resolved")

    @field_validator("location_id")
    @classmethod
    def check_location(cls, value: str, info) -> str:
        level = info.data.get("program_level", "")
        if level:
            valid, msg = validate_location_code(level, value)
            if not valid:
                raise ValueError(msg)
        return value.strip().upper()

    def cache_key(self) -> str:
        """Unique compound cache key for local storage partitions."""
        return f"{self.church_type}|{self.program_domain}|{self.program_type}|{self.program_level}|{self.location_id}|{self.service_date}"

    def compact_badge(self) -> str:
        """Compact string for screen headers."""
        return f"{self.church_type} • {self.program_type} • {self.location_id} • {self.service_date}"
