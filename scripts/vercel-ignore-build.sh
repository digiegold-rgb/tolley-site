#!/usr/bin/env bash
# Vercel ignoreCommand: exit 0 skips the build, exit 1 builds.
# main always builds. Any other branch skips unless the commit message
# contains the literal tag [preview].
if [ -n "$VERCEL_GIT_COMMIT_REF" ] && [ "$VERCEL_GIT_COMMIT_REF" != "main" ]; then
  case "$VERCEL_GIT_COMMIT_MESSAGE" in
    *'[preview]'*) exit 1 ;;
  esac
  echo 'skip: branch preview builds disabled (2026-08-20 — stray branch builds were stalling and blocking the single build slot)'
  exit 0
else
  exit 1
fi
