#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEFAULT_API_ENV_FILE="/etc/midi-invaders/api.env"
FALLBACK_API_ENV_FILE="${REPO_ROOT}/apps/api/.env"
API_ENV_FILE="${API_ENV_FILE:-${DEFAULT_API_ENV_FILE}}"
DEFAULT_WEB_ENV_FILE="/etc/midi-invaders/web.env"
FALLBACK_WEB_ENV_FILE="${REPO_ROOT}/apps/web/.env"
WEB_ENV_FILE="${WEB_ENV_FILE:-${DEFAULT_WEB_ENV_FILE}}"

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

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files midi-invaders-api.service >/dev/null 2>&1; then
  SERVICE_WORKDIR="$(systemctl show -p WorkingDirectory --value midi-invaders-api 2>/dev/null || true)"
  if [[ -n "${SERVICE_WORKDIR}" && "${SERVICE_WORKDIR}" != "${REPO_ROOT}" ]]; then
    echo "[manual-deploy] Warning: midi-invaders-api service WorkingDirectory is ${SERVICE_WORKDIR}"
    echo "[manual-deploy] Warning: current deploy directory is ${REPO_ROOT}"
    echo "[manual-deploy] Warning: service may still run old code until WorkingDirectory is updated."
  fi
fi

if [[ -f /etc/caddy/Caddyfile ]]; then
  EXPECTED_WEB_ROOT="root * ${REPO_ROOT}/apps/web/dist"
  if ! grep -Fq "${EXPECTED_WEB_ROOT}" /etc/caddy/Caddyfile; then
    echo "[manual-deploy] Warning: /etc/caddy/Caddyfile does not contain: ${EXPECTED_WEB_ROOT}"
    echo "[manual-deploy] Warning: Caddy may still be serving frontend from another directory."
  fi
fi

if [[ -f "${API_ENV_FILE}" ]]; then
  echo "[manual-deploy] Loading API environment from ${API_ENV_FILE}"
  set -a
  # shellcheck disable=SC1090
  source "${API_ENV_FILE}"
  set +a
elif [[ -f "${FALLBACK_API_ENV_FILE}" ]]; then
  echo "[manual-deploy] Warning: ${API_ENV_FILE} not found. Falling back to ${FALLBACK_API_ENV_FILE}"
  set -a
  # shellcheck disable=SC1090
  source "${FALLBACK_API_ENV_FILE}"
  set +a
else
  echo "[manual-deploy] Error: no API env file found."
  echo "[manual-deploy] Expected ${API_ENV_FILE} (preferred) or ${FALLBACK_API_ENV_FILE}."
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[manual-deploy] Error: DATABASE_URL is not set after loading API env."
  exit 1
fi

if [[ -f "${WEB_ENV_FILE}" ]]; then
  echo "[manual-deploy] Loading web environment from ${WEB_ENV_FILE}"
  set -a
  # shellcheck disable=SC1090
  source "${WEB_ENV_FILE}"
  set +a
elif [[ -f "${FALLBACK_WEB_ENV_FILE}" ]]; then
  echo "[manual-deploy] Warning: ${WEB_ENV_FILE} not found. Falling back to ${FALLBACK_WEB_ENV_FILE}"
  set -a
  # shellcheck disable=SC1090
  source "${FALLBACK_WEB_ENV_FILE}"
  set +a
else
  echo "[manual-deploy] Web env not found. Continuing without frontend VITE_* overrides."
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
