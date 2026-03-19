# DECISIONS

## Register

| # | Date | Decision | Context |
|---|---|---|---|
| D001 | 2026-03-15 | Self-host everything on single Hetzner VPS | User wants full control, no Vercel/Supabase dependency. Coolify is already on the server. |
| D002 | 2026-03-15 | Keep Coolify as deployment/management layer | Already installed, handles Docker, SSL via Caddy/Traefik, git deploys. No reason to replace it. |
| D003 | 2026-03-15 | PostgreSQL bare metal on same Hetzner server | Already running, `init.sql` exists, managed via Coolify or systemd. |
| D004 | 2026-03-15 | MinIO for object storage instead of Supabase Storage | Already configured in docker-compose, `api/_lib/storage.ts` uses S3 SDK. Drop Supabase dependency entirely. |
| D005 | 2026-03-15 | Keep existing Express server architecture | `server.ts` + `api/` handlers work well. No need for framework migration. |
| D006 | 2026-03-15 | Use docker-compose container with Traefik labels instead of Coolify managed deploy | Coolify managed container had incomplete build (8 routes vs 24). docker-compose build is correct and already running. Added Traefik labels to docker-compose for domain routing. |
| D007 | 2026-03-15 | UFW allow Docker subnets to PostgreSQL | `ufw allow from 10.0.0.0/8 to any port 5432` — Docker containers couldn't reach host PostgreSQL through firewall. |
| D008 | 2026-03-15 | GRANT ALL to `app` PostgreSQL user | `app` user had no table permissions. Granted all on tables, sequences, functions in public schema + default privileges for future tables. |
| D009 | 2026-03-20 | n8n Docker container for workflow orchestration | Generation pipeline'ı inline processGeneration'dan n8n-managed flow'a taşıma. Express callback pattern korunuyor — n8n API endpoint'leri çağırıyor, n8n UI'dan workflow edit/monitor. |
| D010 | 2026-03-20 | n8n admin UI on subdomain n8n.mooreateiler.com | Traefik labels ile SSL + subdomain routing. İç kullanım, admin-only. |
| D011 | 2026-03-20 | Docker internal networking for n8n ↔ app | n8n callback'leri `http://app:80/api/n8n/trigger`, Express webhook çağrıları `http://n8n:5678/webhook/generate-jewelry`. External webhook'lar nginx proxy üzerinden `mooreateiler.com/n8n-webhook/`. |
