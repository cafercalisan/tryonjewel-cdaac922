# S01: NestJS Skeleton + Auth + DB + BullMQ

**Goal:** NestJS backend projesini oluşturma, mevcut JWT auth'u taşıma, yeni DB tablolarını oluşturma, Redis + BullMQ altyapısını kurma — tüm sonraki slice'ların temel aldığı iskelet.
**Demo:** `curl /api/v2/health` → 200 + DB/Redis bağlantı durumu. JWT ile korunan bir endpoint çağrısı başarılı. BullMQ'ya dummy job gönderilip işlenir.

## Must-Haves

- NestJS proje yapısı (`backend/` dizini altında)
- AuthModule — mevcut JWT token'ları verify eden guard
- DatabaseModule — TypeORM + mevcut PostgreSQL bağlantısı
- Yeni tablolar: products, references, product_sets, generation_jobs, generation_job_items, images_v2, qc_reports, prompt_templates
- StorageModule — MinIO S3 helper'ları
- QueueModule — BullMQ + Redis bağlantısı
- Docker Compose güncelleme — Redis container ekleme
- Health endpoint — DB + Redis + MinIO durumu

## Proof Level

- This slice proves: operational (NestJS ayakta, auth çalışıyor, DB bağlı, Redis bağlı, queue işliyor)
- Real runtime required: yes
- Human/UAT required: no

## Verification

- `cd backend && npm run build` → 0 hata
- `cd backend && npm run start:dev` → server 3001'de dinliyor
- `curl http://localhost:3001/api/v2/health` → `{"status":"ok","db":true,"redis":true}`
- `curl -H "Authorization: Bearer <valid_jwt>" http://localhost:3001/api/v2/auth/me` → kullanıcı bilgisi
- BullMQ test: dummy job queue'ya ekle → worker tarafından işlendiği log'da görünsün
- DB: `SELECT count(*) FROM products` → 0 (tablo var, boş)
- Docker: `docker compose up redis` → Redis container sağlıklı

## Observability / Diagnostics

- Runtime signals: NestJS Logger ile modül başlatma, DB bağlantı, Redis bağlantı logları
- Inspection surfaces: `/api/v2/health` endpoint, BullMQ Bull Board UI (opsiyonel)
- Failure visibility: DB connection error, Redis connection error, JWT verify failure — hepsi structured log
- Redaction constraints: JWT_SECRET, DATABASE_URL, REDIS_URL değerleri loglanmayacak

## Integration Closure

- Upstream surfaces consumed: mevcut `init.sql` tabloları, `.env` dosyası, MinIO endpoint
- New wiring: NestJS app `backend/` dizininde, eski Express server hala `server.ts`'de çalışır
- What remains: Product/Reference/Generation modülleri (S02-S06)

## Tasks

- [x] **T01: NestJS proje iskeleti oluştur** `est:30m`
  - Why: Tüm modüllerin yaşayacağı proje yapısı lazım
  - Files: `backend/` dizini tümüyle
  - Do: `nest new backend --package-manager npm --skip-git`. tsconfig, eslint, .env okuma (ConfigModule). Ana modül yapısı: AppModule → AuthModule, DatabaseModule, StorageModule, QueueModule, HealthModule. `backend/src/common/` altına shared types ve interfaces.
  - Verify: `cd backend && npm run build` → hatasız
  - Done when: NestJS projesı derleniyor, ConfigModule `.env` okuyor

- [x] **T02: DatabaseModule + TypeORM + yeni tablo migration'ları** `est:45m`
  - Why: PRD'deki yeni entity'ler için DB tabloları oluşturulmalı
  - Files: `backend/src/database/`, `backend/src/entities/`, migration dosyaları
  - Do: TypeORM modülü kur. Mevcut tablolar için entity tanımla (users, profiles, user_roles, scenes). Yeni entity'ler: Product, Reference, ProductSet, GenerationJob, GenerationJobItem, ImageV2, Video, QCReport, PromptTemplate. `synchronize: false` + migration pattern. Migration dosyası yeni tabloları CREATE eder, mevcut tablolara dokunmaz.
  - Verify: `npm run migration:run` → tablolar oluşur. `SELECT table_name FROM information_schema.tables WHERE table_schema='public'` → yeni tablolar listede.
  - Done when: 9 yeni tablo oluşturulmuş, mevcut tablolar bozulmamış

