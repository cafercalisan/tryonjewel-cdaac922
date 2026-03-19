# M002: n8n Workflow Engine — Hetzner Deploy

**Gathered:** 2026-03-20
**Status:** Ready for planning

## Project Description

n8n workflow engine'i Hetzner sunucusuna deploy ederek mücevher görsel üretim sürecini orchestrate etmek. Kullanıcı görsel yükler → n8n flow tetiklenir → sahne promptları oluşur → Gemini ile görseller üretilir → sonuçlar DB'ye kaydedilir.

## Why This Milestone

Mevcut sistem inline `processGeneration()` ile çalışıyor — Express handler içinde fire-and-forget. Bu yaklaşımın sorunları:
1. Hata durumunda retry/recovery yok
2. Uzun süren generation işlemleri Express process'i meşgul ediyor
3. Flow visibility yok — ne olduğunu göremiyorsun
4. Workflow'u değiştirmek için kod deployu gerekiyor

n8n bu sorunların hepsini çözer: visual flow editor, retry, error handling, step-by-step monitoring.

## User-Visible Outcome

### When this milestone is complete, the user can:

- Mücevher görseli yükleyip n8n orchestrated pipeline ile profesyonel görseller üretebilir
- n8n dashboard'dan workflow execution'ları izleyebilir
- Workflow hata durumunda otomatik retry çalışır

### Entry point / environment

- Entry point: `https://mooreateiler.com` (mevcut frontend, aynı UX)
- Environment: Hetzner VPS, Docker, production
- Live dependencies: n8n (Docker), PostgreSQL, MinIO, Gemini API, Express API

## Completion Class

- Contract complete: n8n container ayakta, workflow import edilmiş, webhook endpoint aktif
- Integration complete: Frontend → Express → n8n webhook → n8n callback → DB update → Frontend polling tüm zincir çalışıyor
- Operational complete: Container restart sonrası n8n workflow'lar korunuyor (volume persist)

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- Kullanıcı mooreateiler.com'dan görsel yükleyip generation başlatabilir ve n8n flow çalışır
- n8n dashboard'a erişilebilir ve execution history görülebilir
- Container restart sonrası workflow'lar ve data korunur
- n8n fail olduğunda inline fallback çalışmaya devam eder

## Risks and Unknowns

- n8n container memory/CPU kullanımı — Hetzner VPS kaynak sınırı
- n8n + Express arasındaki networking — Docker internal network çözülmeli
- Workflow JSON import — n8n REST API ile otomatik import gerekiyor

## Existing Codebase / Prior Art

- `n8n-workflows/workflow-a-orchestrator.json` — Ana orchestrator workflow (webhook → validate → download → analyze → loop scenes → generate → finalize)
- `n8n-workflows/workflow-b-generate-single.json` — Tekli görsel üretim sub-workflow (Gemini retry logic + MinIO upload)
- `api/n8n-trigger.ts` — n8n'in callback endpoint'i (update-job, download-images, analyze-jewelry, generate-scene, refund-credits, fetch-brand-dna)
- `api/generate-jewelry.ts` — `USE_N8N=true` flag ile n8n webhook'a yönlendirme + inline fallback
- `docker-compose.yml` — Mevcut MinIO + app container (n8n yok)
- `server.ts` — `/api/n8n/trigger` route registered

> See `.gsd/DECISIONS.md` for all architectural and pattern decisions.

## Scope

### In Scope

- docker-compose'a n8n service ekleme (volume persist, networking)
- n8n'e workflow import (REST API veya volume mount)
- n8n webhook URL'ini Express'in çağırabilmesi
- n8n'in Express callback endpoint'ini çağırabilmesi
- `USE_N8N=true` env set + inline fallback korunması
- n8n basic auth veya credential setup
- Hetzner'a deploy ve production test

### Out of Scope / Non-Goals

- Pinterest trend scraping (M003)
- n8n'den direkt Gemini API çağrısı (callback pattern korunuyor)
- Frontend değişikliği (mevcut UX aynı kalıyor)
- n8n'e custom domain (admin-only internal tool)

## Technical Constraints

- Hetzner VPS kaynak limitleri — n8n hafif olmalı
- Docker internal networking — container-to-container iletişim
- Traefik routing — n8n admin paneli isteğe bağlı external erişim

## Integration Points

- n8n → Express API (`/api/n8n/trigger`) — callback'ler için
- Express API → n8n webhook — generation tetikleme için
- n8n → MinIO — doğrudan depolama erişimi (opsiyonel, şu an callback üzerinden)
- Frontend → Express → n8n → Express → DB — tam zincir

## Open Questions

- n8n admin paneline dışarıdan erişim gerekli mi? — Muhtemelen evet, Traefik ile subdomain veya port
