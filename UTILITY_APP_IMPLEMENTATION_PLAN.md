# DCLM Field Utility Remediation and Improvement Plan

**Status:** Implementation underway. Utility identity and fellowship workflows have been expanded to match Church_server contracts; phases remain open until their full acceptance gates are verified.
**Scope:** Utility app (`utility_app`) and only the Church_server API/model changes needed to make its field workflows correct. The admin frontend is out of scope.
**Design baseline:** FastHTML + Faststrap 0.10.1, mobile-first field operations, intermittent connectivity, assigned level 1/2 users.

## 1. Target outcome

The utility must let an approved field representative select an authorized church location and scheduled program, capture records offline, and later sync each record safely under that representative's identity. State and higher-level reporting must receive data tied to the correct event and location, with visible contribution provenance and no loss of partial batches.

The app is a data-capture client. It should not let a device invent its own authority, create ambiguous event identities, or report data as accepted before Church_server confirms it.

## 2. Existing architecture and contract gaps

Current flow:

```text
FastHTML screens -> assets/js/app.js -> IndexedDB queues -> /api/sync proxy
                                                     -> BackendClient -> Church_server
```

The utility authenticates each field representative with Church_server and forwards that actor's authorization through a same-origin session proxy. Backend UUIDs and display codes are separate: the signed-in account supplies its location UUID, and Church_server provides the display label. Capture stores a selected `ProgramEvent.id`; local event record schemas now require event/location UUIDs. Fellowship activities use their own `fellowship_id` and date contract, distinct from program events. Sync acknowledges each item separately. Remaining gaps are live-account permission verification, complete reconnect/offline coverage, and report reconciliation.

The existing code already has a useful foundation: distinct client UUIDs for offline records, an IndexedDB outbox, an usher review step for attendance, six demographic count categories, and backend idempotency by `client_id`. Church_server statistics sum separate count contributions. **Preserve that additive counting behavior. Do not deduplicate counts by event/location.**

### Important modeling constraint for usher counts

Church_server `EventAssignment` represents an event assignment linked to a worker and assignment type. It is not a generic aisle/row section. Do not reuse it as a count-section identifier unless the domain owner confirms that the worker's assignment accurately represents the counted area. If section boundaries need recording, define a distinct count-section/counting-assignment concept or an explicitly approved metadata field. Keep separate usher contributions as separate rows with unique `client_id`s.

## 3. Phase 0 contract decisions and known modeling gaps

The implementation currently follows these decisions; fixture and live-account verification remain acceptance work:

1. **Field identity:** Utility users authenticate through approved Church_server accounts. The proxy forwards their own identity; it does not use a shared service identity. Church_server remains authoritative for approval, role permissions, location scope, and actor audit fields.
2. **Event provisioning:** Church_server provisions weekly services, crusades/subprograms, retreats, and combined-service events. Utility discovers existing events and does not create them. A missing event requires an administrator to provision it; the utility cannot submit an unverified event.
3. **Combined-service scope:** Church_server event and location authorization determines which representatives can submit against a shared event. The utility retains the selected event and location on each queued item. Event assignments are used only where the backend requires a worker assignment.
4. **Multi-usher counting:** Each usher submits a separate additive contribution with a stable `client_id`; Church_server records the authenticated actor. Contributions are summed and never deduplicated by event/location. The current backend has no distinct aisle/row section field, so the utility does not pretend `EventAssignment` is a section. Section-level reconciliation needs an explicit backend model if supervisors require it.
5. **Financial records:** Tithe and offerings use Church_server Offering records distinguished by `fund_type`; each teller entry is retained separately with its own client ID and authenticated actor.
6. **Registration privacy:** The utility requires name, gender, and phone; extra follow-up data is optional and bounded. Queue receipts do not retain registration PII after server acknowledgement. A formal retention/consent policy still needs owner confirmation before launch.

