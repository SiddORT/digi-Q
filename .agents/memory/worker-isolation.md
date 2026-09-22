---
name: Worker execution failures
description: Distinguishing a failed helper environment from a broken shared application
---

A helper's `SERVER unexpectedly disconnected` error can be isolated to that helper even while parent tools and another helper remain healthy.

**Why:** During the initial ClinicFlow build, the frontend design helper could not read or write any files, including on retry, while the backend helper completed and parent shell access continued to work. Restarting or rolling back the shared application would not have addressed the observed failure.

**How to apply:** Check whether parent file access still works before treating this error as a project-wide outage. Preserve completed work and use a healthy implementation helper when the failing worker cannot recover. Do not assume a long-running worker has written files merely because its job is still active.