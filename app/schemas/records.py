"""Pydantic schemas for Newcomer and Convert records, matching Church_server backend."""
from __future__ import annotations

from typing import Any, Literal, Optional
from uuid import UUID, uuid4
from pydantic import BaseModel, Field


class RecordItem(BaseModel):
    """Registration record matching backend RecordCreate."""
    client_id: UUID = Field(default_factory=uuid4)
    event_id: Optional[UUID] = None
    location_id: str
    record_type: Literal["newcomer", "convert"]
    name: str
    gender: Literal["Male", "Female"]
    phone: str
    details: dict[str, Any] = Field(default_factory=dict)
    note: Optional[str] = None
    submission_channel: str = Field(default="field_utility")
