# Contact-optional booking

Status: implemented. Public guest submission verified in a browser; protected reception approval UI not browser-verified.

## Patient experience
- Short guest form from a clinic booking QR/link, without an account or OTP.
- Patient name required; email and phone optional.
- Guest requests await reception confirmation; no token or reserved capacity until approved.
- Confirmed requests show their token through a private receipt, not public name/token lookup.
- Reception can book directly without patient contact details.
- Existing signed-in bookings remain available.

## Checks
- Backend persistence, capacity, authorization, receipt privacy and idempotent confirmation: covered by four guest SQL tests; broader phase-one/auth suite 30 passed.
- Guest form: real mobile browser submitted a name with no email/mobile, without login. Database confirmed pending request, nullable contacts, no appointment and no reserved place. Receipt recovery and desktop layout checked.
- Reception approval/rejection controls implemented with server-side scope and date/doctor pagination; protected UI acceptance remains unverified.
- Full workspace typecheck passed. Frontend tests passed; four focused receipt tests pass after correcting premature pre-commit polling. Final frontend typecheck passed.
- Browser-found receipt polling race corrected: no receipt query until successful creation; uncertain submissions reuse their original idempotency data. No second full browser pass claimed.
- Availability requests now wait for a complete, non-past date instead of querying intermediate date-field edits. Default date respects branch timezone.
- Contact inputs are collapsed under “Add contact details (optional)”. No authentication changes.
- Temporary development fixture and its guest request were removed with ownership checks and zero remaining matching records verified.
- Development schema updated only; production and publication unchanged.

No SMS delivery or new authentication method is claimed.