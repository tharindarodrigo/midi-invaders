#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${REPO_ROOT}"

echo "[manual-deploy] Repository root: ${REPO_ROOT}"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[manual-deploy] Error: pnpm is not installed or not on PATH."
  exit 1
fi

if ! command -v sudo >/dev/null 2>&1; then
  echo "[manual-deploy] Error: sudo is required to restart system services."
  exit 1
fi

echo "[manual-deploy] Installing dependencies..."
pnpm install --frozen-lockfile

echo "[manual-deploy] Building workspaces..."
pnpm -r build

echo "[manual-deploy] Running Prisma migrations..."
pnpm -C apps/api exec prisma migrate deploy

echo "[manual-deploy] Restarting API service..."
sudo systemctl restart midi-invaders-api

echo "[manual-deploy] Reloading Caddy..."
sudo systemctl reload caddy

echo "[manual-deploy] Done."
