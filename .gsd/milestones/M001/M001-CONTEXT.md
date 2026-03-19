# M001: Hetzner Self-Hosted — Tam Çalışan Platform

**Gathered:** 2026-03-15
**Status:** Ready for planning

## Project Description

TryOnJewel (Moore Atelier) — jewelry brand'ler için AI görsel üretim platformu. Hetzner VPS'e Coolify ile deploy edilmiş. Platform kısmen çalışıyor: auth, DB, storage, domain/SSL tamam ama AI görsel üretimi (Gemini API) kırık.

## Why This Milestone

Platform kullanılamaz durumda çünkü core feature (görsel üretimi) çalışmıyor. Kullanıcılar giriş yapıp fotoğraf yükleyebiliyor ama sonuç alamıyor. Bu, ürünün varlık sebebi — öncelikle düzeltilmeli.

## User-Visible Outcome

### When this milestone is complete, the user can:

- Mücevher fotoğrafı yükleyip, sahne seçip, AI ile profesyonel kampanya görseli üretebilir
- Üretilen görselleri galeriden görüntüleyip indirebilir
- Tüm platform Hetzner'den bağımsız ve güvenilir çalışır

### Entry point / environment

- Entry point: https://[domain] (Hetzner VPS, Coolify managed)
- Environment: production (Docker containers)
- Live dependencies involved: Google Gemini API, PostgreSQL, MinIO

## Completion Class

- Contract complete means: `/api/health` tüm servisleri yeşil gösterir, görsel üretimi başarıyla tamamlanır
- Integration complete means: upload → Gemini analiz → Gemini image gen → MinIO save → gallery display tam döngüsü çalışır
- Operational complete means: container restart sonrası servisler otomatik recover olur

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- Bir kullanıcı giriş yapar, fotoğraf yükler, sahne seçer, 3 farklı görsel üretilir ve galeriden görüntülenir
- Üretim sırasında progress polling düzgün çalışır
- MinIO'daki görseller signed URL ile erişilebilir

## Risks and Unknowns

- Gemini API hatası root cause'u belirsiz — env var mı, API model adı mı, request format mı, rate limit mi? → Logları incelemek lazım
- MinIO signed URL'lerin dışarıdan erişimi — internal Docker network URL mi dönüyor? → Kontrol edilmeli

## Existing Codebase / Prior Art

- `api/generate-jewelry.ts` (2,391 satır) — ana generation pipeline, Gemini analiz + image gen
- `api/generate-jewelry-v2.ts` (1,849 satır) — v2 engine, 6-block JSON prompt
- `api/_lib/storage.ts` — MinIO S3 client
- `api/_lib/auth-local.ts` — JWT token management
- `server.ts` — Express server, tüm route'ları register eder
- `nginx.conf` — frontend static + API proxy
- `docker-compose.yml` — MinIO + app container tanımları

> See `.gsd/DECISIONS.md` for all architectural and pattern decisions.

## Scope

### In Scope

- Gemini API görsel üretimi fix'i
- MinIO signed URL'lerin production'da doğru çalışması
- Environment variable doğrulaması
- Temel health monitoring
- Mevcut code'daki bug fix'ler (duplicate import, vb.)

### Out of Scope / Non-Goals

- Yeni feature geliştirme
- Frontend redesign
- Payment entegrasyonu
- CI/CD pipeline kurulumu (Coolify zaten git deploy yapıyor)
- Backup stratejisi (ayrı milestone)

## Technical Constraints

- Coolify yönetimli deploy — Dockerfile + docker-compose kullanılmalı
- Gemini API key'leri environment variable olarak container'a inject ediliyor
- MinIO internal network'te (docker compose), external erişim proxy'den

## Integration Points

- Google Gemini API — analiz + görsel üretimi
- MinIO — dosya depolama ve signed URL
- PostgreSQL — processing_jobs tablosu ile async job tracking

## Open Questions

- Gemini hatası tam olarak ne? → Sunucuda logları kontrol etmek lazım
- MinIO bucket policy public mı, signed URL mı kullanılıyor? → `storage.ts` signed URL kullanıyor, doğru
- Coolify'da env var'lar nasıl set edilmiş? → Kontrol edilmeli
