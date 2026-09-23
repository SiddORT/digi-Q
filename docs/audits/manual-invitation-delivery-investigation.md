# Manual invitation delivery investigation

**Investigation time:** 2026-09-23T06:26:37.651Z
**Mode:** Urgent read-only inspection; the retained invitation and all temporary records were left unchanged.
**Reported mailbox result:** The intended recipient reports no invitation email was received.
**Overall status:** Invitation record valid and still pending; actual email-provider acceptance and mailbox delivery are unverified.

## Requested result table

| Area | Result | Proof level | Evidence |
|---|---|---|---|
| Invitation created | Yes | Direct live Clerk read | The exact private-manifest invitation exists and is `pending`. |
| Recipient correct | Yes | Direct private reconciliation | App user and exact Clerk invitation both match the private-manifest recipient. The address is not reproduced here. |
| Role correct | Yes | Direct DB and provider metadata reads | App role and invitation metadata both say Receptionist. |
| Clinic mapping correct | Yes | Direct DB read | Exactly one clinic-level membership exists for Sunshine Multispeciality Clinic. |
| Branch mapping correct | Yes | Direct DB read | Exactly one branch assignment exists for Sunshine Multispeciality Clinic – Baner Branch, in the expected clinic. |
| Provider clinic-name metadata | Empty/not correct | Direct live Clerk read | The app's persisted clinic/branch assignments are correct, but the invitation's clinic-name metadata array is empty. This is not evidence of an email delivery outcome. |
| Invitation ticket created | Yes | Direct live Clerk read | The exact recipient invitation resource contains a ticket URL. It was not printed, parsed, opened, or consumed. |
| Send requested | Yes, by documented default semantics | Code plus installed SDK contract | The app called Clerk createInvitation. The app did **not** include a literal `notify:true`; the installed SDK documents `notify` as defaulting to true and describes createInvitation as sending the invitation email. No wire capture exists. |
| Send accepted | Unverified | Evidence boundary | Clerk accepted creation of the invitation resource. That response has no email message ID or provider-acceptance/delivery field, so pending invitation status is not proof that an email provider accepted a message. |
| Delivery status | Not received per recipient; provider delivery status unavailable | User report plus API boundary | No delivered, bounced, rejected, deferred, suppressed, or failed state is exposed on the invitation resource. |
| Failure reason | Unknown | Evidence boundary | No live bounce, rejection, suppression, quota-exhaustion, or provider error evidence is available. |

## Dates and current state

- Private fixture was checked at 2026-09-23T06:03:32.440Z.
- App target record was created at 2026-09-23T06:03:47.482Z.
- Clerk invitation was created at 2026-09-23T06:03:48.340Z and last updated at 2026-09-23T06:03:48.340Z.
- Clerk invitation status at 2026-09-23T06:26:37.651Z: `pending`.
- App invitation status at 2026-09-23T06:26:37.651Z: `sent`; this app value means createInvitation returned without throwing, not that mailbox delivery succeeded.
- Matching Clerk user identities at investigation time: 0. The pending invitation has not become the expected accepted user identity.
- Exact app create-audit rows: 1; resend-audit rows for this target: 0.
- Clerk instance environment returned by the documented read-only instance SDK endpoint: `development`.

## Notify and invitation evidence

- The retained private manifest records the intended mechanism, a 7-day configured expiry, and intended notify behavior. It is ownership/context evidence, not a network trace.
- The current app source does not explicitly pass `notify:true` to Clerk. It relies on Clerk's documented default of true.
- The exact Clerk resource independently proves creation, current pending state, exact private recipient association, Receptionist role metadata, and existence of a URL on that same resource.
- The invitation clinic-name metadata array is empty even though the persisted app mapping is exact. This metadata discrepancy does not prove or explain email non-delivery.
- The provider URL was only checked for presence on the exact recipient resource. It was not exposed, parsed, requested, or used.
- Pending is an invitation lifecycle state. It does not establish email-provider acceptance, delivery, inbox placement, or recipient receipt.

