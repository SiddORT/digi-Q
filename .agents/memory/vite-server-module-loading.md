---
name: Vite server module loading
description: Native Node TypeScript loading is not equivalent to Vite workspace module resolution.
---

Load linked workspace TypeScript through Vite's server module runner during
development, or bundle it for the production Node process.

**Why:** Node's native TypeScript support strips types but does not resolve
bundler-style extensionless directory imports. A native dynamic import can
reach a linked package successfully and then fail on one of its dependencies
with `ERR_UNSUPPORTED_DIR_IMPORT`; this is a loader mismatch, not a database
connection failure.

**How to apply:** When adding server-side functionality to a Vite app, keep
server dependencies out of client entrypoints and preserve the appropriate
server module boundary. Verify both development startup and bundled production
execution; a successful client build alone cannot detect this mismatch.
