# S01: n8n Docker Setup + Workflow Import

**Goal:** n8n container'ı docker-compose'a ekleyip Hetzner'da çalıştırmak, mevcut workflow JSON'larını import etmek, admin UI erişilebilir kılmak.
**Demo:** n8n admin paneline erişilebilir, 2 workflow import edilmiş ve aktif, health check geçiyor, Express ↔ n8n networking çalışıyor.

## Must-Haves

- docker-compose.yml'de n8n service (volume persist, networking)
- Workflow'ların otomatik import mekanizması
- n8n admin UI erişimi (Traefik veya port)
- Express API → n8n webhook URL doğru configure
- n8n → Express API callback URL doğru configure
- `USE_N8N=true` env variable set

## Proof Level

- This slice proves: operational (n8n çalışıyor, restart survive eder, networking OK)
- Real runtime required: yes (Hetzner'da Docker)
- Human/UAT required: no (API/health check ile verify)

## Verification

- `curl http://n8n:5678/healthz` container içinden 200 dönmeli
- `curl https://mooreateiler.com/api/health` hala çalışmalı
- n8n workflow list API'den 2 workflow görünmeli
- `docker-compose restart n8n` sonrası workflow'lar kaybolmamalı

## Observability / Diagnostics

- Runtime signals: n8n container logs, execution history
- Inspection surfaces: n8n admin UI, `/api/health` endpoint
- Failure visibility: Docker container status, n8n execution errors
- Redaction constraints: n8n admin credentials, webhook secrets

## Integration Closure

- Upstream surfaces consumed: `docker-compose.yml`, `n8n-workflows/*.json`, `.env.production`
- New wiring: n8n Docker service, Traefik labels for n8n, env vars
- What remains: S02 — actual end-to-end generation test

## Tasks

- [x] **T01: docker-compose'a n8n service ekle** `est:30m`
  - Why: n8n container'ı olmadan workflow engine çalışmaz
  - Files: `docker-compose.yml`, `.env.production`, `.env.example`
  - Do: n8n Docker image (n8nio/n8n:latest), volume mount for data persistence (`./data/n8n:/home/node/.n8n`), environment variables (N8N_BASIC_AUTH, webhook URL, encryption key), Docker network bağlantısı (coolify + default), health check, Traefik labels for admin UI access (optional subdomain veya path)
  - Verify: `docker-compose config` hata vermemeli
  - Done when: docker-compose.yml'de n8n service tanımı var, env variables documented

- [x] **T02: Workflow auto-import init container** `est:30m`
  - Why: Workflow JSON'ları n8n'e elle import etmek yerine otomatik olmalı
  - Files: `docker-compose.yml`, `n8n-workflows/workflow-a-orchestrator.json`, `n8n-workflows/workflow-b-generate-single.json`
  - Do: Init container veya n8n startup script ile workflow JSON'ları REST API üzerinden import. n8n'in `N8N_DEFAULT_BINARY_DATA_MODE`, import endpoint'leri kullan. Alternatif: volume mount ile `~/.n8n/` dizinine kopyala.
  - Verify: n8n REST API `/api/v1/workflows` 2 workflow listeler
  - Done when: Container ilk start'ta workflow'lar otomatik import ediliyor

- [x] **T03: Network + URL configuration** `est:20m`
  - Why: Express ve n8n birbirini çağırabilmeli
  - Files: `api/generate-jewelry.ts`, `.env.production`
  - Do: `N8N_WEBHOOK_URL` env'ini Docker internal URL'e set et (`http://n8n:5678/webhook/generate-jewelry`). n8n workflow'lardaki callback URL'leri Docker internal URL'e güncelle (`http://app:80/api/n8n/trigger` veya `http://mooreateiler.com/api/n8n/trigger`). `USE_N8N=true` set et.
  - Verify: Container içinden `curl http://n8n:5678/healthz` ve `curl http://app:80/api/health` çalışır
  - Done when: Her iki yönde HTTP iletişim Docker network üzerinden çalışıyor

- [x] **T04: Deploy ve verify** `est:20m`
  - Why: Hetzner'da gerçek deploy test
  - Files: —
  - Do: Değişiklikleri commit + push, Hetzner'da docker-compose pull + up, n8n admin UI'a eriş, workflow'ları kontrol et, health check yap
  - Verify: n8n admin UI erişilebilir, workflow'lar import edilmiş, Express health OK
  - Done when: Production'da n8n çalışıyor, workflow'lar görünüyor

## Files Likely Touched

- `docker-compose.yml`
- `.env.production`
- `.env.example`
- `api/generate-jewelry.ts`
- `n8n-workflows/workflow-a-orchestrator.json`
- `n8n-workflows/workflow-b-generate-single.json`
