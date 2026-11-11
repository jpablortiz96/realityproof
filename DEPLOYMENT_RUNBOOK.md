# Deployment runbook

There are two supported ways to run RealityProof. Option B was deployed on 2026-11-09 as a private preview. Creating Lightsail resources costs money and needs the owner's approval.

## Before any public deployment

Stop unless all three are true:

1. **AG Studio permission is confirmed in writing** (status today: `LICENSE_PENDING`). Without it, use Option A, or Option B as a private preview (step 6). Do not hide the watermark.
2. `PUBLIC_DEMO_MODE=true`, which the `demo` service sets for you. Never publish the `full` service.
3. A Gemini key, if used for the demo, has a budget you accept. The `DEMO_GEMINI_API_KEY` variable is optional. Without it the agent uses the labeled deterministic planner.

## Option A: local (free, no account needed)

Requires Docker Desktop or Docker Engine.

```bash
git clone <repository-url> realityproof
cd realityproof
docker compose up --build
```

Open <http://localhost:8080>. This is the read-only demo with synthetic data and one historical PayPal Sandbox record. It needs no keys.

### Full local workflow

Create and fund a synthetic request, upload fixtures, analyze, review and issue a passport:

```bash
cp .env.example .env      # add GEMINI_API_KEY to enable analysis; PayPal keys are optional
docker compose --profile full up --build full
```

Open <http://localhost:8081>. It uses the published development tokens, binds to localhost only, and keeps its data in the `realityproof_realityproof_data` volume.

### Without Docker

Requires Node.js 20 or newer and pnpm 9 or newer.

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm dev
```

Open <http://localhost:5173>. The API runs on port 4000.

## Option B: AWS Lightsail (paid, needs approval)

### Recommended plan

| Item | Choice | Price checked 2026-11-05 |
|---|---|---|
| Instance | Linux, 2 GB RAM, 2 vCPUs, 60 GB SSD, 3 TB transfer, public IPv4 | US$12/month |
| Region | N. Virginia (`us-east-1`) or Ohio (`us-east-2`) | Full transfer allowance |
| Static IP | One, attached to the instance | Included |
| Snapshots | Automatic daily, last 7 kept | US$0.05 per GB-month, charged on used data |

Measured on 2026-11-06: the running demo uses about 45 MB of RAM, so 2 GB is ample to run it. Building is what needs memory. With 1.6 GB of RAM the image build failed without swap, and finished in about 2 minutes with 2 GB of swap. The swap step below is therefore required on this plan, unless you build the image elsewhere (see step 6). The 1 GB plan is not recommended.

### Estimated total

| Period | Instance | Snapshots (about 5 GB) | Total |
|---|---|---|---|
| Nov 8 to Dec 15, 2026 (about 38 days) | about US$15 | about US$0.50 | **about US$16** |
| If kept for a full 2 months | US$24 | US$0.50 | **about US$25** |

The estimate leaves out a domain name (optional, see below), transfer overage (US$0.09/GB beyond 3 TB, not expected) and Gemini usage. Check [Lightsail pricing](https://aws.amazon.com/lightsail/pricing/) on the day, because AWS Free Tier terms may reduce this and were not confirmed. Set an AWS Budgets alert at US$20.

### Provisioning steps (run only after approval)

These are the steps used for the 2026-11-09 deployment. Lightsail's Ubuntu and Debian images are listed through AWS Marketplace, so Amazon Linux 2023 is used instead.

1. Create the instance with automatic daily snapshots, then allocate, tag and attach a static IP:
   ```bash
   aws lightsail create-instances --region us-east-1 --instance-names realityproof-demo \
     --availability-zone us-east-1a --blueprint-id amazon_linux_2023 --bundle-id small_3_0 \
     --tags key=Project,value=realityproof key=DeleteAfter,value=2026-12-16 \
     --add-ons 'addOnType=AutoSnapshot,autoSnapshotAddOnRequest={snapshotTimeOfDay=08:00}'
   aws lightsail allocate-static-ip --region us-east-1 --static-ip-name realityproof-ip
   aws lightsail attach-static-ip --region us-east-1 --static-ip-name realityproof-ip --instance-name realityproof-demo
   ```
2. Firewall: allow 22 from your IP only, and 80 and 443 from anywhere. Do not open 4000, 8080 or 8081.
3. Copy the repository to the instance and install Docker, the Compose and Buildx plugins and a 2 GB swap file (required on the 2 GB plan):
   ```bash
   sudo sh deploy/lightsail-setup-al2023.sh
   ```
4. Choose a hostname. With your own domain, point an `A` record at the static IP. Without one, `<ip-with-dashes>.sslip.io` resolves to the IP; it shares Let's Encrypt limits with other users.
5. Clone the repository and create `.env` on the server. It must not contain PayPal credentials:
   ```bash
   SITE_ADDRESS=demo.example.com
   WEB_ORIGIN=https://demo.example.com
   TRUST_PROXY=true
   DEMO_AUTH_TOKEN_SECRET=<output of: openssl rand -hex 32>
   # Optional:
   # DEMO_GEMINI_API_KEY=
   # STUDIO_AGENT_DAILY_TURN_LIMIT=300
   # VITE_AG_STUDIO_LICENSE_KEY=     only with written permission
   ```
6. Start it. While the AG Studio licence for public use is pending, keep the whole site private by adding `PREVIEW_TOKEN=<output of: openssl rand -hex 24>` to `.env` and starting with the private preview file. Share `https://<host>/__preview/<PREVIEW_TOKEN>` only with invited reviewers: it sets a cookie, and without it every path returns 403.
   ```bash
   # Private preview (current):
   sudo docker compose -f docker-compose.yml -f deploy/compose.private-preview.yml --profile https up -d --build
   # Public, only once the licence allows it:
   sudo docker compose --profile https up -d --build
   ```
   HTTP basic auth can't be used for this, because the app sends its role tokens in the `Authorization` header.

   **Current mode (since 2026-11-11): public edition for everyone, full edition for judges.** AG Grid provides the AG Studio licence for PayPal AI Hackathon judging, which doesn't clearly cover an open public demo. So:
   - `demo-public` is built with `REALITYPROOF_WEB_EDITION=public`: the web bundle contains no AG Studio, AG Grid or AG Charts code, and the container has no Gemini key. Anyone can open the site.
   - `demo` (full edition, AG Studio and the Gemini agent with daily limits) is served only to browsers holding the judges' cookie from `https://<host>/__preview/<PREVIEW_TOKEN>`.
   ```bash
   sudo docker compose -f docker-compose.yml -f deploy/compose.public-and-judges.yml --profile https build demo-public
   sudo docker compose -f docker-compose.yml -f deploy/compose.public-and-judges.yml --profile https up -d
   ```
   Roll back to the private preview with `sudo docker compose -f docker-compose.yml -f deploy/compose.private-preview.yml --profile https up -d` and then `sudo docker rm -f realityproof-demo-public-1`. The server also keeps `realityproof:rollback-20261111` (the full image before this change) and `~/backups/config-before-public-*.tar.gz`.
   To avoid building on the server: run `docker compose build demo` on your own machine, then `docker save realityproof:local | gzip > rp.tar.gz`, copy the file to the instance, load it with `gunzip -c rp.tar.gz | docker load`, and start with `docker compose --profile https up -d` (without `--build`).