If these decisions require backend changes, make them as part of the relevant phase and record the API contract next to the implementation.

## 4. Phases and completion gates

### Implementation record (2026-11-02)

- Added Church_server login, refresh, current-user, and logout through an encrypted `HttpOnly`, same-origin cookie session. The browser receives only a minimal profile for offline continuity; bearer tokens stay encrypted on the server. Roster, event, assignment, and sync proxy routes fail closed without a valid local session.
- Removed the fake roster. Empty, forbidden, and failed backend responses remain distinct; roster cache is account/location scoped and stale use is labeled.
- Setup discovers existing Church_server events by location, date, and program type, then binds new records to the chosen event UUID. The proxy requires client, location, and event IDs and enforces the 500-item batch limit.
- Location identity now comes from the authenticated account UUID and a scoped Church_server location lookup; field workers see the location name/code read-only. Event records use the event's authorized alpha-location UUID when applicable.
- Added offline Home Fellowship capture for attendance categories, offering, and member intake. The authorized fellowship list is fetched from Church_server, scoped to the account location, and cached per account. Its sync payload uses `fellowship_id` and date (no `event_id` or fabricated location field).
- For alpha-location crusades, the utility uses only the signed-in worker's approved count/convert assignment IDs where required. These are not aisle/row identifiers. Separate ushers' count submissions remain additive and carry distinct client IDs and backend actor provenance. The Church_server model still has no explicit count-section field.
- Sync parses per-item results and removes only exact `synced` or `duplicate` acknowledgements. Missing or failed outcomes remain pending with attempt/error metadata; history keeps minimal receipts rather than registration PII. Requests are chunked to 500 and acknowledgements are persisted per chunk.
- IndexedDB is version 6. Setup, roster, fellowship context, and all seven outbox queues are partitioned by account; queue migrations preserve pending records; drafts are bound to event/location; attendance confirmations prevent repeat submission. Ownerless legacy items remain available for explicit claim.
- Added Faststrap sign-in and account identity, registration/finance validation, honest queue and roster feedback, screen-reader total updates, keyboard-operable count buttons, visible focus, reduced-motion handling, and responsive shell fixes. Removed viewport zoom restrictions.
- `.env` is explicitly loaded from the project root without overriding process environment. Added a safe `.env.example`, `.gitignore`, README, and pinned dependencies. FastHTML's unused remote HTMX/Surreal runtimes and Google Font request are disabled for offline operation.
- The service worker is registered at `/` (the prior `/assets/js/` scope could not control app pages), uses network-first navigations with offline cache fallback, exact versioned URLs, and caches Bootstrap, Faststrap, icons/font, and app scripts. Precache failures are isolated per asset. Fellowship is included in the offline shell.
- Local verification (2026-11-02): 19 utility tests pass; Python compilation and JavaScript syntax checks pass. Mocked contract tests cover location UUID, fellowship scoping, UUID/date preflight, event schema UUIDs and assignment IDs. Playwright captured all three fellowship record types under a synthetic account and verified the sync request omitted event/location IDs for fellowship rows; accepted receipts left the pending queue and appeared in history. Earlier Playwright checks confirmed sign-in, count interaction, responsive widths, offline shell, queue isolation, and partial-sync retry metadata. A mixed-result retry preserved the rejected fellowship record with attempt_count=1 and its error; offline navigation rendered the route and the authorized fellowship picker from account-partitioned cache.

**Current phase state:** Phase 0 decisions are documented; live permission and report owner review remain. Phases 1-7 have implementation work in place but remain open pending their acceptance gates. Phase 8 remains open. Live Church_server account/event verification, section-level attribution, full queue/reconnect behavior, complete offline workflow coverage, and state-report reconciliation remain outstanding.

### Phase 0 — Freeze field workflow and API contracts

**Priority:** P0; prerequisite for the data-path work.

**Work**

