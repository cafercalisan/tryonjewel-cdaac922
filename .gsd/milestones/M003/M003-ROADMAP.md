# M003: NestJS Backend Foundation + 5 Core Generation Modes

**Vision:** Mevcut monolitik Express backend'i tamamen NestJS modüler mimariye taşıyarak, 5 temel görsel üretim modunu BullMQ job queue ve QC pipeline ile çalıştırmak.

## Success Criteria

- Ürün yüklenir ve otomatik analiz JSON üretilir (product_type, metal_color, stones, complexity_score)
- Referans görsel yüklenir ve yapısal analiz üretilir (mood, composition, light, fusion strategy önerisi)
- 5 üretim modunun her biri bir ürün görseli alıp Gemini üzerinden çıktı üretebilir
- Job lifecycle takip edilebilir: queued → analyzing → generating → qc_check → completed/failed
- Failed job'lar otomatik retry edilir (max 3), partial completion desteklenir
- QC skoru her görsel için hesaplanır (visibility, fidelity, artifact)
- Üretilen görseller galeri API'sinden mod/model/sahne/tarih ile filtrelenir
- Prompt template'ler DB'de versiyonlanır, her çıktıda prompt snapshot saklanır
- Mevcut auth (JWT) yeni backend'de çalışır, kullanıcı oturumları kırılmaz
- Redis + BullMQ Docker Compose'a entegre, health check aktif

## Key Risks / Unknowns

- Gemini Pro Image, referans görsel + ürün birleştirmede (Reference Fusion) yeterli kalite üretecek mi — PRD'nin farklılaştırıcı özelliği bu, başarısız olursa ürün değeri düşer
- BullMQ worker crash recovery ve Redis reconnect Hetzner'da stabil mi — production'da test edilmeli
- QC skorlama doğruluğu — Gemini'nin kendi çıktısını değerlendirmesi circular risk taşır
- Prompt template yapısının 5 farklı mod için yeterince esnek olması

## Proof Strategy

- Reference Fusion kalitesi → S03'te retire: gerçek ürün + referans görsel ile 3 farklı fusion strategy test edilecek, QC pass oranı >%60 hedef
- BullMQ stabilitesi → S01'de retire: Redis container + BullMQ konfigüre edilip 50 dummy job işlenecek
- QC doğruluğu → S05'te retire: 20 üretilmiş görsel üzerinde manual review vs otomatik QC karşılaştırması
- Prompt esnekliği → S02'de retire: 5 mod için template'ler yazılıp her biriyle 1'er üretim yapılacak

## Verification Classes

- Contract verification: Her modül için unit test + service integration test
- Integration verification: Upload → Analyze → Generate → QC → Gallery full pipeline e2e test
- Operational verification: Worker crash → restart → resume, Redis disconnect → reconnect
- UAT / human verification: 5 modun her birinden 3'er örnek üretim, görsel kalite değerlendirmesi

## Milestone Definition of Done

This milestone is complete only when all are true:

- 5 üretim modunun tamamı API üzerinden çalışıyor ve çıktı üretiyor
- Job lifecycle (queue → process → QC → complete) tam döngü tamamlanıyor
- Prompt versioning aktif, her çıktıda snapshot mevcut
- QC pipeline çalışıyor ve düşük kalite çıktıları işaretliyor
- Gallery API filtreleme ile çıktıları listeliyor
- Mevcut frontend eski API'lerle hala çalışabiliyor (legacy compat)
- Docker Compose'da Redis + NestJS backend ayağa kalkıyor
- 5 modun her birinden en az 3 başarılı üretim kanıtlanmış

## Requirement Coverage

- Covers: R001 (ürün upload/analiz), R002 (referans upload/analiz), R003 (5 mod), R004 (job queue), R005 (QC), R006 (galeri), R007 (prompt versioning)
- Partially covers: R008 (admin — sadece prompt template CRUD)
- Leaves for later: R009 (video), R010 (master package), R011 (full admin panel)

## Slices

- [x] **S01: NestJS Skeleton + Auth + DB + BullMQ** `risk:high` `depends:[]`
  > After this: NestJS backend ayakta, JWT auth çalışıyor, Redis + BullMQ bağlı, yeni DB tabloları oluşturulmuş, health endpoint aktif. `curl /api/v2/health` çalışır.

- [x] **S02: Product Upload + Analysis + Prompt Engine** `risk:high` `depends:[S01]`
  > After this: Ürün görseli yüklenir → Product Analyzer çalışır → analysis_json döner. Prompt Composer 5 mod için yapısal template üretir. API: `POST /api/v2/products/upload` → `POST /api/v2/products/:id/analyze` çalışır.

