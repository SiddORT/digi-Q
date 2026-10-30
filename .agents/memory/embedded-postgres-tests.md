---
name: Embedded PostgreSQL test dependencies
description: Workspace dependency placement for PGlite and Drizzle type compatibility
---

Keep the embedded PostgreSQL test dependency at the workspace root rather than adding a separate API-package peer variant.

**Why:** Installing PGlite only in the API package caused duplicate Drizzle peer instances and incompatible types during the listing-query regression work. Root placement resolved the mismatch.

**How to apply:** When changing embedded database test dependencies, check the pnpm peer graph and typecheck database consumers before attributing type errors to query code. Keep fixtures isolated from development and production records.

Avoid HTTP keep-alive assumptions across synchronous embedded-database bulk setup.

**Why:** Large PGlite fixture inserts can block the same event loop that services
the disposable HTTP server and its idle-socket timers. A subsequent request may
reuse a socket while the server is closing it, producing ECONNRESET despite valid
SQL and passing smaller datasets.

**How to apply:** Keep connection reuse disabled in the disposable feature
harness; distinguish transport resets after fixture setup from query failures.
Do not apply this test-only transport policy to the production server.

Pass the active transaction connection through nested settings/readiness lookups.

**Why:** Adding a global-connection credential lookup inside a booking transaction stalled the PGlite regressions: the lookup waited outside the transaction that was itself waiting for the lookup. Isolated provider tests did not expose this.

**How to apply:** Helpers called within transactions must accept and reuse the caller's connection. Also extend isolated module doubles when a shared helper gains a database dependency; do not let a unit test accidentally resolve the real database module.

Run the full backend suite serially when it includes disposable native PostgreSQL clusters.

**Why:** Parallel cluster initialization on this container exceeded the harness's initdb timeout, producing environment failures unrelated to the feature under test.

**How to apply:** Use Node's `--test-concurrency=1` for the combined backend suite; keep focused pure-unit runs separate.

Register shared Node test cleanup hooks at file or suite scope, not inside a setup hook.

**Why:** A cleanup hook registered inside a before hook can belong to that hook's context and close the disposable server before the first test request.

**How to apply:** Register teardown alongside setup, guard partially initialized resources, and keep setup-failure cleanup in the harness.

Database replacement requires fresh imported harness modules, not only fresh database objects.

**Why:** Node caches imported ESM modules by URL. Reusing a generated bundle URL retained bindings to a closed earlier fixture even after a replacement database was created.

**How to apply:** Give each independently initialized harness a distinct module identity; do not assume regenerating the same file resets its imports.

Distinguish native Node/Wasm crashes from relational assertion failures.

**Why:** Node 24.13 occasionally aborted during PGlite teardown with a V8 JIT allocation assertion while compilation and test processes ran together. The affected relational assertions passed when run alone.

**How to apply:** Inspect the native stack, rerun only the affected file without parallel builds, and report the interrupted combined run accurately. Do not weaken relational assertions to hide an engine crash.

Independent child test runners must not inherit the parent's Node test context.

**Why:** Node's test runner treats an inherited test context as recursive invocation
and can skip child files while returning success, hiding the assertions that a
matrix gate intended to run.

**How to apply:** Strip the parent test context when spawning an independent
`node --test` process; contract-test that each required child actually executes.