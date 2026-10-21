# Public clinic initial HTML

## Rendering contract

The server renders a controlled public projection into the initial HTML, rather
than serializing the directory API or rendering the signed-in application.
Active `/:clinicSlug` and `/:clinicSlug/:branchSlug` pages receive:

- One title, description, robots tag, canonical, `og:url`, and matching
  Open Graph/Twitter titles and descriptions.
- Clinic-root identity at the clinic URL, even when the directory API
  automatically selects the clinic's only location. Location URLs use that
  location's name, address and city.
- A basic clinic/location heading and description inside the root element for
  non-JavaScript clients. React replaces this when the application starts.
- Canonicals derived only from the validated `CLINICFLOW_PUBLIC_ORIGIN`, never
  Host, forwarded headers, cookies or the browser origin.

Trailing slashes and directory search/sort/paging queries share the slashless
base canonical without copying query values into metadata. No redirects or
old-host aliases are added. Missing/invalid public addresses, inactive clinics,
inactive locations and locations belonging to another clinic return **404**,
`noindex, nofollow` and no canonical. Database failures return **503** with
`Retry-After: 60`; they are not reported as missing clinics.

If the configured origin is absent or invalid, public identity can still be
read, but indexing stays disabled and no canonical is emitted. The existing
public website configuration UI continues to explain unavailable public links.

## Private and operational boundaries

Auth, workspace, registration, password/token, opaque booking/display and
scanner routes retain generic initial metadata, `noindex, nofollow`, and no
canonical. Clinic `book`/`display` query modes and any query key outside the
directory allowlist also use that private shell without performing a public
identity lookup. They still load their normal interactive application; HTML
rendering does not grant or bypass any API permission.

The renderer queries only active clinic/location names and address fields.
It does not read staff/session identity, patients, appointments, doctors,
contacts, QR references, tickets, queue state or notification configuration.
No directory response or user-controlled query text is serialized into HTML.
Public fields are HTML-escaped. Responses use `Cache-Control: no-store` and an
HTTP `X-Robots-Tag` matching the initial meta directive. The browser updates
existing tags and removes legacy duplicates during navigation, clearing public
identity and canonicals on errors or transitions to excluded routes.

Crawler directives are not authorization. Existing `robots.txt` is unchanged;
disallow rules can prevent crawlers from observing `noindex`. This work does
not approve crawler access, change API authorization, generate a sitemap,
guarantee rendering/indexing/ranking, or migrate domains and private tokens.

## Hosting

The production frontend is now a Node service, not a static SPA rewrite. The
Vite development hook, production frontend server and root-hosted API use the
same renderer. See [self-hosting](self-hosting.md) before a separately approved
release. Serving `dist/public/index.html` directly intentionally remains
non-indexable and does not satisfy this contract.

## Workspace checks

From the repository root:

```sh
pnpm run typecheck
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/clinicflow run build
pnpm --filter @workspace/api-server run test:public-metadata
```

The metadata suite requires the current frontend build. It starts a disposable
production HTML server with in-memory PostgreSQL-compatible storage and
fictional records, exercises the real SQL projection, and loads the built
application in Chromium with fictional read-only API responses. It checks raw
HTML, HEAD and GET status/headers, public/private route families, inactive and
cross-clinic locations, configured-origin failure, provider-independent 503
behavior, escaping, duplicate removal and SPA navigation isolation. Browser
evidence is limited to document-head fields; screenshots, traces and video are
disabled. This does not validate a deployed host or its proxy configuration.
