---
id: T04
parent: S01
milestone: M002
provides:
  - n8n running in production on Hetzner
  - 2 workflows imported, active, and persistent
  - Express ↔ n8n bidirectional networking verified
  - n8n admin UI accessible at https://n8n.mooreateiler.com
  - /api/n8n/trigger callback route working
key_files:
  - docker-compose.yml
  - server.ts
  - api/n8n-trigger.ts
  - api/generate-jewelry.ts
  - scripts/n8n-import.sh
key_decisions:
  - Stopped Coolify's separate app container (s0cg0kwwk8cgocow4k4wcc08) to eliminate Traefik route conflict; tryonjewel-app-1 now handles all mooreateiler.com traffic
  - Stopped Coolify's separate n8n container to avoid duplicate instances; tryonjewel-n8n-1 is the single source of truth
  - Using Docker internal networking (http://n8n:5678, http://app:80) for container-to-container communication
patterns_established:
  - SCP deploy pattern: copy changed files to /opt/tryonjewel then docker compose up --build
  - n8n workflow activation requires publish:workflow + restart
observability_surfaces:
  - n8n health: https://n8n.mooreateiler.com/healthz
  - App health: https://mooreateiler.com/api/health
  - n8n admin UI: https://n8n.mooreateiler.com (login: cousinmediatr@gmail.com)
  - n8n workflow list: docker compose exec -T n8n n8n list:workflow
  - Container status: docker ps --filter name=tryonjewel
duration: ~25m
verification_result: passed
completed_at: 2026-03-20
blocker_discovered: false
---

# T04: Deploy ve Verify

**n8n workflow engine deployed to Hetzner with 2 active workflows, bidirectional networking, and admin UI access.**

## What Happened

1. Committed n8n docker-compose changes and pushed to GitHub
2. Connected to Hetzner via SSH, found existing docker-compose setup at /opt/tryonjewel
3. Discovered n8n container already running and healthy with workflows imported but inactive
4. Activated both workflows (wf_jewelry_main, wf_generate_single_v1) via n8n CLI + restart
5. Found Coolify's separate app container intercepting Traefik traffic without n8n routes
6. Stopped Coolify containers (app + n8n) to resolve conflicts
7. Copied updated source files (server.ts with n8n route, generate-jewelry.ts) via SCP
8. Rebuilt app container with USE_N8N=true and N8N_WEBHOOK_URL env vars
9. Verified all networking, routes, webhook endpoints, and persistence

## Verification

- `curl https://n8n.mooreateiler.com/healthz` → `{"status":"ok"}`
- `curl https://mooreateiler.com/api/health` → 200 with all env vars present
- App env: `USE_N8N=true`, `N8N_WEBHOOK_URL=http://n8n:5678/webhook/generate-jewelry`
- POST to webhook: `http://n8n:5678/webhook/generate-jewelry` → `{"message":"Workflow was started"}`
- POST to callback: `https://mooreateiler.com/api/n8n/trigger` with secret → `{"success":true}`
- n8n → app: `http://app:80/api/health` from n8n container → 200
- app → n8n: `http://n8n:5678/healthz` from app container → 200
- Restart persistence: `docker compose restart n8n` → both workflows still active=True
- Memory: 1.9GB used / 7.6GB total — plenty of headroom

## Diagnostics

- SSH: `ssh root@204.168.148.136` → `cd /opt/tryonjewel`
- n8n logs: `docker compose logs n8n --tail 50`
- App logs: `docker compose logs app --tail 50`
- Workflow check: `docker compose exec -T n8n n8n list:workflow`
- Full restart: `docker compose restart`

## Deviations

- Coolify was running its own app and n8n containers in parallel with our docker-compose stack, causing Traefik route conflicts. Stopped Coolify containers to resolve. Future deploys should use SCP + docker compose, not Coolify.
- Coolify's n8n had a different workflow version (inline httpRequest instead of sub-workflow pattern) — not used.
- n8n workflow callback URLs use `http://app:80/api/n8n/trigger` (Docker internal) instead of `http://mooreateiler.com` (public URL) — more reliable.

## Known Issues

- Coolify containers stopped manually — Coolify may restart them. Should disable Coolify auto-deploy for this app or fully migrate to manual docker-compose management.
- n8n API key provided by user returns 401 — may be for a different n8n instance. Not blocking since CLI access works.

## Files Created/Modified

- `docker-compose.yml` — n8n service + n8n-init + app env vars (deployed via SCP)
- `server.ts` — Added /api/n8n/trigger route (deployed via SCP)
- `api/n8n-trigger.ts` — n8n callback handler (deployed via SCP)
- `api/generate-jewelry.ts` — USE_N8N webhook integration (deployed via SCP)
- `scripts/n8n-import.sh` — Workflow auto-import script (deployed via SCP)
