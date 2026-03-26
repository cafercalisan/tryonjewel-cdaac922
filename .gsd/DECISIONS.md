# Architectural Decisions Register

## D001 — Backend Framework: NestJS
**Date:** 2026-03-26
**Context:** Mevcut Express backend tek dosyalarda 2600+ satırlık inline handler'larla çalışıyor. PRD 13+ servis modülü tanımlıyor.
**Decision:** Sıfırdan NestJS ile modüler backend kurulacak.
**Rationale:** NestJS module/service/controller yapısı PRD'deki servis ayrımına doğrudan map ediyor. DI container, guards, interceptors, pipes çıktı kalitesini artırır. Express'e patch yapmak mevcut spaghetti'yi daha da karıştırırdı.
**Tradeoff:** Migration süresi daha uzun, ancak mevcut kodun refactor edilemezliği göz önünde bulundurulunca net kazanç.

## D002 — Job Queue: BullMQ + Redis
**Date:** 2026-03-26
**Context:** PRD çoklu queue (analysis, image gen, video gen, QC, retry), priority, retry mekanizması ve partial completion gerektiriyor.
**Decision:** BullMQ + Redis kullanılacak.
**Rationale:** BullMQ priority queue, rate limiting, repeatable jobs, dead letter queue, dashboard (Bull Board) desteği veriyor. PostgreSQL SKIP LOCKED basit ama priority/retry/monitoring için yeterli değil.
**Tradeoff:** Redis ek infra maliyeti var ancak Hetzner'da minimal.

## D003 — İlk MVP Scope: 5 Temel Mod
**Date:** 2026-03-26
**Context:** PRD 7 mod tanımlıyor (Retouch, Scene, Reference Fusion, Model Showcase, Experience, Video, Master Package).
**Decision:** İlk milestone'da 5 mod: Retouch, Ready Scene, Reference Fusion, Model Showcase, Experience. Video ve Master Package sonraki milestone'da.
**Rationale:** PRD'nin "önce güçlü görsel pipeline" prensibi ile uyumlu. Video katmanı image hattı güvenilir olmadan kalite üretemez.

## D004 — Mevcut Auth Korunacak
**Date:** 2026-03-26
**Context:** JWT + bcrypt auth sistemi çalışıyor. users, profiles, user_roles tabloları mevcut.
**Decision:** Auth mantığı NestJS'e taşınacak, mevcut DB tabloları ve token formatı korunacak.
**Rationale:** Auth çalışıyor, kullanıcı kaybı olmamalı. NestJS Guard'ları ile sarmalamak yeterli.

## D005 — Gemini Model Stratejisi
**Date:** 2026-03-26
**Context:** PRD üç model tanımlıyor: Gemini 3.1 Flash (hız), Gemini 3 Pro Image (kalite), Veo 3.1 (video).
**Decision:** Retouch/Scene → Flash, Reference Fusion/Model Showcase/Experience → Pro Image, Video → Veo 3.1
**Rationale:** Flash yüksek hacimli basit işler için, Pro Image karmaşık kompozisyon ve referans-bazlı üretimler için. PRD'nin maliyet-kalite dengesi prensibiyle uyumlu.

## D006 — Prompt Mimarisi: Yapısal Bloklar
**Date:** 2026-03-26
**Context:** Mevcut sistemde prompt'lar inline string concat ile üretiliyor, versiyon takibi yok.
**Decision:** Prompt'lar yapısal bloklar (task, fidelity, identity, scene, reference, camera, lighting, negative) halinde compose edilecek, DB'de template olarak versiyonlanacak, her çıktıda snapshot saklanacak.
**Rationale:** PRD'nin Section 15 gereksinimleri. Ayrıca QC geri bildirimlerinin prompt iyileştirmesine bağlanması için zorunlu.

## D007 — Veritabanı Şeması: Kademeli Migrasyon
**Date:** 2026-03-26
**Context:** Mevcut DB'de images, processing_jobs, scenes, videos, user_models, brand_profiles tabloları var. PRD tamamen farklı bir şema tanımlıyor.
**Decision:** Yeni tablolar (products, references, product_sets, generation_jobs, generation_job_items, qc_reports, prompt_templates) eklenir. Eski tablolar geçiş dönemi boyunca korunur, veri migrate edilir, sonra silinir.
**Rationale:** Zero-downtime migration. Mevcut kullanıcı verisi kaybolmamalı.

## D008 — Frontend: Kademeli Sayfa Yeniden Yazımı
**Date:** 2026-03-26  
**Context:** Frontend React + shadcn/ui. 20 sayfa var ama çoğu monolitik ve mevcut backend'e sıkı bağlı.
**Decision:** Backend hazır olduktan sonra frontend sayfaları tek tek yeni API'lere bağlanarak yeniden yazılacak. shadcn/ui bileşenleri, layout, auth akışı korunacak.
**Rationale:** Önce backend sağlamlaştırılmalı, frontend backend'e bağlı.

## D009 — n8n Kaldırılması
**Date:** 2026-03-26
**Context:** M002'de n8n workflow engine deploy edilmişti. BullMQ + NestJS kararı ile n8n artık gereksiz.
**Decision:** n8n tüm codebase'den kaldırılacak: docker-compose servis tanımı, api/n8n-trigger.ts, n8n-workflows dizini, server.ts route kaydı, .env n8n değişkenleri.
**Rationale:** İki farklı orchestration mekanizması maintenance yükü. BullMQ + NestJS workers doğrudan kontrol, daha az dolaylı hop, daha az infra. n8n'in sağladığı hiçbir şey BullMQ + code ile yapılamaz değil.
