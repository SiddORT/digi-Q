#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push
node scripts/install-dev-deletion-guards.mjs --development
# Explicit development cutover, not application startup. Its durable receipt makes
# subsequent merges non-mutating, preserving administrator choices after activation.
NODE_ENV=development node artifacts/api-server/src/appointment-notification-activation.mjs --apply-workspace-development
