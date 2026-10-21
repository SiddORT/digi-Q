# Old-domain link inventory and decision gates

## Status: operator-approved planning inventory; no domain change authorized

This is a planning record, not authorization to execute a migration. The operator
identified the Replit-published URL and a separate Git-deployed installation on
their own server at `https://uat.digi-q.in`. They described module-wide sharing,
not individual historical links. This is a module-level planning inventory, not a
verified count of distributed old-domain codes. Do not infer domain control from
repository URLs, certificates, a working link or the configured canonical origin.

### Operator decision

After the distinction between configuration and old-link continuity was explained,
the operator replied, “lets do as per your recommendations”. This approves the
module-level planning approach: keep both sites unchanged, retain the existing
server-side address setting, and require separate approval for any domain move
or old-host retirement. It does not confirm unknown infrastructure control,
historical distribution counts or individual link validity.

The read-only admin display is follow-up implementation, not completed here.
No cutover date is set and no replacement operation is approved. The operator
must designate replacement and infrastructure owners before a future cutover.

Related guidance: [public-link contract](public-website-links.md),
[self-hosting checklist](self-hosting.md#canonical-public-website-address) and
[release gates](clinic-expansion-release.md#canonical-public-link-rollout).

## Safe operator intake

Supply fictional or redacted examples only, one per distinct link/material type.
Use consistent fictional host labels such as `old-a.example.invalid`, and tell us
which labels represent the same host. Preserve the route shape and parameter
names, but replace **every** token, opaque QR payload, appointment ID, reference,
clinic/location slug, patient/staff detail and query/fragment value with a
descriptive placeholder. Do not upload real tickets, messages or QR images:
their machine-readable content may still contain private values after visible
text is covered. Decode locally and share only the redacted text.

For each example, provide the material (poster, printed ticket, saved image/PDF,
website button, email/SMS or bookmark), approximate quantity/reach, whether it
is still distributed, and who can replace it. For each host label, confirm
control or mark it unknown/not controlled; include whether DNS, HTTPS renewal
and hosting/routing are under the operator's control. Credentials are not needed.
Identify the intended new host with a fictional label as well.

## Classification reference — fictional examples, not operator evidence

| Fictional route on `https://old-a.example.invalid` | Class | Planning treatment |
| --- | --- | --- |
| `/book/[REFERENCE]` | Public booking | Assess shared QR/poster/link replacement; do not change the saved reference. |
| `/[CLINIC-SLUG]` or `/[CLINIC-SLUG]/[LOCATION-SLUG]` | Public clinic/location booking | Confirm the route is genuinely a public clinic page, not a reserved application route. |
| `/display/[REFERENCE]` | Public queue display | Inventory display bookmarks and shared display codes separately from booking codes. |
| `/patient/queue?appointment=[APPOINTMENT-ID]` | Private/account-scoped appointment tracking | Preserve authentication and appointment scope; not a public booking code. |
| `/check-in?[PARAMETER]=[OPAQUE-PAYLOAD]` or a raw opaque QR payload | Private appointment/check-in | Preserve staff-only handling and server validation; do not convert into a public booking URL. |
| `/set-password?token=[REDACTED]` | Security: staff invitation/setup | Never forward or bulk rewrite the credential-bearing link. Assess expiry and existing authorized resend separately. |
| `/reset-password?token=[REDACTED]` | Security: password recovery | Do not migrate/reuse tokens; any fresh recovery requires a separately approved normal recovery flow. |
| Unknown path, short URL, external QR-service URL or unexpected parameters | Unclassified; potentially sensitive | Stop and classify before including it in a public continuity proposal. |

Classification is about purpose and sensitivity, not whether a page currently
requires login. A public-looking route with unexpected token parameters requires
review. Opening a URL in a browser and scanning it in the app are different:
an old-host routing arrangement would not itself authorize scanner acceptance.

## Operator inventory — module-level evidence

### Domain control

| Host label | Old/new; environment | Operator control: DNS / HTTPS / routing | Confirmation basis and date (no credentials) | Approved continuity window / responsible role |
| --- | --- | --- | --- | --- |
| `clinic-flow-new-platform.replit.app` | Operator identifies this as the Replit-published URL; no retirement or replacement approved | Underlying DNS / HTTPS control unconfirmed; publishing-account access unconfirmed | Operator statement; no infrastructure check performed | Not approved |
| `uat.digi-q.in` | Operator identifies this as their separate self-hosted UAT installation, deployed through Git; not an approved replacement for the Replit site | DNS / HTTPS administration unconfirmed; operator reports hosting on their own server | Operator statement; no infrastructure check performed | Not approved |

### Distributed materials and decisions

| Item | Redacted example / host label | Class | Material, reach, still issued? | Replaceable by whom? | Proposed action / deadline | Operator approval |
| --- | --- | --- | --- | --- | --- | --- |
| Supplied homepage | `https://clinic-flow-new-platform.replit.app/` | Public homepage, not a booking/display, private appointment or security-token example | Unknown; repeated URL does not identify materials | Unknown | Hold domain change pending inventory / no deadline approved | Hold approved; no replacement authorized |
| Booking page and clinic URL | Operator names these modules; specific host/path not supplied | Public booking/discovery, subject to route confirmation | Intended sharing described; historical reach and distribution status unknown | Not assigned | Replace editable public shares and regenerate public QR artwork only after target-origin and route approval | Pending |
| Display links | Application classification reference only; operator did not specifically identify this module | Public display, separate from booking | Distribution unknown | Not assigned | Review display devices, bookmarks and public display QR sheets before retirement | Pending |
| Ticket and appointment page | Operator names these modules; specific host/path not supplied | Private appointment/check-in or account-scoped tracking; do not treat as public booking shares | Intended sharing described; printed/downloaded quantities unknown | Not assigned | Preserve payload and appointment identity; define authorized replacement/support before cutover | Pending |
| Email and SMS | Operator names these delivery channels, not a particular message | Mixed: classify the actual link, not the delivery channel | Intended sharing described; previously sent-message count unknown | Not assigned | Update future generated links only after approved configuration change; sent messages cannot be recalled by changing the origin | Pending |
| Invitation/setup and password recovery | Application classification reference only; operator gave no token-link example | Security-token links, separate from public and appointment links | Historical distribution and expiry unknown | Not assigned | No rewrite, forwarding or regeneration; separate authorized expiry/recovery decision | Pending |

No operator examples of booking/display, private appointment or security-token
paths have been provided: the operator said there are many links across modules,
with nothing specific. Module descriptions support the provisional classes above,
not a per-link audit. Their absence from this intake does not establish that none
have been distributed. The fictional reference table above must not be presented
as operator-provided evidence.

Do not mark an unknown quantity as zero or an unconfirmed host as controlled.
Record separate rows where the same link appears on replaceable posters and
irretrievable sent messages. Private/security examples stay redacted in this
record; retain any necessary original operational evidence outside Git in an
appropriately restricted record.

## Conditional continuity/replacement plan

### Recommended configuration policy

The operator's clarified preference is a single server-side `.env` address,
visible but **not editable** in Clinic Admin and Super Admin profile/settings
panels. Use the existing `CLINICFLOW_PUBLIC_ORIGIN` authority, not a second base-URL
setting or a per-clinic override. Do not have web settings write `.env`.
Configuration is per installation: the self-hosted UAT setting does not change
the Replit installation or establish that their databases, records or tokens are
shared. A hostname substitution is not a database migration.

The existing contract requires a server restart after environment changes and a
reload of open browser tabs. New generated absolute links then use the validated
origin; printed codes, saved PDFs and already sent messages keep their old host.
The read-only profile/settings display is a separate requested UI change, not
implemented by this documentation task.

**Approved immediate decision:** keep both installations' addresses unchanged.
No replacement host, date or old-host retirement has been requested. Before any
future cutover, resolve domain control, actual distributed examples, replacement
owners and private/security-link handling through the gates below.

1. **Inventory approval:** Operator confirms classifications, host control,
   environments, material coverage and remaining unknowns. Unclassified items
   block approval of their handling; this worksheet alone does not clear rollout.
2. **Strategy approval per host and class:**
   - For confirmed controlled old hosts, choose between a time-limited continuity
     proposal and replacement. Any continuity proposal must name exact hosts,
     public routes, destination, hosting/HTTPS responsibility, end date and failure
     response. No wildcard host trust or automatic redirect is implied.
   - For uncontrolled or unknown hosts, do not promise continued access. Propose
     replacing posters, QR sheets, saved exports and editable web links before
     cutover. Sent messages, patient-held tickets and bookmarks cannot be silently
     recalled; define an authorized patient-support/replacement process and
     explicitly accept residual access risk or postpone cutover.
   - Private appointment links need a separate access/security decision preserving
     appointment identity and staff/patient boundaries. No blanket host rewrite,
     forwarding of payloads, token regeneration or scanner-trust expansion.
     Security links require a separate expiry/recovery/resend decision.
3. **Rehearsal approval:** Separately approve an isolated fictional-data rehearsal
   covering browser access, decoded QR content, both scanners' existing rejection
   boundaries, authentication, expiry/revocation and wrong-host rejection.
   Mock all deliveries. Record expected unsupported old links as failures needing
   an accepted replacement, not as successful continuity.
4. **Execution approval:** Only after the inventory and rehearsal are accepted,
   obtain distinct authorization for exact DNS/TLS/proxy or application changes,
   canonical configuration, any delivery and deployment. Specify the maintenance
   window, responsible roles, replacement completion, support instructions, stop
   conditions and rollback. This task authorizes none of those actions.
5. **Retirement approval:** Before ending any separately approved old-host service,
   confirm replacements, remaining private/security-link handling and accepted
   residual risk. Restoring a configuration does not repair already distributed
   new-host links; rollback must account for both generations.

## Completion evidence required

- Supplied homepage and module descriptions classified; no specific old-code
  examples supplied. Fictional route examples remain clearly separate.
- Confirmed installation context and explicit control/material unknowns recorded.
- Operator-approved no-change plan, with future execution and retirement gates.
  Owners and deadlines must be agreed when an actual move is proposed.

Current result: **operator-approved module-level planning inventory and
conditional plan complete; per-link inventory and cutover readiness not
established.** This is a narrower evidence set than the original request for
operator-provided redacted booking/token examples: the operator described modules
instead and approved the planning recommendation. Exact historical links, counts,
infrastructure-control details and replacement owners remain unknown and block
any real cutover. No continuity or completed material replacement is claimed.
Only documentation has been prepared. No links were opened, QR codes scanned,
providers contacted, tokens regenerated, scanner rules changed, live settings
changed, redirects implemented or deployment performed.
