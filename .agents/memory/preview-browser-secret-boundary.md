---
name: Preview browser secret boundary
description: Secure verification when the delegated browser process cannot access workspace recovery secrets
---

A delegated browser process may not receive a workspace recovery secret even when the main workspace process has it. Report that attempt as blocked, not as rejected credentials.

**Why:** Preview recovery verification encountered different secret availability between the delegated browser and workspace processes; the workspace browser subsequently authenticated through the actual Preview successfully.

**How to apply:** Keep passwords in process environment only. If needed, run the existing Playwright browser from the workspace against the actual development HTTPS Preview, with tracing and sensitive logging disabled. Fill directly from the environment, confirm the intended identity using browser-origin requests, then log out and remove only the exact agent-created session. Never transfer the password through tool output, chat, scratch files, or an authentication bypass.
