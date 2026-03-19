---
id: S01
parent: M002
milestone: M002
provides:
  - n8n Docker container running on Hetzner (tryonjewel-n8n-1)
  - 2 workflows imported and active (orchestrator + generate-single)
  - n8n admin UI at https://n8n.mooreateiler.com
  - Bidirectional Docker networking (app ↔ n8n)
  - /api/n8n/trigger callback endpoint operational
  - USE_N8N=true configured in app container
  - Volume persistence verified across restarts
requires: []
affects:
  - S02
key_files:
  - docker-compose.yml
  - server.ts
  - api/n8n-trigger.ts
  - api/generate-jewelry.ts
  - scripts/n8n-import.sh
  - n8n-workflows/workflow-a-orchestrator.json
  - n8n-workflows/workflow-b-generate-single.json
key_decisions:
  - Stopped Coolify containers to resolve Traefik conflicts; using manual docker-compose deploy
  - Using Docker internal networking for container-to-container communication
  - Workflow activation requires CLI publish + container restart
patterns_established:
  - Deploy via SCP + docker compose up --build
  - n8n workflow management via CLI (list, export, import, publish)
observability_surfaces:
  - n8n health: https://n8n.mooreateiler.com/healthz
  - App health: https://mooreateiler.com/api/health
  - n8n admin UI: https://n8n.mooreateiler.com
  - Container logs: docker compose logs n8n/app
drill_down_paths:
  - .gsd/milestones/M002/slices/S01/tasks/T04-SUMMARY.md
duration: ~2h (across multiple sessions)
verification_result: passed
completed_at: 2026-03-20
---

# S01: n8n Docker Setup + Workflow Import

**n8n workflow engine deployed on Hetzner with 2 active workflows, admin UI, bidirectional networking, and persistent storage.**

## What Happened

1. **T01** — Added n8n service to docker-compose.yml with volume persistence, Traefik labels, health check, and networking configuration
2. **T02** — Created n8n-init container with import script for automatic workflow import via n8n CLI
3. **T03** — Configured networking: app → n8n webhook URL, n8n → app callback URL, USE_N8N=true, secret sharing
4. **T04** — Deployed to Hetzner: pushed code, SCP'd files, rebuilt containers, activated workflows, resolved Coolify container conflicts, verified everything end-to-end

Key challenge was discovering Coolify running parallel app and n8n containers with conflicting Traefik routes. Resolved by stopping Coolify containers and using our docker-compose stack directly.

## Verification

- n8n healthz: 200 OK via https://n8n.mooreateiler.com/healthz
- App health: 200 OK via https://mooreateiler.com/api/health
- Webhook: POST to http://n8n:5678/webhook/generate-jewelry → "Workflow was started"
- Callback: POST to /api/n8n/trigger with secret → {"success": true}
- Bidirectional: n8n → app (http://app:80) and app → n8n (http://n8n:5678) both work
- Persistence: Workflows survive docker compose restart
- Memory: 1.9GB/7.6GB — healthy headroom

## Deviations

- Coolify containers (app + n8n) were running in parallel, causing route conflicts. Had to stop them manually. Future deploys use SCP + docker compose only.
- Coolify n8n had a different workflow version (inline httpRequest vs sub-workflow pattern) — used our version instead.

## Known Limitations

- Coolify may auto-restart its containers, re-creating the conflict. Should disable Coolify auto-deploy for this project.
- n8n API key (JWT) returns 401 — may be for an old instance. Not blocking since CLI access works fine.
- Workflows haven't been tested with real image generation yet — that's S02's scope.

## Follow-ups

- Disable Coolify auto-deploy for tryonjewel to prevent container conflicts
- Consider adding n8n to Coolify's ignore list or fully migrating to manual compose management
- S02: End-to-end integration test with real image generation

## Files Created/Modified

- `docker-compose.yml` — n8n service, n8n-init, app env vars for n8n integration
- `server.ts` — Added /api/n8n/trigger route
- `api/n8n-trigger.ts` — n8n callback handler (update-job, download-images, analyze, generate, etc.)
- `api/generate-jewelry.ts` — USE_N8N webhook mode with inline fallback
- `scripts/n8n-import.sh` — Auto-import workflow JSONs on container init
- `n8n-workflows/workflow-a-orchestrator.json` — Main orchestration workflow
- `n8n-workflows/workflow-b-generate-single.json` — Sub-workflow for single image generation

## Forward Intelligence

### What the next slice should know
- App container uses `N8N_WEBHOOK_URL=http://n8n:5678/webhook/generate-jewelry` — Docker internal URL
- n8n workflows call back to `http://app:80/api/n8n/trigger` — also Docker internal
- The orchestrator workflow uses httpRequest nodes for each step, not n8n's executeWorkflow — it calls back to Express for actual Gemini generation
- n8n admin UI login: cousinmediatr@gmail.com

### What's fragile
- Coolify auto-restart — if Coolify restarts its containers, Traefik routes will conflict again
- n8n workflow activation state — if someone imports workflows again without publish+restart, they'll be inactive

### Authoritative diagnostics
- `docker compose exec -T n8n n8n list:workflow` — ground truth for workflow state
- `docker compose exec -T app printenv | grep N8N` — verify app has correct env vars
- `docker ps --filter name=tryonjewel` — confirm only our containers are running

### What assumptions changed
- Assumed single deploy path via docker-compose — actually Coolify was running a parallel stack
- Assumed n8n API key would work — it's for a different instance, CLI is the reliable management interface
