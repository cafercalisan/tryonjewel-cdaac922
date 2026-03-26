# TryOnJewel – CTO Seviyesinde Teknik PRD

## 1. Doküman Amacı
Bu dokümanın amacı, TryOnJewel benzeri mücevher odaklı görsel üretim platformunun teknik ürün gereksinimlerini, modüler mimarisini, kullanıcı akışlarını, model seçimlerini ve uygulanabilir MVP sınırlarını yazılım ekibi için net şekilde tanımlamaktır.

Bu sistemin temel hedefi şudur:

Kullanıcıların yüklediği mücevher ürünlerini;
- teknik olarak temizlenmiş satış görselleri,
- hazır premium sahne sunumları,
- tutarlı model kimlikleri üzerinde görseller,
- kullanıcı tarafından seçilen referans görsellerle birleştirilmiş sunumlar,
- yalnızca “takılmış ürün” değil, atmosfer ve hikâye içeren yaşayan deneyim kareleri,
- temel kısa video varyasyonları

olarak üretebilen ölçeklenebilir bir platform oluşturmak.

MVP model tercihi şu şekilde konumlandırılmalıdır:
- **Görsel üretim ve düzenleme:** Google **Nano Banana 2** (`gemini-3.1-flash-image-preview`) yüksek hacim ve hız odaklı ana üretim modeli olarak. ([ai.google.dev](https://ai.google.dev/gemini-api/docs/image-generation?utm_source=chatgpt.com))
- **Daha karmaşık ve üst kalite üretimler:** Google **Nano Banana Pro** / **Gemini 3 Pro Image** karmaşık düzenleme ve yüksek sadakatli üretimlerde üst seviye seçenek olarak. ([ai.google.dev](https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image-preview?utm_source=chatgpt.com))
- **MVP video üretimi:** Google **Veo 3.1** ile basit kısa video hattı. Veo 3.1 metin ve görsel girdilerinden video üretebilir; 8 saniyelik 720p, 1080p ve 4K seçeneklerini destekler. ([ai.google.dev](https://ai.google.dev/gemini-api/docs/video?utm_source=chatgpt.com))

---

## 2. Ürün Tanımı
Platform, kullanıcıların mücevher ürün görsellerini yükleyip farklı üretim modları üzerinden yüksek kaliteli çıktı almalarını sağlar.

Sistem aşağıdaki ana değer önerilerini sunar:

1. **Retouch**  
   Ürünü e-ticaret ve katalog kullanımına uygun şekilde teknik olarak temizlemek.

2. **Scene Placement**  
   Ürünü hazır lüks sahnelere doğal ve premium biçimde yerleştirmek.

3. **Reference Fusion**  
   Kullanıcının seçtiği referans görseli analiz edip, ürününü bu referansın stil, kompozisyon veya bağlam diliyle birleştirerek sergilemek.

4. **Model Showcase**  
   Ürünü tutarlı model kimlikleri üzerinde gerçekçi ve editöriyal kalitede göstermek.

5. **Experience Mode**  
   Ürünü bir yaşam anı, atmosfer ve hikâye içinde duygusal etkisi yüksek şekilde sunmak.

6. **Basic Video Mode (MVP)**  
   Seçilen görsel çıktıyı ya da referans destekli sahneyi kısa, basit video formatına dönüştürmek.

7. **Master Package**  
   Tek ürün için çoklu çıktı ailesi üretmek.

---

## 3. Hedef Kullanıcılar

### Birincil Kullanıcılar
- mücevher üreticileri
- toptancılar
- e-ticaret satıcıları
- butik takı markaları
- sosyal medya ve içerik ekipleri
- kreatif ajanslar

### İkincil Kullanıcılar
- katalog hazırlayan satış ekipleri
- pazarlama departmanları
- görsel üretim ajansları
- showroom ve sunum ekipleri

---

## 4. Problem Tanımı
Bugünkü süreçlerde kullanıcılar aşağıdaki problemleri yaşar:

- ürün fotoğrafları teknik olarak yetersizdir
- ürün görselleri her kullanım alanı için yeniden çekim gerektirir
- model üzerinde deneme çıktıları tutarsızdır
- ürün geometrisi ve taş dizilimi bozulur
- saç, kumaş, açı ve ışık ürün görünürlüğünü düşürür
- kullanıcı beğendiği bir referans kampanya veya editöriyal görseli doğrudan iş akışına dahil edemez
- aynı ürün için hem e-ticaret hem sosyal medya hem kampanya hem kısa video kalitesinde üretim yapmak zordur
- profesyonel çekim ve prodüksiyon maliyeti yüksektir

Bu platform bu sorunları yazılım tabanlı, ölçeklenebilir ve yarı-otomatik bir üretim akışı ile çözmeyi hedefler.

---

## 5. Ürün Hedefleri

### İş Hedefleri
- mücevher markaları için üretim maliyetini düşürmek
- daha hızlı kampanya ve katalog hazırlama sağlamak
- ürün başına çoklu kullanım senaryosu üretmek
- referans görselden ilham alan ama ürünü koruyan yeni bir üretim standardı sunmak
- ajans ve B2B kullanımına uygun paketlenebilir bir sistem oluşturmak

### Teknik Hedefler
- ürün sadakatini mümkün olduğunca korumak
- aynı model kimliği ile seri üretim yapabilmek
- referans görseli yapısal olarak analiz edip üretime dahil etmek
- çoklu çıktı türlerini tek platformdan üretmek
- kuyruk tabanlı stabil işleme altyapısı kurmak
- kalite kontrol ile düşük kalite üretimleri ayıklamak

### Kullanıcı Deneyimi Hedefleri
- yükle → seç → üret mantığında akıcı bir deneyim
- tek ürün için farklı üretim modları arasında kolay geçiş
- kullanıcı referans görselini sisteme yükleyip seçilebilir bir yaratıcı kontrol aracı olarak kullanabilmeli
- bir ürünün hem satış hem sunum hem hikâye hem video varyasyonlarını aynı galeri içinde görmek

---

## 6. Kapsam

### In Scope
- ürün yükleme
- referans görsel yükleme
- ürün analizi
- referans analizi
- retouch üretimi
- hazır sahne seçimi ve sahneye yerleştirme
- referans görsel ile ürün birleştirme
- model seçimi veya hazır model kullanımı
- tutarlı model kimliği ile üretim
- deneyim odaklı hikâyesel sahneler
- set ürün desteği
- job queue ile asenkron üretim
- galeri ve çıktı yönetimi
- kalite kontrol skorlama
- admin paneli
- MVP düzeyinde kısa video üretimi

### Out of Scope (MVP için)
- gerçek zamanlı 3D try-on
- ileri seviye video kurgu editörü
- kullanıcı tarafından tam serbest prompt yazımı
- gerçek zamanlı pose editing
- mobil native uygulama
- canlı AR entegrasyonu
- ileri seviye zaman çizgili video düzenleme

---

## 7. Temel Model Kararları

### 7.1 Görsel Üretim Ana Modeli
MVP’de ana görsel üretim modeli olarak **Nano Banana 2 / Gemini 3.1 Flash Image Preview** kullanılmalıdır.

Gerekçeler:
- hız ve maliyet dengesi
- yüksek hacimli kullanım için uygunluk
- hem üretim hem düzenleme desteği
- referans görsel tabanlı akışlarda verimli kullanım

Bu model Google tarafından yüksek hacimli ve düşük gecikmeli görsel üretim/düzenleme hattı olarak konumlandırılmaktadır. ([ai.google.dev](https://ai.google.dev/gemini-api/docs/image-generation?utm_source=chatgpt.com))

### 7.2 Üst Seviye Görsel Üretim Opsiyonu
**Nano Banana Pro / Gemini 3 Pro Image** daha yüksek sadakat, karmaşık kompozisyon ve profesyonel asset üretimi için ikinci katman olarak desteklenmelidir. Google, bu modeli yüksek kaliteli mockup ve karmaşık image editing işleri için konumlandırmaktadır. ([ai.google.dev](https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image-preview?utm_source=chatgpt.com))

### 7.3 MVP Video Modeli
Video için **Veo 3.1** kullanılmalıdır. Google dokümantasyonuna göre Veo 3.1, metin ve görsel promptlarından video üretebilir ve kısa yüksek çözünürlüklü çıktılar sağlayabilir. ([ai.google.dev](https://ai.google.dev/gemini-api/docs/video?utm_source=chatgpt.com))

MVP video hedefi:
- kısa klip üretimi
- tek sahne / tek hareket mantığı
- karmaşık post-prod gerektirmeyen basit video hattı

---

## 8. Üretim Modları

### 8.1 Retouch Mode
Amaç: Ürünü teknik olarak temiz ve satışa hazır hale getirmek.

Özellikler:
- background removal
- pure white background
- transparent background
- soft luxury shadow background
- metal color balancing
- diamond brilliance balancing
- edge cleanup / anti-aliasing
- geometry-preserving cleanup

Beklenen çıktı:
- e-ticaret ana görseli
- katalog kullanımı için temiz PNG/WebP/JPG

### 8.2 Ready Scene Mode
Amaç: Ürünü hazır premium sahnelerde sunmak.

Özellikler:
- scene library
- product-to-scene matching
- realistic shadow and scale adaptation
- luxury background families

Örnek sahneler:
- black velvet
- white marble
- champagne satin
- mediterranean stone
- soft sand luxury
- reflective black luxury
- minimalist white podium

### 8.3 Reference Fusion Mode
Amaç: Kullanıcının yüklediği referans görseli analiz edip, ürününü bu referansla uyumlu biçimde sergilemek.

Bu mod, sistemin ayrıştırıcı özelliğidir.

Kullanıcı referans görsel olarak şunları yükleyebilmelidir:
- editöriyal kampanya fotoğrafı
- model portresi
- sahne görseli
- moda çekimi
- obje kompozisyonu
- katalog stili referansı

Sistem referans görseli şu açıdan analiz etmelidir:
- kompozisyon tipi
- kadraj türü
- ortam / mekan
- ışık tipi
- renk paleti
- stil yoğunluğu
- kamera yaklaşımı
- model varlığı / yokluğu
- kıyafet dili
- lüks / minimal / resort / gala / wedding gibi mood sınıfı

Sonra ürünü bu referansla üç farklı stratejiden biriyle birleştirmelidir:
1. **Style Transfer Guidance** – referansın ışık, ton, mood ve kadraj dilini alma
2. **Scene Rebuild** – referanstaki kompozisyonun benzerini ürünle yeniden kurma
3. **Reference Merge / Placement** – referans görsel içindeki yapıya ürünü entegre etme

Kural:
- ürün, referansın içinde kaybolmamalı
- referans, ürün sadakatini bozmamalı
- ürün geometri ve metal dili korunmalı

### 8.4 Model Showcase Mode
Amaç: Ürünü model üzerinde doğru anatomik yerleşimle göstermek.

Özellikler:
- ready model DNA selection
- future support for user-specific character DNA
- product-type aware placement
- visibility-safe composition
- pose family selection
- identity consistency across outputs

### 8.5 Experience Mode
Amaç: Ürünü atmosfer ve hikâye ile yaşatmak.

Özellikler:
- mood-based scenes
- editorial direction
- story framing
- body language guidance
- luxury campaign feeling
- reference-guided experience variation

Örnek deneyim aileleri:
- mediterranean sunset
- rooftop evening luxury
- wedding preparation mood
- gala elegance
- quiet luxury interior
- resort summer story

### 8.6 Basic Video Mode (MVP)
Amaç: Seçili görsel üretim sonucunu kısa video varyasyonuna dönüştürmek.

Özellikler:
- text-to-video yerine öncelikli olarak image-to-video akışı
- tek klip üretimi
- kısa süreli video
- hafif kamera hareketleri
- düşük karmaşıklıkta motion prompt
- ürünü bozmayan güvenli hareket dili

Örnek video tipleri:
- hafif kamera yaklaşması
- çok yavaş parallax
- yumuşak ışık geçişi
- çok hafif model head turn hissi
- takı üzerinde kısa premium reveal

### 8.7 Master Package
Amaç: Tek işlemde çoklu kullanım senaryosu üretmek.

Örnek paket:
- 1 retouch
- 1 ready scene
- 1 reference fusion output
- 1 model showcase hero
- 1 experience mode hero
- opsiyonel 1 kısa video
- 1 detail crop / alternate angle

Not: Teknik tarafta bu paket tek request ile başlatılsa da backend’de ayrı job’lar halinde işlenmelidir.

---

## 9. Kullanıcı Hikâyeleri

### 9.1 Retouch Kullanıcısı
Bir e-ticaret satıcısı olarak, yüklediğim yüzüğün arka planını temizleyip beyaz fonda satışa hazır görsel almak istiyorum; böylece ürünü sitede hızlıca yayınlayabilirim.

### 9.2 Sahne Kullanıcısı
Bir marka yöneticisi olarak, aynı kolyeyi farklı lüks sahnelerde görmek istiyorum; böylece web banner ve sosyal medya için hızlı sunumlar hazırlayabilirim.

### 9.3 Referans Kullanan Kullanıcı
Bir kreatif kullanıcı olarak, beğendiğim bir referans görseli yükleyip kendi ürünümü o görselin ışığı, kompozisyonu veya atmosferiyle sergilemek istiyorum; böylece istediğim estetik doğrultusunda kontrollü üretim alabilirim.

### 9.4 Model Kullanıcısı
Bir takı markası olarak, ürünlerimi aynı model kimliği üzerinde göstermek istiyorum; böylece koleksiyon içinde tutarlı bir kampanya dili oluşturabilirim.

### 9.5 Deneyim Kullanıcısı
Bir pazarlama ekibi olarak, ürünün yalnızca takılmış halini değil, bir yaşam anı içinde hissettiren editöriyal görseller istiyorum; böylece premium marka algısını yükseltebilirim.

### 9.6 Set Kullanıcısı
Bir mücevher satıcısı olarak, kolye ve küpeyi aynı model üzerinde set halinde görmek istiyorum; böylece müşteriye takım etkisini sunabilirim.

### 9.7 Video Kullanıcısı
Bir sosyal medya ekibi olarak, ürettiğim premium görseli kısa bir videoya çevirmek istiyorum; böylece Reels, story veya reklam için hızlı video içerik alabilirim.

---

## 10. Fonksiyonel Gereksinimler

### 10.1 Ürün Yükleme
Sistem şunları desteklemelidir:
- tekli ürün yükleme
- çoklu ürün yükleme
- set ilişkisi tanımlama
- kabul edilen formatlar: JPG, PNG, WEBP
- minimum kalite kontrolü

Kurallar:
- düşük çözünürlüklü görseller işaretlenmeli
- bulanık veya ağır noise içeren görseller için uyarı verilmeli

### 10.2 Referans Görsel Yükleme
Sistem referans görsel yüklemeyi desteklemelidir.

Desteklenen kullanım türleri:
- style reference
- scene reference
- model reference
- campaign reference
- composition reference

Sistem referans görsel için şunları üretmelidir:
- reference_analysis_json
- reference_type
- mood_tags
- lighting_summary
- composition_summary
- color_palette_summary
- model_presence_flag

### 10.3 Product Analyzer
Sistem yüklenen ürün için analiz üretmelidir.

Zorunlu alanlar:
- product_type
- category
- metal_color
- dominant_shape
- stone_presence
- stone_layout_summary
- set_relation
- complexity_score

Desteklenen ürün tipleri:
- ring
- earring
- necklace
- bracelet
- set

### 10.4 Reference Analyzer
Sistem referans görseli yapısal olarak analiz etmelidir.

Önerilen alanlar:
- reference_type
- environment_type
- composition_type
- light_type
- color_palette
- wardrobe_style
- mood_class
- camera_perspective
- subject_presence
- subject_pose_summary
- luxury_intensity_score
- reusability_strategy

### 10.5 Model Yönetimi
Sistem aşağıdakileri desteklemelidir:
- hazır model DNA kütüphanesi
- model önizleme kartları
- model persona etiketleri
- aynı model ile tekrar üretim

MVP’de kullanıcı kendi modelini oluşturmasa bile, sistem seçilen modelin kimliğini sabit tutmalıdır.

### 10.6 Sahne Yönetimi
Sistem hazır sahne kütüphanesi sunmalıdır.

Her sahne için metadata bulunmalıdır:
- scene_name
- category_group
- background_material
- light_type
- mood
- wardrobe_hint
- compatible_product_types
- compatible_modes

### 10.7 Üretim Başlatma
Kullanıcı şu seçimleri yapabilmelidir:
- üretim modu
- model seçimi
- sahne seçimi
- referans görsel seçimi
- referans kullanım stratejisi
- oran seçimi
- çıktı paketi seçimi
- çözünürlük seçimi

### 10.8 Job Tracking
Sistem üretim sırasında şunları göstermelidir:
- queued
- analyzing_product
- analyzing_reference
- composing_prompt
- generating
- qc_check
- completed
- failed

### 10.9 Galeri
Her kullanıcı için üretim galerisi bulunmalıdır.

Galeri filtreleri:
- ürün
- mod
- model
- sahne
- referans kullanıldı mı
- video / görsel
- tarih
- set / tekli

### 10.10 Set Desteği
Sistem ilişkili ürünleri set olarak işleyebilmelidir.

Kurallar:
- kolye + küpe
- küpe + yüzük
- tam set
- aynı metal dili ve stilde ilişkilendirme
- tek model üzerinde birlikte sunum

### 10.11 Video Üretimi
MVP’de video üretim akışı desteklenmelidir.

İlk versiyon için kapsam:
- mevcut üretilmiş görselden image-to-video akışı
- basit motion templates
- 1 video = 1 sahne
- sınırlı süre
- yeniden işlenebilir job yapısı

### 10.12 Admin Panel
Admin panel aşağıdakileri desteklemelidir:
- sahne ekleme / güncelleme
- model kütüphanesi yönetimi
- prompt template versiyonlama
- başarısız job inceleme
- QC skor takibi
- kullanım maliyeti takibi
- referans stratejileri yönetimi
- video motion preset yönetimi

---

## 11. Non-Functional Requirements

### 11.1 Performans
- tekli üretim job’ları asenkron çalışmalı
- kullanıcı arayüzü job tamamlanana kadar bloklanmamalı
- önizleme ve final çıktı ayrıştırılabilmeli
- büyük paket üretimleri sıraya alınmalı
- video job’ları görsel job’larından ayrı sırada işlenmeli

### 11.2 Ölçeklenebilirlik
- sistem yüzlerce ürün ve çoklu job yükünü kaldırabilmeli
- job queue yatay büyümeye uygun tasarlanmalı
- image generation, reference analysis, video generation ve QC bağımsız worker’lar üzerinden çalışabilmeli

### 11.3 Güvenilirlik
- failed job retry mekanizması olmalı
- timeout yönetimi olmalı
- kısmi üretimlerde durum kaydı tutulmalı

### 11.4 Gözlemlenebilirlik
- job logları tutulmalı
- prompt versiyonu saklanmalı
- referans analiz çıktısı saklanmalı
- hata nedenleri raporlanmalı
- model / sahne / ürün / referans bazlı performans izlenmeli

### 11.5 Kalite
- ürün görünürlüğü düşük çıktılar işaretlenmeli
- model üzerindeki ürün deformasyonu QC tarafından tespit edilebilmeli
- aşırı sparkle / fake gloss / crop hatası gibi problemler kalite skoruna yansıtılmalı
- referans baskınlığı nedeniyle ürün kaybı yaşanıyorsa çıktı işaretlenmeli
- video çıktılarında temporal bozulma minimum seviyede tutulmalı

---

## 12. Sistem Mimarisi

### 12.1 Üst Seviye Akış
```text
Product Upload
   ↓
Reference Upload (optional)
   ↓
Product Analysis
   ↓
Reference Analysis
   ↓
Mode Selection
   ↓
Identity / Scene / Reference Strategy Resolution
   ↓
Prompt Composition
   ↓
Job Queue
   ↓
Image Generation Worker
   ↓
Quality Control
   ↓
Optional Video Worker
   ↓
Storage + Gallery
```

### 12.2 Ana Servisler

#### A. Upload Service
- dosya alımı
- temel validasyon
- storage kaydı

#### B. Product Analysis Service
- ürün tipi ve özellik analizi
- set eşleme yardımı
- analysis_json üretimi

#### C. Reference Analysis Service
- referans tipini anlama
- referans metadata çıkarma
- uygun fusion stratejisini önerme

#### D. Identity Service
- model DNA seçimi
- model metadata yönetimi
- tutarlılık için identity payload çözümleme

#### E. Scene Service
- sahne metadata çekme
- mod uyumluluğu kontrolü
- öneri sistemi

#### F. Prompt Composer Service
- prompt bloklarını birleştirme
- mode-specific structured prompt üretme
- reference fusion logic ekleme
- negative prompt ekleme
- version tagging

#### G. Generation Orchestrator
- job oluşturma
- alt job’lara ayırma
- worker yönlendirme

#### H. Image Generation Worker
- Nano Banana 2 ana akış
- gerektiğinde Nano Banana Pro fallback / premium akış

#### I. Video Generation Worker
- Veo 3.1 ile kısa video üretimi
- image-to-video pipeline

#### J. QC Service
- ürün görünürlüğü denetimi
- potansiyel deformasyon kontrolü
- minimal kalite skorlaması

#### K. Gallery Service
- çıktı kaydı
- etiketleme
- filtreleme
- favorileme

---

## 13. Veritabanı Şeması

### 13.1 users
- id
- email
- full_name
- plan_type
- credits_balance
- created_at

### 13.2 products
- id
- user_id
- original_image_url
- product_type
- category
- set_group_id
- analysis_json
- status
- created_at

### 13.3 product_sets
- id
- user_id
- set_name
- metal_family
- style_family
- created_at

### 13.4 references
- id
- user_id
- original_image_url
- reference_type
- analysis_json
- mood_tags
- status
- created_at

### 13.5 user_models
- id
- user_id (nullable for system default models)
- model_name
- persona_tags
- dna_json
- preview_image_url
- is_active
- created_at

### 13.6 scenes
- id
- scene_name
- category_group
- prompt_base
- metadata_json
- is_active
- created_at

### 13.7 generation_jobs
- id
- user_id
- product_id
- set_group_id
- reference_id
- job_mode
- requested_package
- model_id
- scene_id
- status
- progress
- error_message
- prompt_version
- image_model_name
- video_model_name
- created_at
- updated_at

### 13.8 generation_job_items
- id
- job_id
- item_type
- pose_key
- motion_key
- status
- worker_attempt_count
- output_image_id
- output_video_id
- created_at

### 13.9 images
- id
- user_id
- product_id
- set_group_id
- reference_id
- model_id
- scene_id
- image_type
- mode
- output_url
- preview_url
- resolution
- qc_score
- prompt_snapshot_json
- created_at

### 13.10 videos
- id
- user_id
- product_id
- reference_id
- source_image_id
- mode
- output_url
- duration_seconds
- resolution
- motion_preset
- qc_score
- prompt_snapshot_json
- created_at

### 13.11 prompt_templates
- id
- mode
- version
- template_json
- image_model_name
- video_model_name
- is_active
- created_at

### 13.12 qc_reports
- id
- asset_type
- image_id
- video_id
- visibility_score
- fidelity_score
- artifact_score
- temporal_score
- notes_json
- created_at

---

## 14. API Taslağı

### 14.1 Upload Product
**POST /products/upload**
Amaç: ürün görseli yüklemek

Response:
- product_id
- upload_status
- preview_url

### 14.2 Upload Reference
**POST /references/upload**
Amaç: referans görsel yüklemek

Response:
- reference_id
- upload_status
- preview_url

### 14.3 Analyze Product
**POST /products/{id}/analyze**
Amaç: ürün analizi başlatmak

Response:
- analysis_status
- analysis_json

### 14.4 Analyze Reference
**POST /references/{id}/analyze**
Amaç: referans analizi başlatmak

Response:
- analysis_status
- analysis_json

### 14.5 List Models
**GET /models**
Amaç: kullanılabilir model kütüphanesini döndürmek

### 14.6 List Scenes
**GET /scenes?mode=experience**
Amaç: moda uygun sahneleri döndürmek

### 14.7 Create Generation Job
**POST /generations**
Request body:
- product_ids
- mode
- package_type
- model_id
- scene_id
- reference_id
- reference_strategy
- output_ratio
- resolution
- with_video

Response:
- job_id
- status

### 14.8 Get Job Status
**GET /generations/{job_id}**
Response:
- status
- progress
- items
- failures

### 14.9 List Gallery
**GET /gallery**
Filtreler:
- product_id
- mode
- model_id
- scene_id
- reference_id
- asset_type
- date_range

### 14.10 Admin Prompt Templates
**GET /admin/prompt-templates**
**POST /admin/prompt-templates**
**PATCH /admin/prompt-templates/{id}**

---

## 15. Prompt Mimarisi Gereksinimleri
Sistem prompt’ları düz, serbest metin olarak değil; yapısal bloklar halinde yönetmelidir.

Prompt blokları:
- task block
- product fidelity block
- identity lock block
- scene block
- reference block
- reference fusion strategy block
- pose block
- camera block
- lighting block
- styling constraints block
- motion block (video için)
- negative prompt block

Kural:
- her mod için ayrı template ailesi olmalı
- prompt versioning zorunlu olmalı
- prompt snapshot her image/video kaydında saklanmalı

### 15.1 Reference Fusion Prompt Kuralları
- referansın stilini al, ürünü bozma
- referansın kadrajını taklit et, ürünü görünmez yapma
- referans modelini birebir kopyalamaya çalışma; gerekiyorsa scene ve mood çıkarımı yap
- kullanıcı referansı scene ise, ürün placement öncelikli olsun
- kullanıcı referansı model fotoğrafı ise, identity ve wardrobe ayrıştırılsın

### 15.2 Video Prompt Kuralları
- hareket dili düşük riskli olmalı
- ürün deformasyonuna neden olacak hızlı hareketlerden kaçınılmalı
- kısa, premium, loop’a uygun motion preset’ler kullanılmalı

---

## 16. Kalite Kontrol Gereksinimleri
MVP QC aşağıdaki sinyalleri değerlendirmelidir:
- ürün görünürlüğü yeterli mi
- ürün crop ile kesilmiş mi
- saç veya kumaş ürünü kapatıyor mu
- küpe çiftlenme / yanlış yerleşim var mı
- kolye anatomik olarak mantıklı noktada mı
- ürün aşırı büyümüş mü / küçülmüş mü
- sparkle yapay seviyede mi
- metal rengi belirgin şekilde kaymış mı
- referans görsel baskın gelip ürünü geri plana mı itmiş
- videoda frame-to-frame tutarlılık bozulmuş mu

QC sonucu:
- pass
- soft_warning
- fail_regenerate

---

## 17. Önerilen UI Akışı

### 17.1 Basit Akış
1. ürün yükle
2. mod seç
3. model / sahne / referans seç
4. üret
5. galeriye kaydet

### 17.2 Gelişmiş Akış
1. ürün yükle
2. referans yükle (opsiyonel)
3. analiz sonucu göster
4. set ilişkisini düzenle
5. model seç
6. sahne seç
7. referans kullanım stratejisi seç
8. paket seç
9. oran / çözünürlük seç
10. video ekle seçeneği
11. üretimi başlat
12. job progress izle
13. sonuçları karşılaştır

### 17.3 Sonuç Ekranı
Kullanıcı şunları yapabilmeli:
- favorile
- tekrar üret
- benzer varyasyon iste
- videoya çevir
- indir
- paket halinde indir

---

## 18. MVP Tanımı
MVP’de aşağıdakiler bulunmalıdır:
- ürün yükleme
- referans yükleme
- ürün analizi
- referans analizi
- retouch mode
- ready scene mode
- reference fusion mode
- ready model showcase mode
- sınırlı experience mode
- temel kısa video mode
- job queue
- galeri
- admin panel temel yönetimi
- temel QC

MVP’de olmayabilecekler:
- kullanıcı özel karakter oluşturma
- çok gelişmiş otomatik set önerileri
- çok klipli video kurgu
- AR
- bulk enterprise ingestion

---

## 19. V2 Yol Haritası
V2’de eklenebilecekler:
- kullanıcıya özel model DNA oluşturma
- marka bazlı scene packs
- bulk CSV / katalog yükleme
- enterprise campaign workflow
- team collaboration
- A/B prompt testing
- otomatik en iyi çıktı seçimi
- first/last frame kontrollü gelişmiş video üretimi
- referans bazlı ileri düzey campaign cloning guardrails

Google dokümantasyonunda Veo’nun first/last frame tabanlı video akışlarını da destekleyen varyantları yer alır; bu yapı V2’de kontrollü video continuity için değerlendirilebilir. ([docs.cloud.google.com](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/generate-videos-from-first-and-last-frames?utm_source=chatgpt.com))

---

## 20. Riskler ve Teknik Notlar

### Risk 1 – Ürün Sadakati Kaybı
Çözüm:
- structured prompting
- product analysis
- QC fidelity scoring

### Risk 2 – Model Drift
Çözüm:
- identity lock
- sabit model DNA payload
- scene değişse de kimlik değişmemeli

### Risk 3 – Reference Overpower
Çözüm:
- reference analysis
- explicit fusion strategy
- product priority scoring
- QC visibility gate

### Risk 4 – Worker Limit / Memory Crash
Çözüm:
- master package alt job’lara bölünmeli
- tek worker’da çoklu ağır üretim yapılmamalı
- preview ve final ayrı pipeline olabilir
- video worker ayrı tutulmalı

### Risk 5 – Düşük Kaliteli Girdi
Çözüm:
- upload validation
- kullanıcıya kalite uyarısı
- optional pre-enhancement pipeline

### Risk 6 – Set Sunumunda Uyumsuzluk
Çözüm:
- set metadata
- ortak metal / stil bilgisi
- set-specific composition templates

### Risk 7 – Video Temporal Hataları
Çözüm:
- basit motion preset’lerle başlama
- image-to-video önceliklendirme
- kısa süreli klipler
- düşük riskli kamera hareketleri

---

## 21. Başarı Metrikleri

### Ürün Kalitesi
- QC pass rate
- regenerate rate
- visibility failure rate
- reference fusion acceptance rate

### Kullanım Metrikleri
- upload-to-generate conversion
- mode usage distribution
- reference upload usage rate
- repeat generation rate
- gallery save/download rate
- image-to-video conversion rate

### Ticari Metrikler
- kullanıcı başına üretilen görsel sayısı
- paket bazlı kullanım oranı
- paid conversion
- enterprise usage potential

---

## 22. Yazılım Ekibi İçin Son Teknik Yönlendirme
Bu platform, prompt tabanlı tekil görsel üretim sistemi olarak değil; **ürün analizi, referans analizi, kimlik yönetimi, sahne orkestrasyonu, kuyruk tabanlı üretim ve kalite kontrol katmanlarından oluşan modüler bir görsel üretim altyapısı** olarak geliştirilmelidir.

Temel prensipler:
- ürün sadakati korunmalı
- referans görsel kontrollü şekilde çözümlenmeli
- model kimliği tutarlı kalmalı
- üretim modüler olmalı
- ağır paketler alt job’lara bölünmeli
- görsel ve video işleri ayrıştırılmalı
- tüm çıktılar izlenebilir ve versiyonlanabilir olmalı

---

## 23. Tek Cümlelik Ürün Tanımı
TryOnJewel; mücevher ürünlerini teknik retouch, premium hazır sahneler, kullanıcı referans görseliyle yönlendirilen fusion akışları, tutarlı model sunumu, hikâye odaklı yaşayan deneyim modları ve temel kısa video üretimiyle çoklu kullanım senaryolarına dönüştüren, kuyruk tabanlı ve kalite kontrollü bir görsel üretim platformudur.

---

## 24. Yazılım Ekibine Teslim Özeti
Sistem aşağıdaki çekirdek akışları destekleyecek şekilde geliştirilecektir:
- ürün yükleme ve ürün analizi
- referans yükleme ve referans analizi
- Nano Banana 2 tabanlı ana görsel üretim hattı
- gerektiğinde Nano Banana Pro destekli yüksek sadakatli üretim hattı
- Veo 3.1 tabanlı basit image-to-video MVP hattı
- retouch, ready scene, reference fusion, model showcase, experience ve master package modları
- job queue, QC, galeri, admin panel ve versiyonlanmış prompt sistemi

Bu yaklaşım, kullanıcıya yalnızca ürün görseli değil; sahnelenmiş sunum, model üstü deneyim, referans kontrollü stil uyarlaması ve kısa video içeriği üreten tam bir yaratıcı üretim altyapısı sağlayacaktır.

---

## 25. Engineering Handoff Paketi
Bu bölüm, ürün dokümanını doğrudan implementasyona çevirmek için yazılım ekibine verilecek operasyonel teslim planıdır.

### 25.1 Teslim Paketleri
Ekip çalışması aşağıdaki 6 ana teslim paketine bölünmelidir:

1. Frontend uygulama ekranları
2. Backend servisleri
3. Veritabanı ve storage şeması
4. Queue / worker orkestrasyonu
5. Admin paneli
6. QA / QC / gözlemlenebilirlik katmanı

---

## 26. Frontend Ekran Listesi

### 26.1 Auth ve Hesap
- login
- register
- forgot password
- plan / credits görünümü

### 26.2 Dashboard
Amaç: Kullanıcıya genel üretim akışını başlatabileceği giriş noktası sunmak.

Bileşenler:
- yeni ürün yükle CTA
- referans yükle CTA
- son üretimler
- kalan kredi
- hızlı mod kartları
  - Retouch
  - Ready Scene
  - Reference Fusion
  - Model Showcase
  - Experience
  - Video

### 26.3 Product Upload Page
Alanlar:
- ürün görsel yükleme alanı
- çoklu ürün desteği
- set olarak grupla seçeneği
- kalite uyarı alanı
- ürün önizlemesi

Durumlar:
- upload idle
- uploading
- success
- low quality warning
- failed

### 26.4 Reference Upload Page
Alanlar:
- referans görsel yükleme
- referans tipi seçimi (opsiyonel, sistem auto-detect de yapabilir)
- kullanım amacı seçimi
  - style
  - scene
  - campaign
  - model
  - composition
- önizleme alanı
- referans analiz sonucu özeti

### 26.5 Product Analysis Review Screen
Amaç: Sistem analizinin kullanıcı tarafından görülmesi ve gerektiğinde düzenlenmesi.

Gösterilecek alanlar:
- product type
- metal color
- dominant shape
- stone layout summary
- set relation
- complexity score

Kullanıcı aksiyonları:
- onayla
- düzelt
- yeniden analiz et

### 26.6 Reference Analysis Review Screen
Gösterilecek alanlar:
- reference type
- environment type
- light type
- mood class
- composition type
- color palette summary
- subject presence
- önerilen fusion strategy

Kullanıcı aksiyonları:
- onayla
- başka strateji seç
- referansı değiştir

### 26.7 Generation Builder Screen
Bu ekran MVP’nin ana iş ekranı olmalıdır.

Seçim alanları:
- ürün seçimi
- set seçimi
- mod seçimi
- model seçimi
- sahne seçimi
- referans seçimi
- reference strategy seçimi
- pose family seçimi
- output ratio
- resolution
- video eklensin mi toggle
- package type

Sağ panel:
- özet konfigürasyon kartı
- tahmini kredi kullanımı
- oluşturulacak çıktı listesi

### 26.8 Job Progress Screen
Gösterilecekler:
- job genel durumu
- alt item listesi
- item bazlı progress
- failed item bilgisi
- retry butonu

### 26.9 Gallery Screen
Sekmeler:
- all
- images
- videos
- favorites
- sets

Filtreler:
- ürün
- mod
- model
- sahne
- referans
- tarih
- asset type

Aksiyonlar:
- önizle
- indir
- yeniden üret
- videoya çevir
- benzer varyasyon iste
- favorile

### 26.10 Asset Detail Page
Gösterilecekler:
- ana asset preview
- üretim metadata
- kullanılan ürünler
- kullanılan model
- kullanılan sahne
- kullanılan referans
- QC sonucu
- prompt version

### 26.11 Admin Panel Ekranları
- scene management
- model library
- prompt templates
- motion presets
- job monitor
- QC monitor
- cost monitor
- failure logs

---

## 27. Frontend Bileşen Backlog’u

### Kritik Bileşenler
- file uploader
- image grid
- reference inspector card
- model selector card
- scene selector carousel
- package selector
- progress tracker
- job item status list
- asset comparison modal
- qc badge
- retry action bar

### Tasarım İlkeleri
- üretim akışı tek ekranda boğucu olmamalı
- basit kullanıcı için hızlı mod, ileri kullanıcı için detay mod olmalı
- referans kullanımı net anlaşılmalı
- kullanıcı neyin üretileceğini üretim öncesi görmeli

---

## 28. Backend Servis Listesi

### 28.1 Auth Service
Sorumluluklar:
- kullanıcı kimlik doğrulama
- oturum yönetimi
- plan ve kredi erişimi

### 28.2 Product Service
Sorumluluklar:
- ürün upload
- product CRUD
- set gruplama
- ürün metadata yönetimi

### 28.3 Reference Service
Sorumluluklar:
- referans upload
- referans CRUD
- referans analiz lifecycle yönetimi

### 28.4 Analysis Service
Alt modüller:
- product analyzer
- reference analyzer

Sorumluluklar:
- görsel analiz çağrıları
- analysis_json üretimi
- analiz validasyonu
- yeniden analiz akışı

### 28.5 Model Library Service
Sorumluluklar:
- sistem modelleri
- kullanıcı modelleri (V2)
- persona etiketleri
- model metadata

### 28.6 Scene Service
Sorumluluklar:
- sahne kütüphanesi
- sahne filtreleme
- moda göre sahne döndürme

### 28.7 Prompt Composer Service
Sorumluluklar:
- mode-specific prompt oluşturma
- reference fusion mantığını uygulama
- motion prompt üretimi
- prompt snapshot saklama

### 28.8 Generation Service
Sorumluluklar:
- generation request kabul etme
- job oluşturma
- alt item’lara bölme
- doğru worker’a dispatch etme

### 28.9 Image Generation Service
Sorumluluklar:
- Nano Banana 2 çağrıları
- premium akışta Nano Banana Pro çağrıları
- çıktı normalization

### 28.10 Video Generation Service
Sorumluluklar:
- Veo 3.1 çağrıları
- image-to-video lifecycle
- video job status polling

### 28.11 QC Service
Sorumluluklar:
- görsel kalite skoru
- video kalite skoru
- regenerate kararı

### 28.12 Gallery Service
Sorumluluklar:
- asset listeleme
- filtreleme
- favori yönetimi
- paket indirme

### 28.13 Admin Service
Sorumluluklar:
- scene yönetimi
- prompt template yönetimi
- model library yönetimi
- cost / usage / logs görünürlüğü

---

## 29. Servisler Arası Teknik Akış

### 29.1 Görsel Üretim Akışı
```text
Frontend Request
   ↓
Generation API
   ↓
Create generation_job
   ↓
Create generation_job_items
   ↓
Queue dispatch
   ↓
Image Worker
   ↓
QC Worker
   ↓
Persist image
   ↓
Update job status
```

### 29.2 Referanslı Üretim Akışı
```text
Reference uploaded
   ↓
Reference Analyzer
   ↓
analysis_json saved
   ↓
Generation Builder selects strategy
   ↓
Prompt Composer injects reference block
   ↓
Image Worker
   ↓
QC checks product visibility vs reference dominance
```

### 29.3 Video Üretim Akışı
```text
Source image selected
   ↓
Create video job item
   ↓
Video Worker
   ↓
Veo request submit
   ↓
Polling / callback status sync
   ↓
Video QC
   ↓
Persist video
```

---

## 30. SQL Seviyesinde Önerilen Şema Taslağı
Aşağıdaki yapı MVP için yeterli başlangıç omurgasıdır.

### 30.1 products
```sql
create table products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  original_image_url text not null,
  product_type text,
  category text,
  set_group_id uuid,
  analysis_json jsonb,
  status text default 'uploaded',
  created_at timestamptz default now()
);
```

### 30.2 references
```sql
create table references (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  original_image_url text not null,
  reference_type text,
  analysis_json jsonb,
  mood_tags text[],
  status text default 'uploaded',
  created_at timestamptz default now()
);
```

### 30.3 user_models
```sql
create table user_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  model_name text not null,
  persona_tags text[],
  dna_json jsonb not null,
  preview_image_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

### 30.4 scenes
```sql
create table scenes (
  id uuid primary key default gen_random_uuid(),
  scene_name text not null,
  category_group text,
  prompt_base text,
  metadata_json jsonb,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

### 30.5 generation_jobs
```sql
create table generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  product_id uuid,
  set_group_id uuid,
  reference_id uuid,
  job_mode text not null,
  requested_package text,
  model_id uuid,
  scene_id uuid,
  status text default 'queued',
  progress integer default 0,
  error_message text,
  prompt_version text,
  image_model_name text,
  video_model_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 30.6 generation_job_items
```sql
create table generation_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  item_type text not null,
  pose_key text,
  motion_key text,
  status text default 'queued',
  worker_attempt_count integer default 0,
  output_image_id uuid,
  output_video_id uuid,
  created_at timestamptz default now()
);
```

### 30.7 images
```sql
create table images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  product_id uuid,
  set_group_id uuid,
  reference_id uuid,
  model_id uuid,
  scene_id uuid,
  image_type text,
  mode text,
  output_url text not null,
  preview_url text,
  resolution text,
  qc_score numeric,
  prompt_snapshot_json jsonb,
  created_at timestamptz default now()
);
```

### 30.8 videos
```sql
create table videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  product_id uuid,
  reference_id uuid,
  source_image_id uuid,
  mode text,
  output_url text not null,
  duration_seconds integer,
  resolution text,
  motion_preset text,
  qc_score numeric,
  prompt_snapshot_json jsonb,
  created_at timestamptz default now()
);
```

### 30.9 qc_reports
```sql
create table qc_reports (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null,
  image_id uuid,
  video_id uuid,
  visibility_score numeric,
  fidelity_score numeric,
  artifact_score numeric,
  temporal_score numeric,
  notes_json jsonb,
  created_at timestamptz default now()
);
```

---

## 31. API Request / Response Örnekleri

### 31.1 POST /generations
Request:
```json
{
  "product_ids": ["prod_1"],
  "mode": "reference_fusion",
  "package_type": "master",
  "model_id": "model_3",
  "scene_id": "scene_8",
  "reference_id": "ref_12",
  "reference_strategy": "scene_rebuild",
  "output_ratio": "4:5",
  "resolution": "2k",
  "with_video": true
}
```

Response:
```json
{
  "job_id": "job_987",
  "status": "queued",
  "items_count": 6
}
```

### 31.2 GET /generations/{job_id}
Response:
```json
{
  "job_id": "job_987",
  "status": "generating",
  "progress": 42,
  "items": [
    {
      "id": "item_1",
      "type": "image",
      "mode": "retouch",
      "status": "completed"
    },
    {
      "id": "item_2",
      "type": "image",
      "mode": "reference_fusion",
      "status": "running"
    },
    {
      "id": "item_3",
      "type": "video",
      "mode": "basic_video",
      "status": "queued"
    }
  ]
}
```

### 31.3 GET /gallery
Response:
```json
{
  "items": [
    {
      "asset_id": "img_551",
      "asset_type": "image",
      "mode": "model_showcase",
      "preview_url": "...",
      "qc_score": 0.91,
      "created_at": "2026-03-26T12:00:00Z"
    },
    {
      "asset_id": "vid_101",
      "asset_type": "video",
      "mode": "basic_video",
      "preview_url": "...",
      "qc_score": 0.83,
      "created_at": "2026-03-26T12:05:00Z"
    }
  ]
}
```

---

## 32. Queue ve Worker Tasarımı

### 32.1 Queue Türleri
Ayrı kuyruklar önerilir:
- analysis queue
- image generation queue
- video generation queue
- qc queue
- retry / dead letter queue

### 32.2 Worker Ayrımı
- product-analysis-worker
- reference-analysis-worker
- image-generation-worker
- video-generation-worker
- qc-worker

### 32.3 İşleme Kuralları
- master package tek parça işlenmemeli
- her çıktı ayrı job item olmalı
- retry sayısı sınırlandırılmalı
- fail olan item tüm job’ı düşürmemeli; partial completion desteklenmeli

### 32.4 Priority Mantığı
- paid users high priority
- video jobs lower priority than image jobs
- retouch jobs highest speed lane olabilir

---

## 33. Storage Yapısı
Önerilen bucket ayrımı:
- raw-products
- raw-references
- generated-images
- generated-videos
- previews
- admin-assets

Dosya isim mantığı:
- user_id / asset_type / date / uuid

Ek not:
- preview ve final asset ayrı tutulmalı
- video thumbnail’leri ayrıca üretilmeli

---

## 34. Admin Panel Backlog’u

### Faz 1
- scene CRUD
- prompt template CRUD
- job monitor
- failed jobs listesi
- qc rapor görünümü

### Faz 2
- model library yönetimi
- motion preset yönetimi
- cost dashboard
- regenerate from admin
- prompt version compare

### Faz 3
- reference strategy tuning panel
- model / scene performans analizi
- enterprise tenant yönetimi

---

## 35. Sprint Bazlı MVP Planı

### Sprint 1
- auth
- product upload
- reference upload
- temel dashboard
- products / references tabloları
- storage entegrasyonu

### Sprint 2
- product analyzer
- reference analyzer
- analysis review screens
- generation builder ilk sürüm

### Sprint 3
- retouch mode
- ready scene mode
- image generation worker
- gallery ilk sürüm

### Sprint 4
- reference fusion mode
- model showcase mode
- job tracking
- qc ilk sürüm

### Sprint 5
- experience mode
- master package orchestration
- admin panel faz 1

### Sprint 6
- basic video mode
- video worker
- gallery video desteği
- performans ve hata iyileştirme

---

## 36. Teknik Öncelik Kararları
Ekip ilk aşamada şu konulara öncelik vermelidir:

1. Ürün sadakati
2. Stabil queue yapısı
3. Referans analizinin doğru tasarımı
4. Prompt versioning
5. Galeri ve asset yönetimi
6. Video değil, önce güçlü görsel pipeline

Sebep:
Video katmanı güçlü görsel pipeline olmadan kalite üretmez. Önce image hattı güvenilir olmalıdır.

---

## 37. Açık Teknik Kararlar
Yazılım ekibinin proje başında netleştirmesi gereken başlıklar:
- auth sağlayıcısı
- queue teknolojisi
- worker deployment modeli
- callback mı polling mi kullanılacağı
- rate limit / quota yönetimi
- credit consumption mantığı
- preview ile final asset çözünürlük farkı
- premium generation hangi koşullarda Nano Banana Pro’ya yönlenecek
- video üretimi kullanıcıya ayrı kredi mi yazacak

---

## 38. Nihai Handoff Notu
Bu doküman yalnızca ürün vizyonu değil, aynı zamanda MVP’yi ayağa kaldıracak uygulama iskeletini tanımlar. Ekip, implementasyona geçerken modülerliği korumalı, üretimi alt işlere bölmeli ve özellikle referans-fusion ile ürün sadakati arasındaki dengeyi sistem seviyesi kural olarak ele almalıdır.

Başarılı bir ilk sürüm için esas hedef; kullanıcıya çok fazla serbestlik verip kaliteyi dağıtmak değil, sınırlı ama kontrollü modlarla yüksek kaliteli, tekrarlanabilir ve ticari değeri olan çıktılar üretmektir.

