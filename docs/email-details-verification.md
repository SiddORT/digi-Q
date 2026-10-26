# Digi-Q email details verification

## Reference coverage

The reference is `attached_assets/image_1792996758292.png`. Its appearance is
retained without treating its sample name, code, expiry or booking language as
event data.

| Reference section | Rendering contract |
| --- | --- |
| Brand/tagline | Text-based Digi-Q and “Care. Plan. Care Together.” in the header and standard footer. Clinic logos remain separate, optional images. |
| Event label | Existing event-specific verification, booking and account labels remain authoritative. |
| Greeting | OTPs use neutral “Hello,” unless authored greeting wording is already present. No recipient-name variables were added to OTP events. Supported account/visit names remain in authored positions and are escaped. |
| Title/explanation | Existing event subject and authored body remain in order; clinic registration does not become appointment booking. Only email-owned defaults are corrected. |
| Actual OTP | Six adjacent digit spans preserve the full code, including leading zeros, with one accessible label and selectable text. No code image is required. |
| Actual expiry | The panel uses the supplied positive numeric expiry. Missing/invalid expiry does not invent ten minutes. Authored expiry text remains intact. |
| Security | Separate security panel says not to share the code and to ignore an unrequested OTP. |
| Help | One separated presentation-owned section, outlined Get support action, and readable address fallback. Desktop uses side-by-side wrapping blocks; narrow screens stack them. Both links are exactly `mailto:no-reply@digi-q.in`. Plain text includes the same destination. |
| Footer | Digi-Q, tagline and the standard automated/do-not-reply notice. Authored custom footer content is preserved rather than rewritten. |

The support address is an explicit user choice despite its no-reply name.
It is not a sender/reply-to configuration change or an assertion that the
mailbox accepts messages.

## Security and preservation

- The support destination is fixed inside shared email presentation, not a
  template variable, saved setting or general URL allowlist exception.
- Security template validation still rejects literal URLs, email addresses,
  HTML links and unsupported variables, even an authored copy of the approved
  support address.
- General action URLs still require HTTPS without embedded credentials.
- Notification sends, saved editor HTML previews and explicit edited-template
  Render Preview use the same renderer. Preview frames retain their existing
  no-navigation sandbox; this work does not enable external navigation there.
- Existing authored wording, token order, logos/CID attachments, inheritance
  and delivery semantics are preserved. No template data was updated.
- SMS text is not wrapped in email help/footer content. SMS catalog previews
  now explicitly use plain substitution, matching the SMS send path.
- A development-only read-only aggregate audit found no saved email
  published/draft wording containing `DigiQ`. No production data was inspected.
  If older authored wording exists elsewhere, it remains unchanged and needs
  explicit owner-approved editing/publication.

## Checks performed

39 focused tests passed:

```sh
node --test \
  artifacts/api-server/src/email-theme.test.mjs \
  artifacts/api-server/src/email-template.test.mjs \
  artifacts/api-server/src/notification-templates.test.mjs \
  artifacts/api-server/src/appointment-confirmation.test.mjs
```

Coverage includes exact support destinations, arbitrary security-link rejection,
renderer/preview parity, leading-zero selection text, real expiry, optional
names, escaping, account action buttons, saved-content immutability, logo
fallbacks, attachments, template inheritance and unchanged SMS defaults.
One stale transport-test expectation was aligned to the existing generic
provider-rejection message; transport behavior itself was not changed.

API typecheck passed after rebuilding stale shared Zod build output:

```sh
pnpm exec tsc -b lib/api-zod
pnpm --filter @workspace/api-server typecheck
```

The API workflow bundled successfully and served requests. The frontend
workflow started successfully.

The configured completion checks initially found two further expectations of
the previous email output: a browser branding assertion and an integration
assertion that omitted the new plain-text support/footer. Both were updated to
the approved output; browser coverage also asserts the exact support destination
in editor frames and OTP examples.

## Browser evidence and limits

Fictional HTML was generated under ignored `generated-artifacts/email-theme/`.
Screenshots inspected:

- `otp-desktop.jpg`: 1100px desktop, Digi-Q, `004281`, seven-minute expiry,
  security, side-by-side support treatment and automated footer.
- `otp-mobile.jpg`: 360px viewport; all digits remain on one line, long
  event wording wraps, and support stacks without horizontal clipping.
- `account-image-blocked-mobile.jpg`: 390px viewport; unavailable logo leaves
  readable alt text, text branding, supported recipient name, HTTPS setup
  button/fallback, 23-minute expiry and fixed support destination.

The unavailable fictional image causes an expected image-load error.
These are browser rendering observations, not inbox checks or evidence of
Gmail, Outlook or Apple Mail compatibility. Clipboard text is verified by
renderer tests; no OS mail application was opened. No live send, mailbox test,
activation, production-template edit or deployment was performed.
