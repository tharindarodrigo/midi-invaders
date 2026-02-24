#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <domain> <deploy-user> [app-dir]"
  exit 1
fi

DOMAIN="$1"
DEPLOY_USER="$2"
APP_DIR="${3:-/opt/midi-invaders}"

sudo apt update
sudo apt install -y curl git unzip ca-certificates

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pnpm@9.15.4

sudo apt install -y postgresql postgresql-contrib

sudo mkdir -p "${APP_DIR}"
sudo chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}"

sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
sudo apt update
sudo apt install -y caddy

sudo cp ops/systemd/midi-invaders-api.service /etc/systemd/system/midi-invaders-api.service
sudo sed -i "s|^User=.*|User=${DEPLOY_USER}|g" /etc/systemd/system/midi-invaders-api.service
sudo sed -i "s|^WorkingDirectory=.*|WorkingDirectory=${APP_DIR}|g" /etc/systemd/system/midi-invaders-api.service

sudo cp ops/caddy/Caddyfile /etc/caddy/Caddyfile
sudo sed -i "s|example.com|${DOMAIN}|g" /etc/caddy/Caddyfile
sudo sed -i "s|root \\* /opt/midi-invaders/apps/web/dist|root * ${APP_DIR}/apps/web/dist|g" /etc/caddy/Caddyfile

sudo mkdir -p /etc/midi-invaders
echo "Create /etc/midi-invaders/api.env with DATABASE_URL, PORT=3001, HOST=127.0.0.1"
echo "Optional: create /etc/midi-invaders/web.env with VITE_POSTHOG_KEY and VITE_POSTHOG_HOST for web analytics."

sudo systemctl daemon-reload
sudo systemctl enable caddy
sudo systemctl enable midi-invaders-api
sudo systemctl restart caddy
