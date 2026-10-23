# Native controls review — 2026-10-23

## Implemented

- `SquishThemeSwitch`: native interpretation of the React Bits Squish Switch interaction. Controlled theme state, tap and horizontal drag, spring settling, restrained horizontal stretch with reciprocal vertical compression, cancel-to-current-state, accessible switch state/actions, and reduced-motion support. No web component or WebView is embedded.
- Both record options and settings use the same switch and persisted theme state.
- `NoteDialogs`: app-owned central confirmation/information dialogs. Includes patient/measurement/document/handwriting deletion, reset, recording consent, and save/error notices. Platform permission prompts are unchanged. History selection and full-screen camera/drawing/photo views remain their respective editors rather than confirmation dialogs.
- Dialog display never invokes an action. Back/backdrop only cancel; repeated confirmation taps are guarded. Queued notices do not overwrite each other.

Sources inspected:

- https://reactbits.dev/micro/squish-switch
- https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/Micro/SquishSwitch/SquishSwitch.tsx
- https://reactbits.dev/micro/rubber-segment
- https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/Micro/RubberSegment/RubberSegment.tsx

## Rubber Segment — native adaptation applied

Patient, measurement and gender selection now use the same native shared-surface implementation. The leading edge travels first and the trailing edge catches up. Selection commits immediately on tap; there are no drag/flick selection handlers. Horizontal drags only scroll the tab row. Gender remains optional and can be deselected.

Implemented safeguards:

1. Removed the patient-screen root key; only patient-local editor/attachment areas remount on patient change. The patient rail stays mounted during selection transitions.
2. Stable ids and measured content-width slots, horizontal scrolling, and selected-tab visibility. Widths update after name, count or layout changes.
3. No draggable thumb; scroll gesture suppression guards the selection callback.
4. At least 44-point targets, tab/radio accessibility roles, recording/save navigation guards, reduced-motion fallback, and cleanup of interrupted animations.

## Additional record changes

- Removed sun/moon icons from theme switch. Later compact-size adjustment scales the visible switch to 53.2×26.6 (radius 13.3), 30% below the original reference, while retaining the 88×48 touch target and interaction settings.
- Switch configuration updated to the supplied reference: 76×38, radius 19, speed 50, stretch 36, mouse hover scale 1.035, 320ms track/thumb color fade. Off colors `#27272a` / `#4e4e51`; on colors `#f5f5f5` / `#27272a`. Checked remains controlled by the persisted theme rather than the screenshot's preview state.
- Global reset explicitly clears all patient records and their attachments after durable workspace replacement succeeds. Individual-patient deletion remains on the patient trash button. SALS records and theme settings are untouched.
- Birth date and calculated age share one horizontally aligned row with the same 16-point regular type and a fine separator.
- Chief complaint prompt: `주증상 및 증상 경과를 입력하세요`.
- Recording/photo actions and attachment list are in a separate bottom surface, outside history/memo. Removed static action captions; retained recording time and unsaved-media warnings.
- Expanded wheel selection is applied to birth date, occurrence and measurement date/time. Edits remain in a draft until explicit apply; cancel/backdrop/back do not change records. Month/year changes clamp to the valid last day, including leap years. Hour values use 24-hour time. Wheels have at least 56-point rows, accessible increment/decrement actions and apply disabled during scrolling.
- Rubber Segment matches the reference: medium visual size, fixed monochrome colours, radius 10, inset 3, equal slots, stretch 100, squash 3, speed 1. Glide 75 is retained as a reference value but has no effect because drag selection remains disabled. A clipped active-text copy keeps labels readable while the shared white surface stretches across inactive slots.
- Input borders reserve 1 point in both normal and focused/invalid states. Only border colour changes. Embedded inputs remain borderless inside that frame. Resizable memo height includes the reserved border, rather than growing by 2 points on focus.

## Verification

- Latest controls: small diagonal switch movement is accepted as a tap; deliberate vertical movement cancels and can yield to scrolling. Expanded hit slop preserves the compact visual size. Rubber Segment now supports drag previews and one commit on release, including previously unselected gender. Cancellation/vertical intent/disabled state does not select a record. Overflow rails retain normal scrolling outside the selected tab. Theme-aware text copies and reduced-motion behavior remain intact.

- Wheel opening optimization: a visible-only session initializes the requested mode/draft before its first frame (no date-first render when opening time); range arrays and per-column handlers keep stable identities, columns are memoized, and row interpolation graphs are memoized. The 201-year range uses the library's virtualized list. Tests cover first-render hour/minute-only opening, stable references through busy rerenders, fresh draft after cancel/reopen and correct apply.

- Review fixes: phone formatting distinguishes 010, Seoul/other regional prefixes and +82; unknown/overlength numbers retain digits rather than being truncated. Contact inputs have no pre-normalization native length cap.
- Direct birth/date/time inputs normalize pasted text before enforcing digit counts; spaced and Korean-labelled dates are covered by regression checks.
- ID capture now snapshots measured guide/preview geometry, maps the guide through centered aspect-fill into oriented image pixels, bounds the crop, and shares the same guide rectangle with the dimming mask. Invalid/unmeasured layouts fail explicitly instead of using a fixed crop. Screen-ratio math is tested without real identity photos; physical-camera framing still needs a non-sensitive calibration check.

- Wheel engine now uses `@quidone/react-native-wheel-picker` 1.7.2 for native-driven curved faces and snapping. The app retains its Korea-order year/month/day, 24-hour hour/minute, bounded hold acceleration (20% gentler), draft/cancel/apply lifecycle, accessible adjustments and large row targets. The custom item wrapper adds hold-to-repeat without replacing the library scroll engine.
- Affiliation is a device-level text setting shown below the brand; patient and guardian phone/name/relationship fields live in each patient form. Guardian metadata is committed only on apply. Patient-count helper text is removed.

- Occurrence label is `Onset`; valid date/time shows a secondary relative duration in Korea time, refreshed while open and on foreground return. Future values use `후`. Both Onset and measurement headings offer reset before current-time entry; reset clears only that date/time pair.
- Wheels coast and snap after a flick. Holding above/below the selected row repeats with acceleration, stops on release/close, and never wraps endpoints. Verified with synthetic records in the isolated emulator.

- TypeScript and lint pass.
- Date/measurement/patient persistence tests and dialog/switch interaction tests pass.
- Isolated Android emulator: dark/light toggle tap and drag, central options, reset confirmation, cancel, and shared setting state checked. Existing user phone records were not used for testing.
- Latest release APK: `releases/FieldNote-1.0.3-WheelMomentum.apk`.
- Latest isolated emulator checks: three-patient and three-measurement selection, drag without selection, gender, birth-date/age alignment, separate media surface, cancel and all-patient reset using synthetic test records only. No real patient records were reset.
- No physical-phone installation performed in this change.
