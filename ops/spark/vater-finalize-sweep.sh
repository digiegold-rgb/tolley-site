#!/usr/bin/env bash
set -euo pipefail
# Use an explicit immutable release checkout after validation. Do not switch the
# existing dirty tolley-site checkout underneath running workers.
task_site="${TOLLEY_WORKER_SITE:-/home/jelly/tolley-revenue-repair}"
cd "$task_site"
# Load dotenv with Node, never evaluate secret contents as shell code.
exec node --env-file=/home/jelly/tolley-site/.env.local --conditions=react-server \
  --import /home/jelly/.npm-global/lib/node_modules/tsx/dist/loader.mjs \
  scripts/sweep-orphaned-animate-batches.ts "$@"
