# S02: End-to-End Integration + Production Test

**Goal:** Frontend'den görsel yüklendiğinde n8n flow tam zincir çalışsın — webhook tetiklenir, analiz yapılır, sahneler üretilir, sonuçlar galeri sayfasında görünsün.
**Demo:** mooreateiler.com'dan mücevher görseli yükle → n8n execution history'de başarılı flow görünsün → sonuçlar Results/Gallery sayfasında görünsün.

## Must-Haves

- n8n workflow callback URL'lerinin doğru çalışması (her action type)
- generate-scene action'ının Gemini API ile gerçek görsel üretmesi
- n8n execution başarılı tamamlanması (no errors)
- Üretilen görsellerin MinIO'ya kaydedilmesi
- Frontend'in üretim durumunu doğru göstermesi (polling/status update)
- Inline fallback'in hala çalışması (USE_N8N=false senaryosu)

## Proof Level

- This slice proves: integration (frontend → Express → n8n → Express → DB → frontend tam zincir)
- Real runtime required: yes (Hetzner, Gemini API, MinIO)
- Human/UAT required: yes (mooreateiler.com'dan görsel yükleme)

## Verification

- n8n execution history'de başarılı execution (status: success)
- processing_jobs tablosunda status='completed' ve result_urls dolu
- images tablosunda generated_image_urls dolu
- Frontend Results sayfasında üretilen görseller görünür
- `curl https://mooreateiler.com/api/health` → 200

## Observability / Diagnostics

- Runtime signals: n8n execution logs, Express console.log, processing_jobs status progression
- Inspection surfaces: n8n admin UI execution history, /api/processing-jobs endpoint, PostgreSQL processing_jobs table
- Failure visibility: n8n execution error details, processing_jobs.error_message field
- Redaction constraints: Gemini API key, n8n webhook secret

## Integration Closure

- Upstream surfaces consumed: S01 n8n webhook URL, /api/n8n/trigger endpoint, docker networking
- New wiring: generateSceneForN8N function call chain, n8n execution flow
- What remains: nothing — this completes the milestone

## Tasks

- [x] **T01: Callback URL düzeltme ve workflow sync** `est:30m`
  - Why: n8n workflow'daki callback URL'leri, header'lar ve action body'leri Express handler ile tam uyumlu olmalı
  - Files: `n8n-workflows/workflow-a-orchestrator.json`, `api/n8n-trigger.ts`
  - Do: Workflow JSON'daki her httpRequest node'unu gözden geçir — URL (`http://app:80/api/n8n/trigger`), header (`x-n8n-secret`), body (action, jobId, status format) Express handler'a uyumlu mu? Uyuşmazlıkları düzelt. JSON düzeltildiyse n8n'e re-import et.
  - Verify: `docker compose exec -T n8n n8n export:workflow --id=wf_jewelry_main` ile güncel workflow'u kontrol et
  - Done when: Tüm callback URL'leri ve body formatları Express handler ile birebir eşleşiyor

- [x] **T02: generateSceneForN8N fonksiyonunu test et** `est:30m`
  - Why: n8n workflow "generate-scene" action'ı çağırdığında gerçek Gemini image generation yapılmalı
  - Files: `api/generate-jewelry.ts`, `api/n8n-trigger.ts`
  - Do: generateSceneForN8N'in aldığı parametrelerin n8n workflow'dan gelecek payload ile uyumunu kontrol et. Fonksiyonun MinIO upload, prompt building, Gemini API call yapıp sonucu doğru formatta döndüğünü doğrula. Gerekirse eksik parametreleri handle et.
  - Verify: Curl ile `/api/n8n/trigger` action=generate-scene test payload'ı gönder → Gemini çağrısı yapılıp sonuç dönmeli
  - Done when: generate-scene action Gemini API ile görsel üretip base64/URL olarak döndürüyor

- [x] **T03: Production end-to-end test** `est:30m`
  - Why: Gerçek kullanıcı senaryosu — frontend'den görsel yükle, n8n flow tetikle, sonuçları gör
  - Files: —
  - Do: mooreateiler.com'a giriş yap, Generate sayfasında mücevher görseli yükle, sahne seç, üretim başlat. n8n admin UI'dan execution'ı izle. Hata varsa log'lara bak, düzelt, tekrar dene.
  - Verify: n8n execution success, Results sayfasında üretilen görseller görünür
  - Done when: Frontend'den tetiklenen generation n8n üzerinden başarıyla tamamlanıyor

- [ ] **T04: Fallback ve resilience test** `est:20m`
  - Why: n8n fail olduğunda inline fallback çalışmalı — zero downtime garantisi
  - Files: —
  - Do: n8n container'ı geçici olarak durdur, frontend'den generation başlat → inline fallback çalışmalı. n8n'i geri başlat, tekrar generation → n8n flow çalışmalı.
  - Verify: n8n kapalıyken generation hala çalışıyor (fallback mode), n8n açıkken n8n flow çalışıyor
  - Done when: Her iki senaryo da başarılı — n8n ve fallback mode sorunsuz

## Files Likely Touched

- `n8n-workflows/workflow-a-orchestrator.json`
- `api/n8n-trigger.ts`
- `api/generate-jewelry.ts`
