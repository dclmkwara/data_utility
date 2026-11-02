"""Pydantic schemas for Offering models, matching Church_server backend."""
from __future__ import annotations

from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4
from pydantic import BaseModel, Field


class OfferingItem(BaseModel):
    """Offering entry matching backend OfferingCreate."""
    client_id: UUID = Field(default_factory=uuid4)
    event_id: Optional[UUID] = None
    location_id: str
    amount: Decimal = Field(..., gt=0)
    payment_method: str = Field(default="cash")  # cash, bank_transfer, mobile_money
    fund_type: str = Field(default="offering")   # offering, tithe, thanksgiving, building_project
    note: Optional[str] = None
