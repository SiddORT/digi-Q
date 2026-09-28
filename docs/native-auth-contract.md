# Local authentication contract (frontend/backend integration)

All endpoints are under `/api` and use same-origin `HttpOnly` session cookies. Browser code sends `credentials: "same-origin"` and an `X-CSRF-Token` header for mutations. `GET /api/auth/csrf` issues a CSRF token for anonymous and authenticated callers. All password/verification/reset responses use `Cache-Control: no-store`; codes, tokens, passwords, and hashes must never appear in logs, list endpoints, or audit summaries.

| Endpoint | Request | Response |
| --- | --- | --- |
| `POST /api/auth/login` | `{email,password}` | `{authenticated:true,user:{id,email,fullName,role,status}}`; creates a staff session directly after password verification, without an email challenge |
| `POST /api/auth/verify-device` | `{challengeId,code}` | `{authenticated:true}` |
| `GET /api/auth/status` | none | `{role,staffPasswordVerified,requiresStaffPassword}`; never sets a CSRF cookie |
| `POST /api/auth/logout` | `{}` | `{authenticated:false}` |
| `POST /api/auth/forgot-password` | `{email}` | generic `{sent:true}` irrespective of account |
| `POST /api/auth/reset-password` | `{token,password}` | `{reset:true}` |
| `POST /api/auth/patient/start` | `{email}` | `{challengeId}`; generic response independent of account existence |
| `POST /api/auth/patient/verify` | `{challengeId,code}` | `{authenticated:true}` |
| `POST /api/auth/register/start` | `{email,password,fullName}` | `{challengeId}` |
| `POST /api/auth/register/verify` | `{challengeId,code}` | `{authenticated:true}`; create clinicAdmin locally, then complete `/clinic-registration` |
| `POST /api/auth/invitation/accept` | `{token,password}` | `{authenticated:true}` |
| `POST /api/auth/change-password` | `{currentPassword,password}` | `{changed:true}` |
| `POST /api/demo/login` | `{password}` | `{authenticated:true}`; native session cookie (no provider ticket) |

One-time verification hashes require `SESSION_SECRET` (at least 32 UTF-8 bytes); missing secret fails closed. The deployment must configure it separately from SMTP credentials.
Native cookies always use `Secure`; exercise interactive authentication over HTTPS. `TRUST_PROXY_HOPS` defaults to `0`; set `1` only behind a trusted ingress that overwrites incoming forwarding headers (rather than passing client-supplied `X-Forwarded-For` through).

Before a mutating auth request, the browser fetches `/api/auth/csrf` with
`credentials: "same-origin"` and `cache: "no-store"`. It retains the HttpOnly
cookie automatically and sends the returned `csrfToken` as `X-CSRF-Token`.
Session-status checks must not issue competing cookies. An explicit HTTP 403
`INVALID_CSRF` can be retried once after fetching a fresh token because the
middleware rejected the original request before its handler ran. Other errors
must not trigger a replay.

Normal staff password login does not require SMTP or email MFA. Email verification (including clinic registration), password recovery, staff invitations and patient email-code login still require explicit `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` configuration. No codes or links are returned to the browser or logged. Existing staff need invitation/reset links to set local passwords; their Clerk passwords cannot be copied. The `users.id` and role/scoping contracts remain stable. Provider-specific identity columns remain physically present only for compatible additive migration, never used as runtime identity. Public/guest QR URLs remain unauthenticated where they are today.