7. Check it from another network, in a private window:
   ```bash
   curl -fsS https://demo.example.com/ready
   curl -s -o /dev/null -w "%{http_code}\n" -X POST -H 'Content-Type: application/json' -d '{}' \
     https://demo.example.com/api/v1/verification-requests/task_live_sbx_1793222660264/funding/create-order
   ```
   The first must report `"public_demo_mode":true`. The second must print `403`.

The demo's state is in memory, so restarting it returns to the seeded data. That is the intended way to reset it.

### Backups and recovery

The public demo keeps its state in memory, so there is no application data to back up. The automatic daily snapshots (last 7 kept) cover the system, Docker, the configuration and the HTTPS certificate. To recover:

1. Lightsail console → Instances → `realityproof-demo` → Snapshots → Automatic snapshots → pick a date → **Create new instance**, same plan, `us-east-1`.
2. Detach the static IP from the broken instance and attach it to the new one. The hostname and certificate keep working because the IP doesn't change.
3. Check `/ready` through the invite link, then delete the broken instance.

### Shutting down

After judging ends (planned for 2026-12-15):

```bash
aws lightsail delete-instance --region us-east-1 --instance-name realityproof-demo
aws lightsail release-static-ip --region us-east-1 --static-ip-name realityproof-ip
aws lightsail get-auto-snapshots --region us-east-1 --resource-name realityproof-demo   # must be empty
aws lightsail get-instance-snapshots --region us-east-1                                  # must be empty
aws budgets delete-budget --account-id <account-id> --budget-name RealityProof-Monthly
aws budgets delete-budget --account-id <account-id> --budget-name RealityProof-AccountNet
```

A static IP that isn't attached is billed, so release it in the same session. If automatic snapshots remain, delete them in the console: the deploy user is not allowed to. Then remove the `realityproof-deploy` IAM user and its policy, and check the billing page the next day.

## Operations

| Task | Command |
|---|---|
| Status | `docker compose ps` |
| Health | `curl -fsS http://localhost:8080/ready` |
| Logs | `docker compose logs --tail=200 demo` |
| Update | `git pull && docker compose --profile https up -d --build` |
| Reset the demo | `docker compose restart demo` |

Request logs record the method and the path only: no bodies, headers or query strings, so signed passport links stay out of them.

## Backup and restore (full workflow only)

The public demo holds nothing to back up. In the `full` service, state and evidence live in one volume.

```bash
# Back up: writes and verifies backups/realityproof-<timestamp>.tar.gz, keeps the newest 14
sh scripts/backup.sh

# Restore: the service must be stopped first
docker compose --profile full stop full
sh scripts/restore.sh backups/realityproof-<timestamp>.tar.gz
docker compose --profile full start full
```

The archives contain evidence images and audit data, so store them privately. `backups/` is ignored by Git.

**`docker compose down -v` deletes the volume.** Back up first, or use plain `down`.

If the state file can't be read at startup, the API moves it aside as `realityproof-state.json.corrupt-<timestamp>`, logs an error and starts from the seed. Stop the service and restore from a backup.

## Limits

| Control | Value | Setting |
|---|---|---|
| General rate limit | 120 requests/minute per client | In code |
| Agent endpoint | 30 requests/minute per client | In code |
| Analysis endpoint | 10 requests/minute per client | In code |
| Gemini agent turns | 500 per day, 300 in Compose demo | `STUDIO_AGENT_DAILY_TURN_LIMIT` |
| Gemini analyses | 100 per day | `GEMINI_ANALYSIS_DAILY_LIMIT` |
| Upload size | 5 MB | `MAX_UPLOAD_BYTES` |

Budgets are per process and reset at 00:00 UTC or on restart. They bound usage on our side; set a limit with Google as well. `TRUST_PROXY=true` is only safe behind Caddy, because otherwise clients could forge their address to escape rate limits.
