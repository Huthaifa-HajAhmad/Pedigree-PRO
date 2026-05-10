#!/usr/bin/env bash
# Regenerate pnpm lockfile without frozen lockfile
set -e
cd "$(dirname "$0")/.."
pnpm install --no-frozen-lockfile
echo "Done"
