# Published clinic metadata and private-page exclusions

## Scope and outcome

**Checked host:** `https://uat.digi-q.in`, explicitly supplied and approved by
the user for read-only checks. This is the operator's UAT installation, not an
assumed primary production domain. Replit's deployment lookup reported no active
deployment for this workspace; it does not describe this separately hosted site.

**Checked:** 2026-10-21, approximately 13:47–13:52 UTC.

**Outcome: verification complete; published metadata acceptance failed.**
Clinic/location-specific titles appear after JavaScript, but canonicals are
missing, descriptions and Open Graph titles are duplicated, and the checked
private/auth/token routes remain `index, follow` in both initial HTML and the
settled browser document. The published host does not currently demonstrate the
fail-closed metadata and robots policy present in the workspace.

No deployment, configuration/domain/slug changes, authenticated access, real
token redemption, booking, form submission, notification or database operation
was performed. This report is evidence, not a remediation or authorization audit.

## Method and privacy limits

- Made 37 bounded HTTP GET probes: 34 distinct HTTPS paths, two repeat probes
  using a `Googlebot` User-Agent, and one HTTP-to-HTTPS root redirect check.
  Redirects were only followed on the approved hostname.
- Discovered public clinic/location slugs using signed-out public directory and
  slug-resolution GET endpoints. Only public clinic names/slugs were retained;
  no QR references, private records, addresses or contact information are
  reproduced here.
- Completed head-only browser checks of 30 routes, waiting 2.5 seconds after
  document load. Collected only document title, description/robots/social tags,
  canonical links, final path, navigation status and page-error count.
  Each route used a new page in a signed-out context; there was no sign-in.
- Browser requests other than GET/HEAD were blocked. The completed head-only
  pass observed **zero attempted writes** and **zero JavaScript page errors**.
  No camera permissions were granted.
- An earlier browser-tool pass stopped after five public pages because the
  tool automatically captured page snapshots, including a public live-session
  section and QR element. That output is not reproduced in this report.
  The replacement head-only pass disabled screenshots, tracing and body
  collection. Only the public home screenshot was used as visual evidence.
- Sanitized session evidence is in ignored generated output:
  `generated-artifacts/uat-metadata-http.json` and
  `generated-artifacts/uat-metadata-rendered.json`. These are not committed;
  the durable findings and full route inventory are below.

## Initial HTTP responses

Every checked frontend path, including unknown clinic and invalid token paths,
returned **HTTP 200**, `Content-Type: text/html`, and the same 1,698-byte SPA
shell (SHA-256 prefix `cf55d0b416db`).

Shared shell:

- Title: `DigiQ Doctors | Know. Plan. Arrive. Consult.`
- Description: `DigiQ Doctors helps you find your clinic, book appointments, and follow your place in the queue. Know. Plan. Arrive. Consult.`
- Robots: exactly one `index, follow`.
- No canonical link, `og:url`, HTTP `Link` or `X-Robots-Tag` header.
- Generic Open Graph and Twitter title/description.
- Server: `nginx/1.24.0 (Ubuntu)`; `Last-Modified`:
  `Mon, 19 Oct 2026 14:04:27 GMT`; ETag: `"6ad6236b-6a2"`.
- No `Cache-Control`, `Vary` or HSTS header was present in the sampled shell
  responses. This is an observation, not a full transport-security audit.

The Googlebot-labelled clinic-location and sign-in probes returned the same
shell/hash as ordinary requests. This is only a User-Agent comparison, not
proof of Googlebot identity, search-engine rendering, access approval or indexing.

| Additional endpoint | Observed response |
| --- | --- |
| `http://uat.digi-q.in/` | HTTP 301 to the HTTPS root, then HTTP 200 |
| `/kushan-clinic/` | HTTP 200 shell; no server redirect to slashless URL |
| `/robots.txt` | HTTP 200, `text/plain`; exactly `User-agent: *` and `Allow: /` |
| `/sitemap.xml` | HTTP 200 **HTML shell**, not an XML sitemap |
| `/api/public/website-config` | HTTP 404, JSON; configured public-origin response unavailable |

No tested HTTPS frontend route issued an HTTP redirect; the browser redirects
listed below happen after JavaScript loads.

## Rendered public metadata

All rows below retained one `robots=index, follow` tag, had **no canonical**
and **no `og:url`**, and returned HTTP 200 for navigation.

| Path | Rendered document title |
| --- | --- |
| `/` | `DigiQ Doctors \| Know. Plan. Arrive. Consult.` |
| `/kushan-clinic` | `dombivali · Kushan Clinic \| DigiQ Doctors` |
| `/kushan-clinic/dombivali` | `dombivali · Kushan Clinic \| DigiQ Doctors` |
| `/multispecialist-clinic-asangaon` | `Multispecialist Clinic \| DigiQ Doctors` |
| `/multispecialist-clinic-asangaon/asangaon` | `Asangaon · Multispecialist Clinic \| DigiQ Doctors` |
| `/kushan-clinic/dombivali?book=1` | `dombivali · Kushan Clinic \| DigiQ Doctors` |
| `/kushan-clinic/dombivali?display=1` | `Kushan Clinic · Queue display` |
| `/seo-check-nonexistent-clinic` | `Clinic Information \| DigiQ Doctors` |

All seven non-home rows had **two description tags** and **two `og:title`
tags**: the generic shell tags remain alongside dynamically appended tags.
Clinic descriptions were clinic-wide rather than location-specific:

