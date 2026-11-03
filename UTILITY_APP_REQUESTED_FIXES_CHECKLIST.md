# Utility App Requested Fixes Checklist

Implementation checklist for the field workflow and usability changes requested on 2026-11-03.

## Home, branding, and feedback

- [x] Replace mojibake and inconsistent text encoding in visible Utility App copy.
- [x] Add the church logo to the navy home identity card and give its background a restrained CSS animation with reduced-motion support.
- [x] Size mobile toasts to about 85% of the viewport while keeping them readable on wider screens.

## Population count and finance

- [x] Remove icons from demographic counter buttons and restore haptic feedback on taps.
- [x] Slightly reduce the vertical padding of the total population card.
- [x] Rename the count action to “Save Count”; send immediately when online and queue only when offline or submission cannot be confirmed.
- [x] Allow pending population count records to be edited before submission.
- [x] Remove the tithe and offering description and limit collection types to Tithe, Offering, and Tithe & Offering.
- [x] Stack collection type, payment method, and amount in separate rows; use a compact, right-aligned “Save” button with its icon after the label.
- [x] Warn and request confirmation before submitting offerings because later edits require elevated approval.

## Attendance

- [x] Change the attendance action to compact “Review”.
- [x] Redesign the attendance review summary and show program name, location, and date instead of a UUID scope.
- [x] Allow attendance only for worker/leader meetings and worker/leader conferences/retreats; block invalid setup from roster and submission.
- [x] Rename the final action to “Submit” and keep it compact.
- [x] Warn and request confirmation before submitting attendance because later edits require elevated approval.

## Registration

- [x] Rename “Optional follow-up details” to “Other details”, make the details section visible by default, and retain the useful follow-up fields.
- [x] Restrict Spiritual Decision / Salvation Type to New Convert and Restoration.
- [x] Rename the submit action to compact “Save”.

## Fellowship

- [x] Store the five fellowship categories on the fellowship itself and expose them through the backend API.
- [x] Add a category-required fellowship creation form to the admin location profile.
- [x] Derive a member’s category from the selected fellowship and remove the category picker from member intake.
- [x] Keep member home address capture.

## Submission mode and sync recovery

- [x] Submit records directly by default; preserve failed/offline records locally for later submission.
- [x] Add a per-account setting to queue first and submit only when the usher prompts sync.
- [x] Fix the persistent session/authorization error so valid sign-in and batch-sync permissions work, and forbidden submissions are reported accurately.

## Validation record

- Migration applied to the configured database and confirmed at revision `9d4c2f1a6b80` (head).
- Source-level compile and JavaScript syntax checks are being run before commit.
- Browser, real-device vibration, and end-to-end submission flows were not exercised in this pass.
