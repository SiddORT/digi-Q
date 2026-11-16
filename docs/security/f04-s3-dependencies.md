# S3 adapter dependency review

## Selection

The official maintained modular AWS SDK v3 `@aws-sdk/client-s3` was selected
after inspecting its package metadata, current version, Node engine requirement
and declared dependencies with `pnpm view`. Version **3.1169.0** requires
Node >=20; this project uses Node 24. The installed API-only dependency range
is pinned to `3.1169.0`, with the exact graph captured in the workspace lockfile.
The package integrity is
`sha512-5IjQ2R1TM5lMuUvCvCfGNG9q6g3nxdputC9FY7YQJf1ygVUwsOruEYxQqpjik1nZdl8mNvV57Mhivtp2JbgBtg==`.

No AWS SDK v2, upload/multipart helper, presigner, browser dependency or
unofficial S3 client was added. Standard SDK command classes, HTTPS SigV4 and
Node's credential chain are used; credentials remain server-only. Existing
Google/Replit adapters and packages are retained. This uses the established
API build's SDK externalization rather than bundling credentials/configuration
into browser code.

The existing release-age gate, strict dependency/peer policy, build-script
allowlist, platform exclusions and security overrides were not relaxed.
The package graph added 25 installed packages; AWS/Smithy dependencies and
their exact resolutions are retained in the lockfile and audit inventory.

## Audit

After installation, both the workspace dependency scanner and a fresh
`pnpm audit --json` reported **0 known vulnerabilities** (critical, high,
moderate, low and informational). The registry audit covered 657 dependency
entries. This is an advisory-feed result, not proof that code is vulnerability
free, not a production penetration test, and not a live provider assessment.
The lockfile hash and exact package inventory are retained in
`f04-audit-after.json`. Reproduce with:

```
node scripts/dependency-audit-evidence.mjs after f04
pnpm --filter @workspace/api-server test:files:s3
```

Offline tests exercise SDK command construction and its actual signing/
serialization through an in-process HTTP handler. They check conditional
creation, checksum/header behavior, endpoint/addressing, private cache control,
safe errors, operation deadlines and stream limits. No network S3 request,
workspace credential resolution, IAM permission, TLS endpoint, encryption
policy, live checksum compatibility or provider lifecycle behavior was tested.
