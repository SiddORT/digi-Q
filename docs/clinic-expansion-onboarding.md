# Clinic registration and public pages

## Implementation progress

- Dedicated teal, responsive guided registration UI: clinic identity, locations with independent phone/email inheritance, weekly open/closed hours with multiple intervals and copy-day action, optional own doctor profile, staff invitation guidance, review.
- Draft exists only in component memory. No password or registration PII is persisted to local/session storage. Closing/reloading the page discards unfinished details.
- Staff login security implementation is unchanged; only a branded registration entry was added.
- Deployment service confirmed the published base URL: `https://clinic-flow-new-platform.replit.app`. This is shown read-only; it is not inferred from preview environment variables.
- The existing public reception display accepts an optional canonical booking URL, retaining its legacy QR booking link as the default.
- Live-session component consumes the existing token-only public display endpoint with 15-second polling and explicit loading/failure/empty states.

## Connected contracts

- Both new-owner self-registration and Super Admin invited-owner setup now use the guided wizard and their generated atomic mutations. Branch hours, independent inheritance, slugs and optional own-doctor capability are submitted together.
- Real Clerk signup precedes owner setup. Existing local patient/staff identities are refused, not elevated. The server verifies the final password and verified primary email; normal staff password-proof enforcement is unchanged.
- `useGetRegistrationOptions` supplies public allowlisted categories, specialities and qualifications, including for newly authenticated identities with no application profile. Protected master APIs are no longer used by this flow.
- Generated clinic/branch slug resolvers supply live public contacts, location selection, active-doctor count, clinic-wide actual consultation average and individual doctor actual averages/expected durations. Unknown averages remain explicitly unavailable, never zero.
- Existing shared booking and reception display are reused. Null QR references explicitly disable those entry points; public GET never provisions a QR. Display QR points to the selected branch's `?book=1` URL. Legacy reference routes retain their existing behavior.
- Explicit application routes precede the public slug catch-alls. Sensitive/reserved roots are rejected without fetching clinic data.
- Clinic Admin `/admin/settings` is allowed; platform masters/audit remain excluded. `/admin/profile` is allowed only when the authenticated API identity is a Clinic Admin with a real `doctorId`.

## Intentional limitations / verification needs

- Staff invitation step currently defers optional invitations to existing staff management after registration. No invitation is claimed to have been sent.
- New registration requires at least one open day per location because an empty opening-hours array means unrestricted legacy hours on the backend. A wholly closed week is not representable by that contract.
- Published base was verified through the deployment service for this app, not fabricated; the UI uses that confirmed URL. If deployment domains change in the future this displayed base needs configuration refresh.
- Backend reserved slugs must also include all frontend application roots (particularly `doctor`, `patient`, `receptionist`, `audit`, `qrs`, `exceptions`); the new wizard prevents these names client-side, but server settings need the same restriction.

## Verification boundary

No app/browser execution or workflow restart is performed by this implementation worker. Main agent owns runtime and visual acceptance. Frontend TypeScript check passed after generated-contract integration. Live Clerk signup, password proof, atomic rollback, invitation delivery, public branch selection and mobile rendering still require runtime acceptance; compilation is not evidence of these workflows.