# Linked solo-owner schedules

Existing routes stay intact. No DB migration or live backfill.

- Registration (`ClinicRegistrationInput`, `ClinicAdminOnboardingInput`): optional `ownerSchedule: { maxTokens: integer >=1, consultationMinutes: integer >=1, tokenPrefix: string, queueMode: "mixed" | "appointmentsOnly" | "walkInsOnly" }`. Requires `ownDoctor:true`; links each created location to the owner's doctor. Omit to use custom schedules.
- PATCH `/clinics/:id/settings`: branch entries accept `linkedSchedule: { enabled:boolean, doctorId?:string, maxTokens?:number, consultationMinutes?:number, tokenPrefix?:string, queueMode?:string }`. Enabling requires explicit capacity/duration and owner's attached doctor (doctorId may be omitted to derive owner doctor). Disabling retains existing schedules but unlinks them; custom editing becomes possible.
- GET settings returns branch `linkedSchedule` with persisted doctorId/settings. Existing branch hours edits automatically reconcile linked sessions atomically. Sessions with bookings or date exceptions cannot be removed/changed; return 409 with specific session details, leaving all changes rolled back.
- POST `/clinics/:id/settings/preview` (`previewClinicSettings`): same input as PATCH; returns `{ allowed:boolean, impacts:[{branchId,create:number,update:number,retire:number,unlink:boolean}], conflicts:string[] }`. Preview is advisory; save rechecks under transaction locks.
- Linked sessions reject direct generic schedule mutation/deactivation: unlink through clinic settings first. Custom doctors/schedules remain supported; overlapping custom schedules block linking rather than being adopted silently.
- Clinic settings and preview require Super Admin or the actual owning Clinic Admin. Same-account owner doctor retains Clinic Admin identity.
- Preserve QR URLs, appointment snapshots and schedule IDs for unchanged intervals; retire only unused obsolete linked sessions. Never infer capacity from opening hours.