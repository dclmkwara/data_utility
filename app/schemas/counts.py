"""Pydantic schemas for Count models, matching Church_server backend."""
from __future__ import annotations

from datetime import datetime
from typing import Optional, Literal
from uuid import UUID, uuid4
from pydantic import BaseModel, Field, model_validator


class CountItem(BaseModel):
    """Client-side headcount record."""
    client_id: UUID = Field(default_factory=uuid4)
    event_id: Optional[UUID] = None
    location_id: UUID
    date: Optional[datetime] = None
    church_type: Optional[str] = None
    program_level: Optional[str] = None
    program_domain: Optional[str] = None
    program_type: Optional[str] = None
    assignment_id: Optional[UUID] = None
    adult_male: int = Field(0, ge=0)
    adult_female: int = Field(0, ge=0)
    youth_male: int = Field(0, ge=0)
    youth_female: int = Field(0, ge=0)
    boys: int = Field(0, ge=0)
    girls: int = Field(0, ge=0)
    total: Optional[int] = Field(None, ge=0, le=999999)
    note: Optional[str] = None
    count_mode: Optional[Literal["single", "section"]] = None
    section_label: Optional[str] = Field(default=None, max_length=120)
    service_id: Optional[str] = Field(default="main", min_length=1, max_length=60)
    submission_channel: str = Field(default="field_utility")

    @model_validator(mode="after")
    def count_must_be_consistent(self):
        category_total = self.adult_male + self.adult_female + self.youth_male + self.youth_female + self.boys + self.girls
        if self.total is not None and category_total and self.total != category_total:
            raise ValueError("Total must match the demographic breakdown, or leave the breakdown empty to submit one total")
        if self.total is None:
            self.total = category_total
        return self
