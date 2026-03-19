# M002: n8n Workflow Engine — Hetzner Deploy

**Vision:** n8n workflow engine Hetzner'da çalışarak mücevher görsel üretim sürecini orchestrate eder. Mevcut inline generation'dan n8n-managed pipeline'a geçiş.

## Success Criteria

- n8n container Hetzner'da ayakta ve persistent (restart sonrası data korunur)
- Kullanıcı mooreateiler.com'dan görsel yükleyince n8n flow tetiklenir ve görseller üretilir
- n8n execution history görülebilir (admin dashboard)
- n8n fail olduğunda inline fallback çalışır (zero downtime)

## Key Risks / Unknowns

- Docker networking — n8n container'ı Express API'ye (ve tersi) erişebilmeli
- Workflow import — JSON dosyaları n8n'e doğru import edilmeli
- Memory — n8n + mevcut stack VPS kaynaklarını aşabilir

## Proof Strategy

- Docker networking → S01'de retire — n8n container health + cross-container HTTP call çalışır
- Workflow import → S01'de retire — workflow'lar n8n UI'da görünür ve test execution çalışır
- Full pipeline → S02'de retire — frontend'den tetiklenen generation n8n üzerinden tamamlanır

## Verification Classes

- Contract verification: n8n health endpoint + workflow list API
- Integration verification: Frontend → Express → n8n → Express → DB tam zincir
- Operational verification: docker-compose restart sonrası workflow'lar persist eder
- UAT: mooreateiler.com'dan gerçek görsel üretimi

## Milestone Definition of Done

- n8n Docker container Hetzner'da persistent çalışıyor
- İki workflow import edilmiş ve aktif
- `USE_N8N=true` environment'ta set
- Frontend'den tetiklenen generation n8n üzerinden çalışıyor
- Inline fallback korunuyor ve çalışıyor
- Container restart sonrası workflow'lar kaybolmuyor

## Requirement Coverage

- Covers: n8n orchestration, eşsiz sahne prompt üretimi
- Leaves for later: Pinterest trend scraping (M003)

## Slices

- [x] **S01: n8n Docker Setup + Workflow Import** `risk:high` `depends:[]`
  > After this: n8n container Hetzner'da çalışıyor, workflow'lar import edilmiş, admin UI erişilebilir, health check pass ediyor
- [ ] **S02: End-to-End Integration + Production Test** `risk:medium` `depends:[S01]`
  > After this: mooreateiler.com'dan görsel yüklenince n8n flow çalışır, görseller üretilir, sonuçlar galeri sayfasında görüntülenir

## Boundary Map

### S01 → S02

Produces:
- n8n webhook URL (Docker internal: `http://n8n:5678/webhook/generate-jewelry`)
- n8n admin credentials
- Working docker-compose with n8n service
- Imported workflows (orchestrator + generate-single)

Consumes:
- nothing (first slice)
