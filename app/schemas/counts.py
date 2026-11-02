"""Pydantic schemas for Count models, matching Church_server backend."""
from __future__ import annotations

from typing import Optional
from uuid import UUID, uuid4
from pydantic import BaseModel, Field


class CountItem(BaseModel):
    """Client-side headcount record."""
    client_id: UUID = Field(default_factory=uuid4)
    event_id: Optional[UUID] = None
    location_id: str
    adult_male: int = Field(0, ge=0)
    adult_female: int = Field(0, ge=0)
    youth_male: int = Field(0, ge=0)
    youth_female: int = Field(0, ge=0)
    boys: int = Field(0, ge=0)
    girls: int = Field(0, ge=0)
    note: Optional[str] = None
    submission_channel: str = Field(default="field_utility")

    @property
    def total(self) -> int:
        return (
            self.adult_male
            + self.adult_female
            + self.youth_male
            + self.youth_female
            + self.boys
            + self.girls
        )