- Document the supported user roles and exact permissions for event discovery, roster read, count, offering, registration, and attendance sync.
- Define a minimal field-bootstrap response: authenticated actor, allowed location(s), program/event choices, event IDs, dates, event mode, and any approved assignments/sections needed for capture.
- Define canonical payloads and response examples for all four queues, including required `event_id`, `location_id`, stable `client_id`, and per-record outcome.
- Define finance resource mapping and count contribution provenance.
- Set explicit constraints: backend's current 500-record batch maximum; event and location validity; client ID idempotency; data retention.

**Complete when** request/response fixtures cover weekly service, combined event, offline retry, and item rejection; account permission cases are verified; and no UI/sync behavior trusts only a client-supplied location code or display label.

### Phase 1 — Authentication, actor identity, and authorized scope

**Priority:** P0; unlocks every real backend workflow.

**Work**

- Add a field-user sign-in/session flow using a Church_server-supported authentication mechanism. Prefer a secure same-origin session/BFF or a documented token exchange. Never place a privileged service credential in browser JavaScript or use one shared backend identity for all representatives.
- Attach the authenticated actor's short-lived authorization to roster, event/bootstrap, and sync requests. Define re-authentication behavior when an offline queue is ready but the session has expired.
- Enforce location and event scope on the server for every request. Treat the device's current setup as a requested context, not proof of authority.
- Show the signed-in person's name/role and authorized location; provide explicit sign-out and shared-device handoff behavior.
- Ensure audit fields preserve who captured/submitted a record and when. Do not let the client set trusted role/source fields.

**Complete when** an approved field account can read only its permitted roster/events and sync only allowed locations; an unapproved, expired, or out-of-scope account gets a clear denial and no records are accepted. Tests cover these permission cases.

### Phase 2 — Event and location bootstrap

**Priority:** P0; required before a record can be valid.

**Work**

- Replace free-form program setup as the authoritative selector with backend-provided events. Show useful labels (program, date, campaign/subprogram, reporting level, location) while storing the immutable event UUID.
- Retrieve only events and child locations available to the signed-in representative. Support combined services by associating multiple authorized location submissions with the same parent event where the backend contract permits it.
- Cache a bounded set of authorized events/assignments for offline use, with last-refresh time and an explicit stale/offline indicator. Require online refresh before enabling a context the device has never been authorized to use.
- Validate event status/date and location-to-event scope server-side during sync. Do not accept a local regex as evidence that a location exists.
- Keep any manually selected event context immutable on queued records so changing setup cannot retarget old records.

**Complete when** every queued record carries the correct `event_id`, location, and any required assignment; malformed, closed, unknown, or out-of-scope events fail with recoverable, specific errors. Verify weekly, crusade/subprogram, retreat, and combined-service fixtures.

### Phase 3 — Safe offline queue and lossless sync

**Priority:** P0; data integrity gate.

**Work**

- Give queued records explicit state and metadata: `pending`, `syncing`, `synced`, `duplicate_confirmed`, or `rejected/retryable`; attempt count; timestamps; last error; stable `client_id`; immutable event/location context.
- Parse the nested backend response by type and `client_id`. Remove or archive an item only after that exact item returns an accepted `synced` or verified idempotent `duplicate` outcome. Keep rejected and unmentioned items queued and actionable.
- Treat HTTP success separately from item success. Handle non-JSON, timeout, auth expiry, 4xx validation errors, and network errors without deleting data. Do not claim that a batch synced if some items failed.
- Chunk requests within the backend's 500-record limit. Persist outcome after each chunk so a restart does not resend acknowledged items unnecessarily.
- Preserve each count contribution with the same ID across retries. Never regenerate its ID after a timeout.
- Add a queue reconciliation view with per-item retry, edit only where safe, discard with confirmation, and export/recovery path if local storage is failing.
- Upgrade IndexedDB version with an explicit migration from current stores, preserving all existing queues and their IDs.