## Email mechanism and custom-sender check

- ClinicFlow calls Clerk's Backend SDK `invitations.createInvitation` directly.
- No application email transport, SMTP client, transactional-email provider client, invitation email sender, or `email.created` webhook handler is present in the server code searched.
- Therefore there is no app-side custom sender attempt or app-side provider error to inspect.
- The installed Clerk SDK does not expose an email-template client, so the investigation used the official documented deprecated read-only REST list endpoint exactly once.
- Live invitation template: Slug `invitation`; `delivered_by_clerk=true`; `enabled=true`; `flagged_as_suspicious=false`; created 2024-07-09T16:07:57.417Z; updated 2024-07-09T16:07:57.417Z.
- Template references clinic metadata in body/markup: `false`. Only this boolean was retained; no subject, HTML, body, markup, or variable content was logged or reported.
- The live template is enabled and delivered by Clerk. Template-off/custom-delivery configuration does not explain the missing message.
- This finding does not claim that Clerk Dashboard/management access is unavailable; dashboard configuration and logs were not evaluated by this SDK-only script.

## Delivery-log and query boundary

| Read-only query/evidence source | Outcome | Sanitized detail |
|---|---|---|
| Clerk invitation list, exact private recipient and invitation ID | Success | One exact invitation returned; status `pending`. |
| Clerk instance GET | Success | Environment type `development`. |
| Clerk user lookup, exact private recipient | Success | No accepted matching Clerk user identity currently exists. |
| Clerk email status GET | Unavailable for this invitation | The installed SDK requires an email message ID; the invitation resource exposes none. No speculative ID or endpoint was used. |
| Clerk email list/log query | Unavailable in installed documented SDK | No email list/log method is exposed. |
| Clerk invitation-email template list GET | Success | Official documented REST endpoint used once because no read-only template SDK client is exposed. Slug `invitation`; `delivered_by_clerk=true`; `enabled=true`; `flagged_as_suspicious=false`; created 2024-07-09T16:07:57.417Z; updated 2024-07-09T16:07:57.417Z. |
| Bounce/rejection/suppression/message ID | Unavailable | The invitation has no such fields, and no correlated email ID is available for the documented email GET. |
| Dashboard/management delivery logs | Not evaluated by this script | No claim is made about dashboard availability or what authorized management views may expose. |

## Development-instance limits

- The live instance identifies itself as Development.
- Clerk public documentation states development emails normally use an `@accounts.dev` sender and documents a development allowance of 100 emails per month.
- Current quota usage is unknown. There is no live evidence that the allowance was exhausted, so quota exhaustion is **not** identified as the cause.
- There is likewise no evidence of suppression, bounce, rejection, spam filtering, or a recipient-side fault.

## Conclusion

- **Known:** the exact recipient, Receptionist role, one exact persisted clinic, one exact persisted branch, provider role metadata, and ticket association are correct. Clerk created the invitation and still reports it pending.
- **Known discrepancy:** the invitation's provider clinic-name metadata array is empty. No evidence ties that metadata discrepancy to email delivery.
- **Known:** the app invoked Clerk's standard invitation API and relied on its documented notify-default behavior; it did not explicitly serialize `notify:true`.
- **Known:** the recipient reports that no email arrived.
- **Template configuration:** The live template is enabled and delivered by Clerk. Template-off/custom-delivery configuration does not explain the missing message.
- **Not verified:** email-message creation, downstream provider acceptance, delivery, bounce/rejection/suppression state, message ID, and development quota usage.
- **Cause:** indeterminate. The live template configuration is on for Clerk delivery, while message logs/quota remain unavailable. No specific quota, bounce, suppression, recipient-side, or provider failure is claimed.
- The invitation flow must remain paused and must not be marked passed until real delivery and the complete invitation → password setup → staff login flow are verified.
- No invitation/account resend, revoke, creation, deletion, cleanup, authentication/settings change, or business-data change was performed.
