#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push
node scripts/install-dev-deletion-guards.mjs --development
