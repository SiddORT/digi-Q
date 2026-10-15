# Communication consolidation — focused verification

Verified on 2026-10-15. This was a frontend-only consolidation, not release certification.

## Scope preserved

- Existing Communication email and operational SMS editors and save/test handlers
  remain in place. Email only composes a separate Diagnostics section.
- Notification Logs, bell inbox queries, unread counts and mark-read actions remain.
- Twilio authentication configuration and environment-backed storage remain in
  Integrations. Its Email choice links to the canonical Communication page.
- Backend routes, transports, vault, authentication, workers, generated contracts,
  database schema/data and environment variables were not modified.
- Removing the preference/policy screen does not reset saved preferences, opt-outs,
  revisions, gates, templates or history, or move its matrix into provider forms.

## Automated component/route checks

The focused passing set contained 28 checks:

```sh
node --test --test-skip-pattern='nothing sends or writes on page load' \
  artifacts/clinicflow/src/components/integration-settings.test.mjs \
  artifacts/clinicflow/src/components/email-consolidation.test.mjs \
  artifacts/clinicflow/src/lib/communication-routes.test.mjs \
  artifacts/clinicflow/src/lib/communication-contract.test.mjs

node --test --test-name-pattern='save updates the provider baseline|tests need explicit recipient|settings link follows permitted navigation' \
  artifacts/clinicflow/src/components/sms-settings.test.mjs
```

These cover the real rendered Email panel with fictional read-only hook fixtures;
one editor/test flow; no provider calls on render; safe statuses; the saved off gate;
manual diagnostics composition; SMTP alias routing without loops; ordinary-role
landings; removed entry points; and existing confirmation/revision/draft safeguards.
The final canonical-tab query preservation change was separately checked with the
`actual legacyDestination` test. `git diff --check` passed.

### Unrelated failures observed, not investigated or fixed

An initial focused invocation also included existing SMS checks and surfaced
failures in unchanged SMS fixtures/assertions:

- `saved Keep in Touch settings render provider, exact endpoint, independent masked credentials and format warning`
- `Custom API settings still render existing authentication mapping and entity controls without Bearer-body preset`
- `panel binds write-only secrets, public urls and enabled flag; test stays usable when editing is locked`
- `template test: superadmin-only, semantic reset, immutable retry, shared controls`
- `sms drawer busy blocks close; mapping collapsed; anchors guarded`

The existing combined contract check `nothing sends or writes on page load, draft
save goes through confirm, SMS test is button-only` still expects the word
`confirmed` directly in NotificationTemplatesPage, where confirmation is delegated.
It was excluded from the passing invocation, not presented as passing. The affected
Settings-link assertion and the email/SMS double-click guard matchers were aligned
with their current components. No unrelated working code was changed.

## One fixture-only browser pass

All API traffic was intercepted before navigation with fictional responses.
External/provider traffic was blocked; no real authentication, settings writes,
database access or live messages were used.

- Email: configured credentials remain masked; readiness/source/status refresh and
  manual connection results work; source/time and the inbox-delivery caveat appear.
  Initial Email entry made zero check/send/write requests. Refresh did not run a check.
- Email drafts: Cancel retains the draft; Discard and Switch clears it. SMS Settings
  and Notification Logs remain reachable.
- Email save: password confirmation required; the intercepted host-only save retained
  revision protection, omitted username/password replacements and preserved the
  existing TLS/notification flags. A new saved revision cleared old check results.
- Test email: Cancel sent nothing; one explicit confirmation produced exactly one
  intercepted fictional request with `confirmed` and a request ID.
- Platform: preferences remain, without embedded Integrations or Notifications.
- Integrations: Email links to canonical Email Settings; Twilio and storage remain.
- Legacy email/SMTP shortcuts reach canonical Email; the Integrations shortcut reaches
  Settings Integrations. Superadmin legacy Notifications selects Platform.
- Clinic Admin legacy Settings lands at Clinic. Doctor, receptionist and patient
  own-workspace legacy Settings URLs land at their respective Profile pages.
  Cross-workspace admin URLs retain the existing authorization guard/dashboard landing.
- Ordinary roles have no Settings sidebar/profile/favorite/search entry and are not
  redirected to Communication. Superadmin and Clinic Admin bell inboxes showed
  fictional entries and two unread, without the removed settings shortcut.

The Superadmin flow recorded 56 intercepted API requests, with only three manual
writes: one connection check, one explicitly confirmed test email and one settings
save. The 15 requests before the first manual write were GET-only. Ordinary-role
checks made no writes.

Screenshots and the combined fixture report were inspected; generated outputs are
kept outside Git under `generated-artifacts/communication-consolidation/`.

## Explicitly not performed

No broad regression suites, full-project audits, production/release builds, release
readiness checks, deployment, live provider connections or real message delivery.
The backend workflow was not started for this verification. The public preview
rendered; its unmocked authentication-status request returned 502 because that
backend was intentionally not running. Signed-in checks used intercepted fixtures.