**Complete when** mixed success/error responses preserve only failed items; timeout/retry produces no duplicates; duplicate acknowledgement is safe; batches above 500 records process across chunks; browser restart preserves pending data; and every displayed success matches backend item outcomes.

### Phase 4 — Real roster and attendance workflow

**Priority:** P1 after Phases 1–3.

**Work**

- Remove hardcoded worker seed data. Distinguish: loading, real roster loaded, valid empty roster, cached roster in offline mode, unauthorized, and service unavailable.
- Cache roster per authorized location/event context and include `last_updated`; never present stale roster as current without a label. Clear or partition cache on sign-out/location change.
- Keep fast local search for the cached list; use server-side paging/search if the approved roster exceeds practical device memory or load time.
- Ensure attendance records include event ID, location, worker ID, stable client ID, and allowed status. Prevent double submission through client idempotency and show already-queued/present state.
- Preserve the head usher review/sign-off gate, but make the reviewer identity and review time auditable. Do not treat a review click as successful backend submission.

**Complete when** the roster contains only authorized real workers; an empty roster remains empty; unavailable service shows a recoverable error; cached roster is correctly labeled; and attendance is attached to the selected event and accepted only for valid workers.

### Phase 5 — Count, registration, and finance correctness

**Priority:** P1; can begin after event bootstrap is stable.

**Population counts**

- Keep the six current demographic categories and independent count records.
- Add the approved usher/section provenance model without changing additive aggregation. If a section is configured, capture it on each contribution; allow multiple sections for one location/event.
- Show a reviewable event total and per-usher/per-section contributions. Flag likely overlaps for supervisor review; do not collapse them automatically.
- Persist corrections as deliberate edits/audit events or replacement submissions according to the backend's correction policy. Avoid a reset that silently destroys an active tally.

**Newcomer and convert registration**

- Validate required fields and phone normalization; cap field lengths; distinguish 'saved on this device' from 'accepted by the church records service.'
- Review which address, work/school, marital, social, and salvation fields are genuinely needed at initial capture. Keep follow-up-sensitive fields optional where policy permits.
- Include event/location IDs and stable client ID, and map fields to backend record schemas with fixtures.

**Tithe and offerings**

- Implement the Phase 0 canonical finance mapping. Do not ship tithe amounts into a resource that the pastor reports do not read.
- Validate decimal precision/limits to backend rules, currency, fund type, and payment method. Distinguish recorded totals from reviewed/approved totals in copy and history.
- Define how separate ushers/tellers submit portions without losing provenance or double-counting. Preserve audit notes and correction/reversal workflow required by the backend.

**Complete when** captured values round-trip into the expected backend tables and state-level reports; validation errors stay visible in the queue; and a representative can distinguish captured, synced, and reviewed financial records.

### Phase 6 — Offline behavior and local data protection

**Priority:** P1; core product requirement.

**Work**

- Align service-worker cache entries with the actual versioned URLs, or match them with a deliberate query policy. Version cache names and remove old caches safely.
- Bundle/cache all required Faststrap/Bootstrap styles, scripts, icons, fonts, app CSS/JS, and offline route documents. Test the real rendered assets, including the `/static/` framework assets and external fonts/libraries seen in the browser request list.
- Use explicit network-first behavior for APIs and a clear offline page/state; keep sensitive API responses out of shared caches. Keep sync unavailable offline while preserving the outbox.
- Partition IndexedDB records by authenticated account/context, add database migration tests, and clear the signed-out user's private roster/session data according to policy.
- Define retention and deletion for queued PII and recent sync history. Recent history should store minimal receipt metadata rather than a second full copy of names, phones, and addresses. Make destructive clear-data actions report exactly what will be deleted and protect pending unsynced data.
- Replace dynamic `innerHTML` interpolation of names/phones/errors with text-safe DOM rendering. Avoid logging registration PII or auth tokens.

