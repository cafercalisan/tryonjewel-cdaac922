# M003: NestJS Backend Foundation + 5 Core Generation Modes

**Gathered:** 2026-03-26
**Status:** Ready for planning

## Project Description

Mevcut monolitik Express backend'i NestJS modüler mimariye taşıyıp, PRD'de tanımlanan 5 temel görsel üretim modunu (Retouch, Ready Scene, Reference Fusion, Model Showcase, Experience) çalışır hale getirmek. BullMQ job queue, yapısal prompt composer, QC pipeline dahil.

## Why This Milestone

Mevcut backend sürdürülebilir değil. 2600 satırlık tek handler, inline prompt oluşturma, job tracking olmayan senkron üretim. PRD'nin istediği ürün analizi, referans analizi, çoklu mod, QC pipeline — hiçbiri mevcut yapıda patch ile yapılamaz. Temelden kurulması gerekiyor.

## User-Visible Outcome

### When this milestone is complete, the user can:

- Ürün görseli yükleyip otomatik analiz sonucunu görebilir (product type, metal, stones)
- Referans görsel yükleyip analiz sonucunu görebilir (mood, light, composition)
- 5 moddan birini seçip üretim başlatabilir (Retouch, Scene, Reference Fusion, Model Showcase, Experience)
- Job progress'i gerçek zamanlı izleyebilir (queued → analyzing → generating → qc → completed)
- QC pass/fail sonuçlarını görebilir
- Üretilen görselleri galeriden filtreleyip indirebilir

### Entry point / environment

- Entry point: `POST /api/v2/*` endpoints (frontend uyumluluğu sonraki milestone'da)
- Environment: Hetzner production + local dev (Docker Compose)
- Live dependencies: PostgreSQL, Redis, MinIO, Gemini API

## Completion Class

- Contract complete means: Her servis modülü e2e test ile doğrulanmış, API sözleşmeleri sabit
- Integration complete means: Upload → Analyze → Generate → QC → Gallery full pipeline çalışıyor
- Operational complete means: BullMQ worker'ları crash recovery ile çalışıyor, failed job retry mekanizması aktif

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- Bir ürün yüklenir → analiz edilir → 5 modun her birinde 1'er görsel üretilir → QC'den geçer → galeriye düşer
- Bir referans görsel yüklenir → analiz edilir → Reference Fusion modunda ürünle birleştirilir → çıktı doğru
- Failed job otomatik retry edilir, partial completion desteklenir
- Aynı model kimliği ile 3 farklı sahne üretilir, model tutarlılığı korunur

## Risks and Unknowns

- Gemini 3 Pro Image kalitesi referans fusion için yeterli mi → S03'te test edilecek
- BullMQ Redis bağlantı stabilitesi Hetzner'da → S01'de kurulup doğrulanacak
- QC skorlama mantığı — hangi Gemini modeli QC'de kullanılacak → S05'te deneysel
- Prompt template yapısının 5 mod için yeterli esnekliği → S02'de test edilecek

## Existing Codebase / Prior Art

- `api/generate-jewelry.ts` — 2600 satır, mevcut prompt ve Gemini çağrı mantığı (referans olarak okunacak, kullanılmayacak)
- `api/_lib/storage.ts` — MinIO S3 helper'ları (NestJS'e taşınacak)
- `api/_lib/auth.ts` — JWT verify mantığı (NestJS Guard olacak)
- `api/_lib/db.ts` — pg query helper (TypeORM/Prisma'ya geçilecek)
- `init.sql` — mevcut DB şeması (yeni tablolar eklenecek, eskiler korunacak)
- `api/generate-jewelry.ts` içindeki `callGeminiAnalysis` ve `callGeminiImageGeneration` fonksiyonları — Gemini API çağrı pattern'leri

## Relevant Requirements

- R001: Ürün yükleme ve analiz → products modülü
- R002: Referans yükleme ve analiz → references modülü  
- R003: 5 üretim modu → generation + workers modülleri
- R004: Job queue ve progress tracking → BullMQ + generation orchestrator
- R005: QC pipeline → qc modülü
- R006: Galeri ve filtreleme → gallery modülü
- R007: Prompt versioning → prompt modülü

## Scope

### In Scope

- NestJS proje yapısı ve modül organizasyonu
- Auth modülü (mevcut JWT taşıma)
- Products modülü (upload, CRUD, analiz, set)
- References modülü (upload, analiz, fusion strategy)
- Scenes modülü (mevcut data, yeni API)
- Models modülü (DNA kütüphanesi)
- Prompt Composer modülü (yapısal bloklar, versioning)
- Generation Orchestrator (job oluşturma, dispatch)
- Image Generation Worker (Gemini Flash + Pro)
- QC Worker (kalite skorlama)
- Gallery Service (asset listeleme, filtreleme)
- DB migration (yeni tablolar)
- Redis + BullMQ kurulumu
- Docker Compose güncelleme (Redis ekleme)
- 5 mod: Retouch, Ready Scene, Reference Fusion, Model Showcase, Experience

### Out of Scope / Non-Goals

- Frontend yeniden yazımı (M004)
- Video üretimi / Veo 3.1 (M005)
- Master Package orkestrasyonu (M005)
- Admin panel genişletme (M005)
- Kullanıcı özel model DNA oluşturma (V2)
- Set ürün üretimi (V2)

## Technical Constraints

- PostgreSQL 16 (mevcut Hetzner bare metal)
- Redis yeni eklenecek (Docker container)
- Gemini API rate limit'leri — worker concurrency ayarlanmalı
- MinIO S3 endpoint mevcut, değişmemeli
- Mevcut kullanıcı verileri korunmalı

## Integration Points

- PostgreSQL — yeni tablolar + mevcut tablolar beraber
- Redis — BullMQ queue backend
- MinIO — dosya upload/download
- Gemini API — analiz + görsel üretim
- Mevcut frontend — geçiş döneminde eski API'ler de çalışmalı (legacy compat)

## Open Questions

- ORM olarak TypeORM mu Prisma mı → S01'de karar verilecek (TypeORM NestJS ile daha native)
- Frontend geçiş stratejisi — v2 API hazır olunca mı geçilecek → evet, M003 tamamlanınca M004'te frontend
