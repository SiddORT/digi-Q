# Guest booking API

Guest requests reserve **no capacity** and create no account, appointment or token until reception confirms. No OTP or email delivery. Authentication/provider configuration is unchanged.

## Public integration
- Existing `GET /api/public/qr/:reference` resolves an active QR. Use existing public doctors/branches lists restricted by that context, then `GET /api/public/availability?doctorId=...&branchId=...&date=YYYY-MM-DD`. Architecture has one active schedule per doctor/branch/weekday, not selectable time slots.
- `POST /api/public/guest-requests` (`useCreateGuestRequest`) body: `{ qrReference, fullName, email?: string|null, mobile?: string|null, branchId, doctorId, date, requestId, receiptSecret }`. Name required; absent contacts stored null. `requestId` must be a browser `crypto.randomUUID()`. Generate `receiptSecret` using 32 cryptographically random bytes encoded as 64 lowercase hex characters **before submitting**, retain both for retries. Neither goes in a URL. Reusing requestId with different data or secret is 409.
- Response 201: receipt described below. Keep secret locally with explicit advice that losing it requires reception assistance; never put it in links, QR, analytics or logs.
- `POST /api/public/guest-receipt` (`useGetGuestReceipt`) body `{ receiptSecret }`. Poll every 15–30 seconds. Response is an allowlisted receipt: `{ id, status: pending|confirmed|rejected, fullName, clinicName, branchName, doctorName, date, startTime, endTime, timezone, token: string|null, reason: string|null }`. No appointment ID, private reference, history or contact fields. Printable receipt must clearly say pending requests are not queue places. Token appears only after confirmation. Secret is SHA-256 hashed in storage.

## Reception integration
- `GET /api/guest-requests` (`useListGuestRequests`) query optional `clinicId`, `branchId`, `doctorId`, `date` (YYYY-MM-DD), `status` (default pending), `page` (default 1), `pageSize` (default 20, max 100). All filters intersect authorized scope before pagination/count. Returns `{items,total,page,pageSize}`. Items contain receipt fields plus `clinicId, branchId, doctorId, email, mobile, appointmentId, createdAt`. Scope is enforced for receptionist/clinicAdmin/superAdmin; doctors/patients forbidden.
- `POST /api/guest-requests/:id/decision` (`useDecideGuestRequest`) body `{ action: confirm|reject, reason }` (required nonblank, max 500). Returns staff item. Same decision repeated returns existing result; conflicting decisions 409. Confirmation atomically uses existing transactional booking rules and creates a waiting appointment for an unlinked patient (never an authenticated account); last-minute capacity failures return 409 and leave request pending. Refresh requests, appointments and queue after confirmation.
- Errors `{error,code}`: 400 validation/context mismatch, 403 scope, 404 missing/revoked QR or receipt, 409 capacity/state/idempotency conflict, 429 IP rate limit.
- No guest cancellation/rescheduling or name/token lookup endpoints. Reception can recover requests in its scoped list. No notification delivery is implied.

## Operational boundaries
- Public submission limit is 20 per IP per 15 minutes; receipt polling limit is 60 per IP per minute, in addition to the existing global API limiter. Limiters are process-local (not a distributed multi-instance quota).
- Mutation requests retain existing same-origin protection. Send from the application origin; cross-origin anonymous clients are not supported.
- Development database migration applied: nullable patient mobile and new guest_requests table/index/constraints. Managed production schema changes remain Publish-owned; no startup or production migration was added.
- Contact-optional assisted booking is restricted to unlinked patient records and reception/admin actors. Linked/authenticated patient booking retains existing mobile/verification rules.