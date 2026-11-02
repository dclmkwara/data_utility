"""Pydantic schemas for Worker Attendance models, matching Church_server backend."""
from __future__ import annotations

from typing import Literal, Optional
from uuid import UUID, uuid4
from pydantic import BaseModel, Field


class WorkerRosterItem(BaseModel):
    """Worker card info returned from backend location query."""
    worker_id: UUID
    user_id: Optional[str] = None
    name: str
    phone: str
    unit: Optional[str] = None
    location_id: UUID
    location_name: Optional[str] = None
    church_type: Optional[str] = None
    marked_present: bool = False
    marked_at: Optional[str] = None


class WorkerAttendanceItem(BaseModel):
    """Attendance check record sent in batch sync."""
    client_id: UUID = Field(default_factory=uuid4)
    event_id: UUID
    location_id: UUID
    worker_id: UUID
    status: Literal["present", "absent", "late", "excused"] = "present"
    reason: Optional[str] = None
    note: Optional[str] = None
