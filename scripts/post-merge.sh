#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push
node scripts/install-dev-deletion-guards.mjs --development
# Explicit development cutover and user-authorized publications in one transaction,
# not application startup. Receipts preserve subsequent administrator choices.
NODE_ENV=development node artifacts/api-server/src/appointment-template-registration.mjs --apply-workspace-development