- [x] **T03: AuthModule — JWT guard mevcut token'ları verify etsin** `est:30m`
  - Why: Mevcut frontend JWT token üretiyor, yeni backend aynı token'ları kabul etmeli
  - Files: `backend/src/auth/`
  - Do: JwtAuthGuard oluştur — `jose` kütüphanesiyle verify (mevcut `api/_lib/auth.ts` pattern'i). `@UseGuards(JwtAuthGuard)` decorator pattern. Request objesine `user` attach et. `/api/v2/auth/me` endpoint — token'dan kullanıcı bilgisi dön.
  - Verify: Mevcut frontend'den alınan JWT ile `curl -H "Authorization: Bearer <token>" /api/v2/auth/me` → 200 + user data
  - Done when: Mevcut JWT token'lar yeni backend'de çalışıyor

- [x] **T04: StorageModule — MinIO S3 helper'ları** `est:20m`
  - Why: Upload/download işlemleri tüm modüllerde kullanılacak
  - Files: `backend/src/storage/`
  - Do: Mevcut `api/_lib/storage.ts` mantığını NestJS service'e taşı. `uploadFile()`, `getSignedUrl()`, `deleteFile()` methodları. S3Client (@aws-sdk/client-s3) kullan. ConfigService'den MinIO endpoint/credentials al.
  - Verify: Unit test: mock S3Client ile upload/getSignedUrl çağrıları doğru parametrelerle yapılıyor
  - Done when: StorageService inject edilebilir, upload/download/sign metodları çalışıyor

- [x] **T05: QueueModule — BullMQ + Redis + Docker Compose** `est:30m`
  - Why: Job queue altyapısı S04'ten itibaren kullanılacak, şimdi kurulup test edilmeli
  - Files: `backend/src/queue/`, `docker-compose.yml`
  - Do: Docker Compose'a Redis service ekle (redis:7-alpine, port 6379, volume persist). BullMQ modülü kur (@nestjs/bullmq). Queue kayıt pattern'i tanımla: `analysis`, `image-generation`, `video-generation`, `qc` queue'ları. Dummy test worker: queue'ya job ekle → worker log'a yaz. Health check'e Redis bağlantı durumu ekle.
  - Verify: `docker compose up redis -d` → container sağlıklı. NestJS başlatınca "Redis connected" logu. Test endpoint'e POST → dummy job işlenir → log'da görünür.
  - Done when: Redis container çalışıyor, BullMQ 4 queue kayıtlı, dummy job pipeline doğrulanmış

- [x] **T06: HealthModule + n8n temizlik + smoke test** `est:20m`
  - Why: Tüm bileşenlerin bağlı olduğunu doğrulayan health endpoint + eski n8n kodunu temizle
  - Files: `backend/src/health/`, `server.ts`, `api/n8n-trigger.ts`, `docker-compose.yml`
  - Do: `/api/v2/health` endpoint: DB ping, Redis ping, MinIO bucket check, uptime. Mevcut Express server'dan n8n route'unu (`/api/n8n/trigger`) ve import'unu kaldır. `docker-compose.yml`'den n8n + n8n-init service'lerini kaldır. `.env` / `.env.production`'dan n8n env var'ları temizle. `n8n-workflows/` dizinini sil. `scripts/n8n-import.sh` sil.
  - Verify: `curl /api/v2/health` → tüm servisler "ok". Eski Express server hala `/api/health`'te çalışıyor. `grep -r "n8n" server.ts docker-compose.yml` → 0 sonuç.
  - Done when: Health endpoint çalışıyor, n8n tüm codebase'den temizlenmiş, eski API'ler kırılmamış

## Files Likely Touched

- `backend/` (yeni — tüm NestJS projesi)
- `docker-compose.yml` (Redis ekleme, n8n kaldırma)
- `server.ts` (n8n route kaldırma)
- `api/n8n-trigger.ts` (silme)
- `n8n-workflows/` (silme)
- `scripts/n8n-import.sh` (silme)
- `.env`, `.env.production`, `.env.example` (n8n var temizleme, Redis var ekleme)
