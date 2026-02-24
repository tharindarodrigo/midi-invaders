# Deployment Guide (VM + SSL + CI/CD)

This project can run on one VM with:
- `Caddy` for HTTPS + static web hosting + reverse proxy
- `systemd` for API process management
- GitHub Actions for automated deploys over SSH

## 1) DNS

Point your domain to the VM public IP:
- `A` record: `@ -> <your-vm-ip>`
- Optional `A` record: `www -> <your-vm-ip>`

Wait for DNS propagation before expecting SSL certificates.

## 2) VM one-time setup

From your VM, inside repo root, run:

```bash
chmod +x ops/scripts/bootstrap-vm.sh
./ops/scripts/bootstrap-vm.sh your-domain.com deploy
```

If your app directory is not `/opt/midi-invaders`, pass it as the 3rd argument:

```bash
./ops/scripts/bootstrap-vm.sh your-domain.com deploy /home/tharinda/midi-invaders
```

Then create API env file:

```bash
sudo tee /etc/midi-invaders/api.env >/dev/null <<'EOF'
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/midi_invaders
PORT=3001
HOST=127.0.0.1
EOF
```

Optional: create web env file for analytics-enabled frontend builds:

```bash
sudo tee /etc/midi-invaders/web.env >/dev/null <<'EOF'
VITE_POSTHOG_KEY=phc_your_key_here
VITE_POSTHOG_HOST=https://us.i.posthog.com
EOF
```

Create DB:

```bash
sudo -u postgres psql -c "CREATE DATABASE midi_invaders;"
```

## 3) Configure Caddy + systemd

The templates are:
- `ops/caddy/Caddyfile`
- `ops/systemd/midi-invaders-api.service`

They are installed by `bootstrap-vm.sh`. After first deployment run:

```bash
sudo systemctl daemon-reload
sudo systemctl restart midi-invaders-api
sudo systemctl restart caddy
```

Caddy will automatically issue and renew TLS certificates.

## 4) GitHub Actions CI/CD setup

Workflow file:
- `.github/workflows/deploy.yml`

Add repository secrets:
- `DEPLOY_HOST`: VM public IP or hostname
- `DEPLOY_USER`: SSH user on VM (example: `deploy`)
- `DEPLOY_SSH_KEY`: private key content used by GitHub Actions (recommended)
- `DEPLOY_PASSWORD`: SSH password (optional fallback if no key is configured)
- `DEPLOY_PATH`: deploy directory on VM (example: `/opt/midi-invaders`)
- `VITE_POSTHOG_KEY` (optional): PostHog project API key for production web builds
- `VITE_POSTHOG_HOST` (optional): PostHog host for production web builds (default `https://us.i.posthog.com`)

Notes:
- Configure at least one authentication secret: `DEPLOY_SSH_KEY` or `DEPLOY_PASSWORD`.
- If your deploy fails with `can't connect without a private SSH key or password`, the workflow now reports which secret is missing in the `Validate deploy secrets` step.

The workflow does:
1. Lint + test + build.
2. Copy repository to VM over SSH.
3. Install dependencies and build on VM.
4. Run Prisma migrations.
5. Restart API and reload Caddy.

## 4.1) Manual deploy after SSH + git pull

If you want to deploy manually from the server:

```bash
ssh deploy@your-server
cd <deploy-path>
git pull --ff-only
./ops/scripts/manual-deploy-after-pull.sh
```

Example:

```bash
ssh tharinda@your-server
cd /home/tharinda/midi-invaders
git pull --ff-only
./ops/scripts/manual-deploy-after-pull.sh
```

The script performs:
1. `pnpm install --frozen-lockfile`
2. `pnpm -r build`
3. `pnpm -C apps/api exec prisma migrate deploy`
4. `sudo systemctl restart midi-invaders-api`
5. `sudo systemctl reload caddy`

It loads API env from `/etc/midi-invaders/api.env` (preferred), or falls back to `apps/api/.env` if present.
It also loads web env from `/etc/midi-invaders/web.env` (preferred), or falls back to `apps/web/.env` if present.
It also warns if `midi-invaders-api` or Caddy are still configured to serve from a different directory.

## 5) Health checks

After deploy:

```bash
curl -I https://your-domain.com
curl https://your-domain.com/health
curl https://your-domain.com/api/leaderboards
```

## 6) Operational commands

```bash
sudo systemctl status midi-invaders-api
sudo systemctl status caddy
sudo journalctl -u midi-invaders-api -n 200 --no-pager
sudo journalctl -u caddy -n 200 --no-pager
```