**Complete when** an installed app can cold-start in airplane mode after a successful online install; every capture workflow works offline against a previously authorized event; data survives reload/restart; stale/out-of-scope data is not misrepresented; and sign-out/retention behavior is verified on a shared-device scenario.

### Phase 7 — Faststrap workflow UI and visual refinement

**Priority:** P2, but establish shared components early so Phases 1–6 use them consistently.

**Design direction**

Keep the current DCLM navy/blue identity and field-first simplicity. Refine the interface around task clarity, large touch targets, readable numeric counts, clear event scope, and recoverable states. Avoid turning the utility into a dense admin dashboard or adding decorative motion that slows counting.

**Faststrap opportunities**

- **Shell and navigation:** evaluate `MobileAppShell`, `MobileToolbar`, `SafeArea`, and `StickyActionBar` for responsive navigation, safe-area padding, and a persistent capture/review action. Keep the current bottom-nav pattern if it remains the clearest on small devices.
- **Setup:** use `FormGroup`/`Input`/`Select` and an accessible step/segmented pattern for event selection, reporting location, and confirmation. Show selected event as a compact `Tag`/badge with date and location; avoid manually retyping long hierarchy codes.
- **Counter:** retain a domain-specific large six-tile grid; render tiles as real keyboard-accessible buttons with visible focus. Use Faststrap `Button`, `Card`, `Badge`/`Tag`, `ConfirmDialog`, and `LiveRegion` where their installed signatures fit. Consider `StickyActionBar` for save/review without obscuring tiles.
- **Attendance and queues:** use `CollectionView`/`ListView`/`ListItem` for touch-friendly roster and queue rows, plus `ActiveSearch` when appropriate. Show state labels with `Badge`/`Tag`; do not use a table for individual worker check-in. Use pagination/server search for large rosters.
- **Loading and feedback:** use `LoadingButton` for refresh/sync, `Spinner` or `Placeholder`/skeleton for loading, `EmptyState` for a truly empty roster/queue, and `Alert` for persistent failures. Use `Snackbar` for action-local confirmation and `Toast` only for brief global notices. Use a `LiveRegion` for important status changes.
- **Registration:** use a clear `SegmentedControl` for newcomer/convert, `FormGroup` validation and a review step. Consider a `Sheet` for optional follow-up fields on mobile only if it reduces scrolling without hiding required information.
- **Theme/accessibility:** centralize brand tokens and shared component defaults; use the official logo asset if available; align manifest/browser theme colors; remove the zoom restriction; check contrast, focus, screen-reader labels, 44px minimum touch targets, and reduced-motion behavior.

Before adopting mobile/beta or recently added components, verify their signatures and stability in the installed Faststrap 0.10.1 package. Prefer Faststrap primitives, Bootstrap utilities, then small app-specific CSS. Keep the six-tile counting interaction custom where that is clearer than a generic component.

**Complete when** mobile views at 360px, 390px, and tablet width have no horizontal overflow; all actions work by keyboard and touch; setup/scope remains visible; the top view prioritizes the next field task; loading/empty/error/offline/success states are distinct; and branding matches the Church_server design tokens without sacrificing field readability.

### Phase 8 — Contract, workflow, and release verification

**Priority:** P0 release gate; verification begins in each phase and closes here.

**Automated coverage to add**

- Backend contract fixtures for each payload and nested response, including per-item errors, duplicates, invalid event, invalid location, and auth denial.
- Utility tests for identity/bootstrap validation, IDB migration, stable IDs, outbox transitions, event/location immutability, count additive behavior, and offline cache matching.
- Security tests for role/scope enforcement, unauthenticated proxy endpoints, unsafe HTML payloads, local retention/sign-out, and no sensitive tokens or PII in logs.
- Browser workflow checks for login, event/location selection, multi-usher counts, attendance review, registration/finance capture, offline restart, partial sync, retry, and confirmed state.
- Browser visual/accessibility checks at mobile and tablet widths; screen reader/focus/zoom and reduced-motion spot checks.

