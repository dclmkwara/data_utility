# DCLM Data Utility Application — Build Implementation Plan

> **Maintenance note:** This is the original build outline, not a verified implementation status. Some paths and module names below no longer match the source tree. Use [UTILITY_APP_IMPLEMENTATION_PLAN.md](UTILITY_APP_IMPLEMENTATION_PLAN.md) as the current remediation plan and acceptance checklist before implementing further changes.

## Overview
A modern, mobile-first, offline-capable, stateless Progressive Web Application (PWA) built with **FastHTML + Faststrap 0.10.1**. Tailored for church floor operations by Level 1 (floor ushers, counting clerks, field registrars) and Level 2 (head ushers, location secretaries, section coordinators). Communicates directly with the `Church_server` FastAPI backend via `POST /api/v1/sync`.

---

## Architecture & Directory Layout

The application in `C:\Users\Meshell\Desktop\FastHTML\utility_app` follows clean modular separation:

```
utility_app/
├── run_server.py                    # FastHTML entrypoint with host/port configuration
├── .env                             # Environment configuration (API URLs, ports, mode)
├── IMPLEMENTATION_PLAN.md           # Master roadmap and schema reference
├── app/
│   ├── __init__.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py                # Environment settings (backend URL, defaults)
│   │   ├── theme.py                 # Faststrap theme tokens & DCLM color palette
│   │   └── constants.py             # Church types, domains, program levels, categories
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── identity.py              # 6-field SetupIdentity & validation logic
│   │   ├── counts.py                # CountCreate & CountBatch
│   │   ├── attendance.py            # WorkerAttendanceCreate & WorkerRoster
│   │   ├── offerings.py             # OfferingCreate & FundTypes
│   │   ├── records.py               # RecordCreate (Converts & Newcomers)
│   │   └── sync.py                  # SyncBatchRequest & SyncBatchResponse
│   ├── services/
│   │   ├── __init__.py
│   │   ├── backend_client.py        # HTTP client communicating with FastAPI backend
│   │   └── sync_service.py          # Server-side proxy / sync coordinator
│   └── presentation/
│       ├── __init__.py
│       ├── app_factory.py           # FastHTML application setup & route registry
│       ├── components/
│       │   ├── __init__.py
│       │   ├── shell.py             # Faststrap MobileAppShell, topbar, bottom nav
│       │   ├── identity_guard.py    # Persistent setup bar & missing-setup shield
│       │   └── ui.py                # Stat tiles, badges, toast targets, action sheets
│       └── routes/
│           ├── __init__.py
│           ├── home.py              # Mobile dashboard & quick tools
│           ├── setup.py             # 6-field setup modal & location validator
│           ├── counter.py           # 6-tile headcount & offering strip
│           ├── attendance.py        # Local worker search, check-in, & usher review
│           ├── registration.py      # Newcomer & Convert intake form
│           ├── queues.py            # Pending unsubmitted & recent synced queues
│           ├── information.py       # Program topics, scripture readings & notices
│           └── api_proxy.py         # Pass-through API endpoints for browser client
└── assets/
    ├── css/
    │   └── utility.css              # DCLM mobile design system tokens & animations
    ├── js/
    │   ├── db.js                    # IndexedDB repository (9 stores)
    │   ├── haptics.js               # navigator.vibrate haptic motor controller
    │   ├── sync.js                  # Sync queue orchestrator & backend client
    │   ├── attendance.js            # Offline worker filter & self-check logic
    │   ├── counter.js               # Headcount touch engine & offering recorder
    │   ├── app.js                   # Main bootstrap, network detector, & routing
    │   └── sw.js                    # PWA Service Worker for offline asset caching
    └── icons/
        └── manifest.json            # PWA Web App Manifest
```

---

## Phased Implementation Plan

### Phase 1: Core Foundation & Modern Design System
- [ ] Configure `app/core/config.py`, `theme.py`, and `constants.py` with modern DCLM Admin tokens:
  - Primary: `#1d4ed8` (Royal Blue), Dark Navy: `#0f2752`, Accent Green: `#10b981`, Accent Amber: `#f59e0b`.
