---
name: Worker execution failures
description: Distinguishing a failed helper environment from a broken shared application
---

Avoid overlapping full builds, disposable PostgreSQL suites and multi-worker browser suites in this workspace when doing release verification.

**Why:** An overlapping run produced an esbuild `EAGAIN`, PostgreSQL connection resets and browser page-setup timeouts. The affected tests passed unchanged when rerun after heavy work finished, with one browser worker. This supports resource-pressure suspicion, not definitive attribution of every failure.

**How to apply:** Serialize these resource-heavy checks. If they fail this way, inspect the actual errors and retry only affected tests without competing work. Preserve the first-run failures and label focused-rerun evidence honestly; do not claim a clean full run.

A helper's `SERVER unexpectedly disconnected` error can be isolated to that helper even while parent tools and another helper remain healthy.

**Why:** During the initial ClinicFlow build, the frontend design helper could not read or write any files, including on retry, while the backend helper completed and parent shell access continued to work. Restarting or rolling back the shared application would not have addressed the observed failure.

**How to apply:** Check whether parent file access still works before treating this error as a project-wide outage. Preserve completed work and use a healthy implementation helper when the failing worker cannot recover. Do not assume a long-running worker has written files merely because its job is still active.

A browser job that remains active without new app requests may be stalled; its active status is not evidence of continuing acceptance work.

**Why:** Repeated long waits returned no report while the app remained healthy and the test had stopped generating application requests. Test-created development records survived the stopped job.

**How to apply:** Check observable progress rather than repeatedly waiting on the same timeout. Stop a stalled run, retain previously verified results, and perform ownership-checked fixture cleanup before closing the work. Never promote partial request logs to an acceptance pass.