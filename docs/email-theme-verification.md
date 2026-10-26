# DigiQ email theme verification

## References and scope

Both approved references were used:

- `attached_assets/image_1792994151991.png`: booking layout, light-grey canvas, white container, navy typography, blue accents, detail/support areas and muted branded footer.
- `attached_assets/image_1792995062722.png`: OTP branding/tagline, verification label, pale-blue panel, bordered white digit cells, expiry, shield treatment and separated help area.

These are visual references, not a change to event contracts. Doctor labels never use a composite visit summary. OTP copy retains the actual event; unsupported patient greetings and support links are not added. The sample code/expiry in the reference is not a sending default.

## Sending-path coverage

| Path | Presentation | Retained behavior |
| --- | --- | --- |
| Default patient booking confirmation | Shared shell plus authoritative clinic/location/doctor/date/session/timezone/reference/token details | Existing subject and wrapped plain-text body; original claim/gates and at-most-once dispatch |
| Published custom patient confirmation | Token-aware rendering plus the existing mandatory ticket summary | Published wording/prefix/footer/logo; summary appended under the existing rule |
| Queued appointment/onboarding notices | Shared notification presentation with event context | Existing capture, recipient, preference, activation, retry and outcome policies |
| Security verification/setup/completion | Shared notification presentation; prominent codes and supported setup action | Existing variable/link restrictions, real code/expiry and fictional-only administrative previews |
| Staff account notices | Shared notification presentation and sign-in action | Existing account/contact eligibility and dispatch barriers |
| Generic account access | Shared system shell and explicitly supplied account action | Original subject, text, URL and expiry wording |
| Ticket email and remaining system wrappers | Shared system shell | Attachments, text alternative and sender unchanged |

Structured visit details are passed only alongside the authoritative generated summary. Legacy/freeform summaries remain complete escaped cards, including old visit details. Template tokens are identified before values are substituted; user braces cannot trigger a second substitution.

## Preview

Email catalog/server previews and the explicit Render Preview response include sending-renderer HTML. The UI uses an empty-sandbox iframe, restrictive CSP and no referrer. External logo loading requires an explicit choice; internal CID logos are resolved to inline preview data, never private storage URLs. A failed logo preview is labeled unavailable. Plain text remains available, SMS remains text-only, and existing no-store/authorization/revision checks remain.

Optional test controls keep their separate form ownership. Rendering or publishing wording does not require delivery readiness, a recipient, completed optional test inputs or a real send.

## Evidence

- API schema regenerated with `pnpm --filter @workspace/api-spec run codegen`, including its shared-library TypeScript build.
- API Server and ClinicFlow TypeScript checks passed.
- The renderer/transport/confirmation/template/value/booking/frontend regression command below passed all 62 checks.
- Renderer/transport/confirmation/template/value/booking/frontend regression command:

  ```sh
  node --test --test-concurrency=1 \
    artifacts/api-server/src/email-template.test.mjs \
    artifacts/api-server/src/email-theme.test.mjs \
    artifacts/api-server/src/appointment-confirmation.test.mjs \
    artifacts/api-server/src/notification-templates.test.mjs \
    artifacts/api-server/src/notification-template-values.test.mjs \
    artifacts/api-server/src/booking-notifications.integration.test.mjs \
    artifacts/clinicflow/src/components/email-templates.test.mjs
  ```

- Focused browser pass: `pnpm exec playwright test --config artifacts/clinicflow/ticket-regression/playwright.config.ts email-theme.spec.ts sms-editor.spec.ts --workers=1` — six passed. Uses intercepted fictional APIs and the real HTML renderer, not staff accounts or SMTP.
- Covered escaped markup/quotes/ampersands, nonrecursive braces, long names, missing contacts, safe/unsafe links, all OTP event variants, intact leading-zero code `004281`, seven-minute expiry, preserved wording, CID/HTTPS logos, PDF attachment preservation, and queued/default/custom paths.
- Browser assertions covered preview HTML/plain text, sandbox/referrer/CSP, no scripts, publication with incomplete optional test values, unchanged activation and no send request. Existing SMS editor tests also passed.
- Browser examples at 1280px and 390px: booking, OTP, rescheduled, onboarding and long-content/image-blocked fallback; no horizontal overflow.
- Reproduce standalone examples with `node artifacts/api-server/src/email-theme.test.mjs --examples`. HTML is written under ignored `generated-artifacts/email-theme/`.
- Browser evidence is under ignored `generated-artifacts/ticket-regression/results/`, in the `email-theme-*` directories. Application-preview screenshots are under `generated-artifacts/email-theme/`.

## Limits

No real messages were sent, no live inboxes were checked, and no production templates, settings, activation, providers or deployment were modified. Browser rendering does **not** establish Gmail, Outlook, Apple Mail or assistive-technology compatibility in actual email clients. Those remain unverified. The wordmark remains readable text when images are unavailable; no replacement logo or unsupported support destination was invented.
