---
name: Media storage choice
description: User-approved logo options and single-file server configuration.
---

Support both logo file uploads and HTTPS image links. Keep the choice between
local-folder and object storage in the same private server settings file.

**Why:** The user explicitly requested configurable folder-based storage as an
alternative to object storage and approved implementation before publishing.

**How to apply:** Do not make uploads dependent only on Replit infrastructure.
Keep Replit Autoscale on durable object storage; local mode is for independently
hosted servers with persistent disk. Changing the default is not authorization
to migrate or delete existing uploads.

For object-storage readiness, test object read/create permissions rather than bucket-administration metadata access.

**Why:** Replit-managed credentials denied bucket metadata with HTTP 403 while explicitly granting both object read and create. Treating bucket metadata as the upload capability produced a false failure.

**How to apply:** Keep permission probes read-only and distinguish permission grants from a completed browser upload. Never broaden storage privileges just to make an administrative metadata probe pass.

When pinning historical S3 storage authority, exclude the SDK's ambient endpoint
overrides as well as validating the app's own endpoint setting.

**Why:** AWS SDK v3 can consume global/service endpoint URLs from environment or
shared profiles when no explicit endpoint is supplied. Hashing only the app's
configured authority would not prevent those sources from redirecting a
historical bucket/key to another provider.

**How to apply:** Keep SDK-configured endpoint overrides disabled for this
adapter, and exercise the actual signing/HTTP pipeline offline rather than
relying exclusively on command doubles. Endpoint changes are not authorization
to migrate files.