- Kushan: `Visit Kushan Clinic. Find clinic locations, care specialists, live sessions and book a visit.`
- Multispecialist: `Visit Multispecialist Clinic. Find clinic locations, care specialists, live sessions and book a visit.`
- Unknown clinic: `Clinic locations, care teams and booking information.`

Open Graph descriptions and Twitter metadata stayed generic. The display-mode
document title differed from its appended clinic `og:title`. Booking and display
query modes did not become `noindex`. The unknown clinic stayed indexable and
returned a success shell, creating a soft-404 risk.

## Rendered private/auth/token inventory

Every row returned an HTTP 200 shell, retained `robots=index, follow`, had no
canonical or `og:url`, and kept the generic description/social metadata.
Except where noted, the generic document title also remained.

`INVALID_TOKEN` below means the literal synthetic
`seo-check-invalid-not-a-real-token`; `INVALID_REFERENCE` means
`seo-check-invalid-not-a-real-reference`. Neither is a real credential or code.

| Requested path | Settled browser path / note |
| --- | --- |
| `/sign-in` | unchanged |
| `/sign-up` | `/patient-login` |
| `/login` | `/sign-in` |
| `/patient-login` | unchanged |
| `/demo-login` | unchanged |
| `/register` | `/patient-login` |
| `/register-clinic` | unchanged; title `Register a Clinic \| DigiQ Doctors` |
| `/register-doctor` | unchanged |
| `/onboarding` | `/sign-in` |
| `/forgot-password` | unchanged |
| `/reset-password?token=INVALID_TOKEN` | `/set-password?flow=reset&token=INVALID_TOKEN` |
| `/set-password?token=INVALID_TOKEN` | unchanged |
| `/admin/dashboard` | `/sign-in` |
| `/doctor/dashboard` | `/sign-in` |
| `/receptionist/dashboard` | `/sign-in` |
| `/patient/dashboard` | `/sign-in` |
| `/auth/seo-check-invalid` | unchanged; only a representative invalid auth path |
| `/book/INVALID_REFERENCE` | unchanged |
| `/display/INVALID_REFERENCE` | unchanged; title `DigiQ Doctors · Queue display` |
| `/check-in?token=INVALID_TOKEN` | `/sign-in?redirect=` plus the URL-encoded original path/query |
| `/scan-qr` | unchanged |
| `/guest-booking` | unchanged |

These results establish missing crawler-exclusion signals on the sampled
signed-out route families. They do **not** establish that private records are
accessible: protected workspace pages redirected to sign-in. No private API
authorization, signed-in views, valid invitations, patient tickets, QR payloads,
or actual appointment links were inspected.

## Comparison with workspace intent

The current workspace's `index.html` starts with `noindex, nofollow`.
`RouteMetadataBoundary` keeps non-home routes excluded until a successful
public-clinic response; `PublicClinicPage` supplies unique metadata/canonical
using the configured origin, while booking/display modes remain excluded.
The workspace's `robots.txt` lists private/auth/token route disallows, and the
API defines `/api/public/website-config`.

The observed UAT shell, robots file, duplicate rendered tags and 404 config
endpoint differ from those intentions. This is evidence of an installation
difference, **not proof of its cause or exact build revision**. The UAT
environment's configured origin could not be verified through its public config
endpoint, and no environment secrets were read.

Relevant source:
`artifacts/clinicflow/src/lib/page-metadata.tsx`,
`artifacts/clinicflow/src/components/PublicClinicPage.tsx`,
`artifacts/clinicflow/index.html`,
`artifacts/clinicflow/public/robots.txt`,
`artifacts/api-server/src/lib/public-website-config.ts`.

## SPA and crawler limitations

- Plain HTML clients and non-JavaScript social preview tools currently see only
  the generic shell, not clinic-specific titles/descriptions/canonicals.
- JavaScript-capable browser results do not guarantee that any search engine
  will render, index, choose a canonical, refresh a preview or rank the page.
  Duplicate tags make the selected description/social title ambiguous.
- Importantly, merely serving the workspace's newer fail-closed shell would
  give public clinics an **initial `noindex`** until JavaScript changes it.
  Some crawlers may skip rendering after seeing that initial directive.
  Do not call public pages search-ready solely because a browser later shows
  `index, follow`; route-aware server rendering/prerendering needs a separate
  design and decision.
- `robots.txt` governs cooperative crawling, not authorization or guaranteed
  removal from search. Blocking crawling can also prevent a crawler from
  observing a page's `noindex`. Private pages need an intentional combined
  HTTP/meta/robots policy, not a claim that disallow alone protects data.
- Missing/invalid routes returning the same HTTP 200 shell can be treated as
  soft 404s. `/sitemap.xml` returning HTML is not evidence of a working sitemap.
- No Search Console, cached search listings, authenticated crawler, valid-token
  routes, other hosts/old domains, or delayed rendering beyond the observation
  window was verified. This report authorizes neither crawling nor ranking.

## Next decisions

Keep this evidence separate from live remediation. An operator-approved UAT
release/configuration review should reconcile the hosted build with the intended
metadata policy and then recheck the same paths. Separately, decide how real
public clinic pages should expose unique metadata to non-JavaScript clients
without weakening private-route exclusions. No deployment or infrastructure
change is included in this read-only verification.
