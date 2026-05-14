#!/usr/bin/env bash
#
# Cloud Hermes — start script.
#
# Installs dependencies if needed, runs the environment preflight, and starts
# the development servers.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Cloud Hermes"
echo

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
  echo
fi

# The preflight gates on Node and a reasoning harness; a non-zero exit here is
# a genuine blocker, so let it stop the script.
npx tsx scripts/doctor.ts

echo "Starting Cloud Hermes..."
npm run dev