- [ ] Create `assets/css/utility.css` incorporating responsive mobile layout, smooth elevation, thumb targets, and fluid cards.
- [ ] Implement `app/presentation/components/shell.py` using Faststrap `MobileAppShell`, `MobileToolbar`, `BottomNav`, and `SafeArea`.
- [ ] Build `run_server.py` and verify application boot.

### Phase 2: Data Identity & Setup Engine (The Workflow Guard)
- [ ] Implement `SetupIdentity` schema with 6 mandatory fields:
  1. Church Type (`DCLM`, `YPF`, `DLCF`, `DLSO`, `ALL`)
  2. Program Domain (`Weekly`, `Crusade`, `Retreat`, `Conference`, `Special`)
  3. Program Type (dynamically populated based on domain)
  4. Program Level (`Local`, `Group`, `Region`, `State`, `National`, `Global`)
  5. Location ID (strict level-aware hierarchical validation)
  6. Date (ISO format)
- [ ] Create setup UI modal/sheet in `app/presentation/routes/setup.py`.
- [ ] Build `identity_guard.py` component: blocks data capture and informs the usher if setup identity is missing.

### Phase 3: Population Counter & Offering Module
- [ ] Build high-contrast 6-category touch grid (`counter.py`):
  - Adult Male, Adult Female, Youth Male, Youth Female, Boys, Girls.
- [ ] Implement `assets/js/haptics.js`:
  - Rapid click tick (`12ms`) for count buttons.
  - Milestone buzz (`25ms, 40ms, 25ms`) for 50/100 thresholds.
- [ ] Implement Quick Edit modal for manual batch adjustments and Reset confirmation.
- [ ] Add Tithe & Offering strip with Fund Type (Offering, Tithe, Seed) and Payment Method (Cash, Transfer, Mobile Money).

### Phase 4: Workers & Leaders Attendance System
- [ ] Implement worker roster fetching service connecting to FastAPI backend `GET /api/v1/attendance/workers`.
- [ ] Build client-side offline worker cache in IndexedDB store `worker_roster`.
- [ ] Build instant search interface in `app/presentation/routes/attendance.py`:
  - Instant name/phone prefix filtering (<5ms).
  - Touch checkbox for workers to mark "Present".
- [ ] Implement **Usher Review & Sign-off Gate** (`/attendance/review`):
  - Summary of present vs total workers.
  - Usher approval button required before batch moves to the sync queue.

### Phase 5: Newcomer & Convert Registration Form
- [ ] Build fluid registration screen (`app/presentation/routes/registration.py`):
  - Segmented toggle: `Convert` vs `New Comer`.
  - Full Name, Gender, Phone, Address, Marital Status, Social Status, Profession/Institution, Work/School Address, Class/Level, Invited By, Salvation Type.
- [ ] Store payloads locally into IndexedDB `registration_queue`.

### Phase 6: PWA, IndexedDB Storage, & FastAPI Backend Sync
- [ ] Build IndexedDB storage layer (`assets/js/db.js`) managing:
  - `active_setup`, `worker_roster`, `counter_queue`, `offering_queue`, `attendance_queue`, `registration_queue`, `recent_submissions`.
- [ ] Implement backend batch synchronization in `assets/js/sync.js`:
  - Packages unsubmitted queues into FastAPI's `SyncBatchRequest` schema with stable UUID `client_id`s.
  - Calls `POST /api/v1/sync` directly or via proxy.
- [ ] Implement Pending & Recent Queue management screens (`app/presentation/routes/queues.py`).
- [ ] Configure `sw.js` and `manifest.json` for 100% offline app loading.

### Phase 7: Verification & Testing
- [ ] Automated pytest suite covering routes, schemas, and validators.
- [ ] Live mobile browser testing: offline capture, haptics, roster search, and cloud sync.
