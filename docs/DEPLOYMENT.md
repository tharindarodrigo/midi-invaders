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

Then create API env file:

```bash
sudo tee /etc/midi-invaders/api.env >/dev/null <<'EOF'
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/midi_invaders
PORT=3001
HOST=127.0.0.1
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
- `DEPLOY_SSH_KEY`: private key content used by GitHub Actions
- `DEPLOY_PATH`: deploy directory on VM (example: `/opt/midi-invaders`)

The workflow does:
1. Lint + test + build.
2. Copy repository to VM over SSH.
3. Install dependencies and build on VM.
4. Run Prisma migrations.
5. Restart API and reload Caddy.

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