**Release acceptance**

- No unassigned/fabricated roster records.
- Every accepted record belongs to the intended event and authorized location and includes stable identity/provenance.
- Two or more ushers' non-overlapping portions for one location/event remain separate in the database and sum correctly in reports; retrying one portion does not duplicate it.
- Partial sync failures remain queued and clearly visible; only accepted/duplicate-confirmed items leave pending state.
- Offline capture, reload, and reconnect do not lose or retarget data.
- Count, attendance, newcomer/convert, offering, and tithe totals reconcile against the state-level views that consume them.
- The implementation plan and tests reflect the actual modules and route structure; remove stale claims about nonexistent `attendance.js`, `counter.js`, `sync_service.py`, and `ui.py` or implement those modules deliberately.

## 5. Implementation slices and current state

1. **Slice A — contract:** roles, event provisioning, additive usher submissions, offering mapping, registration fields, location UUID versus display ID, and fellowship eventless payloads are documented. Sample full backend fixtures and owner approval for retention/consent remain.
2. **Slice B — identity and backend access:** authenticated proxy, encrypted session cookie, server-assigned location UUID resolution, fail-closed routes, and real roster states are implemented. Real approved-account permissions and expiry behavior remain to verify.
3. **Slice C — event context:** event discovery, required event IDs, assignment checks, and immutable queued context are implemented. Multi-event authorized offline caching and combined-service browser workflows remain open.
4. **Slice D — sync integrity:** per-item acknowledgement, bounded chunks, retry metadata, stable IDs, and account-scoped IndexedDB are implemented. Browser coverage for mixed outcomes, interruption between chunks, and retry remains.
5. **Slice E — domain capture:** additive counts, event-bound attendance, registration validation, decimal finance validation, and separate fellowship attendance/offering/member capture are implemented. The backend has no count-section identifier; explicit usher-section reporting and state-report reconciliation remain.
6. **Slice F — offline and privacy:** root-scoped service worker, versioned asset cache, offline shell, local drafts, and account partitioning are implemented. Offline checks for all workflows, reconnect sync, retention policy, and local-storage protection remain.
7. **Slice G — visual/accessibility refinement:** responsive header/identity bar, keyboard-accessible count tiles, focus states, zoom, and reduced-motion adjustments are implemented. Complete route-by-route accessibility review and real-device testing remain.
8. **Slice H — acceptance:** live backend and release acceptance gates remain open; no Church_server data was submitted during this implementation.

Each slice should update this document with changed files, tests/evidence, and any still-open acceptance criteria. Do not mark a phase complete based only on routes rendering or a successful HTTP status; require the phase's behavior and data integrity gate.

## 6. Current verification baseline

- `tests/test_utility_app.py`: 14 passing tests for rendering, root-scoped service-worker headers, absence of remote runtime dependencies, session privacy, mocked identity/assignment scope, sync validation, empty roster, and request-size enforcement.
- `python -m compileall -q app run_server.py tests` and `node --check` for all five app scripts pass. Pytest reports one upstream FastCore deprecation warning from `asyncio.iscoroutinefunction`.
- Playwright results: sign-in form rendered; Enter activated a demographic count button and updated the total; the counter had no horizontal overflow at 360px, 390px, or 768px; an installed root-scoped worker loaded the counter offline and persisted the count draft. Browser IndexedDB checks verified queue and roster isolation across two test profiles and preserved event attendance marks. Mock profile/data were cleared after the runs.
- Not yet verified: a real approved account, live events/roster, authorization denials by actual role, mixed-result sync and retry in a browser, offline registration/attendance/finance, or report reconciliation. No records were submitted to Church_server.
- Git is initialized on `main`, and `.env`, `.sesskey`, and browser artifacts are ignored. The configured GitHub remote currently returns `Repository not found`, so publishing cannot be verified until that repository is accessible.
