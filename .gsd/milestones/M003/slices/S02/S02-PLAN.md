# S02: Product Upload + Analysis + Prompt Engine

**Goal:** Ürün görseli yükleme, Gemini ile otomatik ürün analizi, ve 5 mod için yapısal prompt template sistemi kurma.
**Demo:** `POST /api/v2/products/upload` ile görsel yüklenir → `POST /api/v2/products/:id/analyze` ile analiz başlatılır → analysis_json döner (product_type, metal_color, stones, complexity). Prompt Composer 5 mod için yapısal template üretir.

## Must-Haves

- ProductsModule: upload, list, get, analyze endpoints
- Product Analyzer: Gemini Vision ile ürün analizi (product_type, metal, stones, shape, complexity)
- PromptModule: yapısal bloklar, 5 mod için template, versioning, DB'de saklama
- Prompt Composer: mode + product + scene + reference bilgilerinden yapısal prompt oluşturma
- Upload flow: base64/multipart → MinIO → products tablosu

## Proof Level

- This slice proves: integration (upload → storage → analyze → Gemini API → DB persist → prompt compose)
- Real runtime required: yes (Gemini API çağrısı)
- Human/UAT required: no

## Verification

- `POST /api/v2/products/upload` + image → product_id döner, MinIO'da dosya var
- `POST /api/v2/products/:id/analyze` → analysis_json: `{product_type, metal_color, stone_presence, complexity_score}`
- `GET /api/v2/products` (auth) → kullanıcının ürünleri listelenir
- `GET /api/v2/prompt-templates?mode=retouch` → aktif template döner
- PromptComposer.compose(mode, product, scene) → yapısal prompt string

## Tasks

- [x] **T01: ProductsModule — upload + CRUD endpoints** `est:40m`
  - Why: Ürün yükleme tüm akışların başlangıç noktası
  - Files: `backend/src/products/`
  - Do: ProductsController: POST /upload (multipart veya base64), GET / (list), GET /:id. ProductsService: createFromUpload (MinIO'ya yükle, DB'ye kaydet), findAll (user filtered), findOne. DTO'lar: CreateProductDto (image base64 veya file). Product entity zaten var — kullan.
  - Verify: curl ile upload → product_id döner, GET ile listelenir
  - Done when: Ürün yüklenebilir, listelenebilir, detayı görülebilir

- [x] **T02: ProductAnalyzer — Gemini Vision ile ürün analizi** `est:45m`
  - Why: PRD Section 10.3 — product_type, metal_color, stone_presence, complexity zorunlu
  - Files: `backend/src/analysis/`
  - Do: AnalysisModule + ProductAnalyzerService. Gemini API çağrısı (gemini-3.1-flash-lite) ile ürün görseli analiz. Structured JSON prompt → JSON parse. Analiz sonucu products.analysis_json'a yazılır, product_type/metal_color/stone_presence gibi alanlar da güncellenir. POST /products/:id/analyze endpoint.
  - Verify: Gerçek mücevher görseli ile analiz → mantıklı JSON döner
  - Done when: Analiz çalışıyor, analysis_json DB'de, product alanları güncellendi

- [x] **T03: PromptModule — template CRUD + seeding** `est:40m`
  - Why: PRD Section 15 — prompt'lar yapısal bloklar, versiyonlanmış, DB'de
  - Files: `backend/src/prompt/`
  - Do: PromptModule + PromptTemplateService. CRUD: GET /prompt-templates?mode=X, POST (admin). 5 mod için seed template'ler (retouch, ready_scene, reference_fusion, model_showcase, experience). Her template: task_block, fidelity_block, scene_block, reference_block, identity_block, camera_block, lighting_block, negative_block yapısında JSON.
  - Verify: GET /prompt-templates?mode=retouch → template döner
  - Done when: 5 mod için aktif template DB'de, API ile erişilebilir

- [x] **T04: PromptComposer — yapısal prompt oluşturma servisi** `est:35m`
  - Why: Worker'lar Gemini'ye gönderilecek final prompt'u PromptComposer'dan alacak
  - Files: `backend/src/prompt/prompt-composer.service.ts`
  - Do: PromptComposerService.compose(opts): mode, product analysis, scene prompt, reference analysis, model DNA → blokları birleştirip final prompt üret. Her blok ayrı method. Reference Fusion modunda fusion strategy'ye göre farklı reference_block. Prompt snapshot objesi dönür (prompt_text + metadata + version).
  - Verify: Unit test: mock product + scene + reference ile compose → beklenen bloklar prompt'ta var
  - Done when: 5 mod için compose çalışıyor, snapshot dönüyor

## Files Likely Touched

- `backend/src/products/` (yeni)
- `backend/src/analysis/` (yeni)
- `backend/src/prompt/` (yeni)
- `backend/src/app.module.ts` (yeni modül imports)
