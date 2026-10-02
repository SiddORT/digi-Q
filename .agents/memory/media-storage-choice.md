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