- [x] **S03: Reference Upload + Analysis + Fusion Strategy** `risk:high` `depends:[S01]`
  > After this: Referans görsel yüklenir → Reference Analyzer çalışır → mood, composition, strategy önerir. `POST /api/v2/references/upload` → `POST /api/v2/references/:id/analyze` çalışır. Fusion strategy seçilebilir.

- [x] **S04: Generation Orchestrator + Image Worker (Retouch + Scene)** `risk:medium` `depends:[S01,S02]`
  > After this: Ürün seçilir → Retouch veya Ready Scene modu ile üretim başlatılır → BullMQ queue'ya düşer → Image Worker Gemini çağırır → çıktı storage'a yazılır → job status completed. İlk 2 mod uçtan uca çalışır.

- [x] **S05: QC Worker + Gallery Service** `risk:medium` `depends:[S04]`
  > After this: Üretilen her görsel QC Worker'dan geçer → visibility/fidelity/artifact skoru atanır → düşük kalite çıktılar soft_warning veya fail_regenerate alır. Gallery API çıktıları mod/model/sahne/tarih ile filtreleyerek listeler.

- [x] **S06: Reference Fusion + Model Showcase + Experience Modes** `risk:high` `depends:[S02,S03,S04,S05]`
  > After this: Kalan 3 mod aktif. Reference Fusion referans görseli ile ürünü birleştirir. Model Showcase model DNA üzerinde üretir. Experience Mode atmosfer ve hikâye kareleri üretir. 5 modun tamamı QC ile çalışır.

- [x] **S07: Legacy Compat + Integration Test + Docker** `risk:low` `depends:[S06]`
  > After this: Mevcut frontend eski API'ler üzerinden çalışmaya devam eder. Docker Compose'da Redis + NestJS + PostgreSQL + MinIO tam stack ayağa kalkar. 5 modun her birinden 3'er üretim e2e test ile kanıtlanır.

## Boundary Map

### S01 → S02

Produces:
- NestJS modül yapısı, DI container
- AuthGuard middleware (JWT verify)
- Database module (TypeORM + entities)
- BullMQ queue registration pattern
- Storage service (MinIO S3)
- New DB tables: products, references, product_sets, generation_jobs, generation_job_items, images_v2, qc_reports, prompt_templates

Consumes:
- nothing (first slice)

### S01 → S03

Produces:
- Same as S01 → S02 (shared infrastructure)

Consumes:
- nothing (first slice)

### S02 → S04

Produces:
- ProductService (upload, CRUD, analysis)
- ProductAnalyzer (Gemini vision analiz)
- PromptComposer service (structured blocks, template resolution)
- Product entity + analysis_json shape
- PromptTemplate entity + versioning

Consumes:
- S01: AuthGuard, DatabaseModule, StorageService, BullMQ

### S03 → S06

Produces:
- ReferenceService (upload, CRUD, analysis)
- ReferenceAnalyzer (mood, composition, strategy)
- Reference entity + analysis_json shape
- FusionStrategy types (style_transfer, scene_rebuild, reference_merge)

Consumes:
- S01: AuthGuard, DatabaseModule, StorageService

### S04 → S05

Produces:
- GenerationOrchestrator (job oluşturma, item dispatch)
- ImageGenerationWorker (Gemini Flash + Pro çağrıları)
- GenerationJob entity + status lifecycle
- GenerationJobItem entity
- Image_v2 entity (output_url, mode, qc_score placeholder)
- Retouch mode prompt template
- Ready Scene mode prompt template

Consumes:
- S01: BullMQ, StorageService, DatabaseModule
- S02: ProductService, PromptComposer

### S05 → S06

Produces:
- QCWorker (visibility, fidelity, artifact scoring)
- QCReport entity
- GalleryService (list, filter, download)
- Gallery API endpoints

Consumes:
- S04: GenerationOrchestrator, Image_v2 entity

### S06 → S07

Produces:
- ReferenceFusionMode (3 strategy ile çalışan üretim)
- ModelShowcaseMode (model DNA + identity lock)
- ExperienceMode (mood-based scene generation)
- Model entity + DNA payload
- 3 ek prompt template ailesi

Consumes:
- S02: ProductService, PromptComposer
- S03: ReferenceService, ReferenceAnalyzer
- S04: GenerationOrchestrator, ImageGenerationWorker
- S05: QCWorker, GalleryService
