"""Sync schemas matching Church_server /api/v1/sync exactly."""
from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field

from .attendance import WorkerAttendanceItem
from .counts import CountItem
from .offerings import OfferingItem
from .records import RecordItem


class FellowshipMemberItem(BaseModel):
    client_id: str
    fellowship_id: str
    name: str
    phone: str | None = None
    gender: str | None = None
    address: str | None = None
    role: str = "member"


class FellowshipAttendanceItem(BaseModel):
    client_id: str
    fellowship_id: str
    date: str
    men: int = Field(default=0, ge=0)
    women: int = Field(default=0, ge=0)
    youths: int = Field(default=0, ge=0)
    children: int = Field(default=0, ge=0)
    topic: str | None = None
    note: str | None = None


class FellowshipOfferingItem(BaseModel):
    client_id: str
    fellowship_id: str
    date: str
    amount: str
    note: str | None = None


class SyncBatchPayload(BaseModel):
    """Batch upload payload sent to Church_server /api/v1/sync."""
    counts: list[CountItem] = Field(default_factory=list)
    offerings: list[OfferingItem] = Field(default_factory=list)
    records: list[RecordItem] = Field(default_factory=list)
    worker_attendance: list[WorkerAttendanceItem] = Field(default_factory=list)
    fellowship_members: list[FellowshipMemberItem] = Field(default_factory=list)
    fellowship_attendance: list[FellowshipAttendanceItem] = Field(default_factory=list)
    fellowship_offerings: list[FellowshipOfferingItem] = Field(default_factory=list)


class SyncTypeResult(BaseModel):
    synced: int = 0
    duplicates: int = 0
    errors: int = 0
    details: list[dict[str, Any]] = Field(default_factory=list)


class SyncBatchResponseSummary(BaseModel):
    counts: SyncTypeResult = Field(default_factory=SyncTypeResult)
    offerings: SyncTypeResult = Field(default_factory=SyncTypeResult)
    records: SyncTypeResult = Field(default_factory=SyncTypeResult)
    worker_attendance: SyncTypeResult = Field(default_factory=SyncTypeResult)
    fellowship_members: SyncTypeResult = Field(default_factory=SyncTypeResult)
    fellowship_attendance: SyncTypeResult = Field(default_factory=SyncTypeResult)
    fellowship_offerings: SyncTypeResult = Field(default_factory=SyncTypeResult)
