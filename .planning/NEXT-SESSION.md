# Sonraki Oturum — Karakter DNA Genişletme (Aşama 1)

## Özet
Phase 1 (Security Hardening) tamamlandı. Şimdi karakter sistemi geliştirme başlıyor.

## Sıradaki İş: Karakter DNA Genişletme

### 1. DB Migration
`supabase/migrations/20260301100000_character_dna_expansion.sql`:
```sql
ALTER TABLE user_models
  ADD COLUMN IF NOT EXISTS body_proportions TEXT,
  ADD COLUMN IF NOT EXISTS makeup_style TEXT,
  ADD COLUMN IF NOT EXISTS eye_makeup TEXT,
  ADD COLUMN IF NOT EXISTS lip_color TEXT,
  ADD COLUMN IF NOT EXISTS skin_finish TEXT,
  ADD COLUMN IF NOT EXISTS distinctive_features JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS editorial_reference TEXT,
  ADD COLUMN IF NOT EXISTS jewelry_affinity TEXT;
```

### 2. API: generate-model.ts
- Satır 233: model ID → `gemini-3.1-flash-image-preview`
- `buildCharacterMasterData()` genişlet: makyaj, editöryal referans, mücevher afinitesi
- `buildAdvancedPrompt()` güncelle: yeni alanları al
- Handler'da: yeni alanları DB insert'e ekle
- Editöryal referans → renk bilimi + ışık direktifi mapping tablosu

### 3. UI: ModelCreator.tsx
Mevcut 4 bölüme ek 3 yeni bölüm:

**BÖLÜM: KARAKTER YAPISI (yeni)**
- bodyProportions: 'Manken Standart' | 'Uzun & İnce' | 'Orta Boy' | 'Petite'
- (omuz, boyun seçimleri isteğe bağlı)

**BÖLÜM: MAKYAJ & GÖRÜNÜM (yeni)**
- makeupStyle: No-Makeup | Editorial | Smoky & Dramatic | Nude Glow | Bold Lip
- eyeMakeup: Doğal | Eyeliner | Dramatik | Cut Crease
- lipColor: Nude | Berry | Red | Coral | Gloss
- skinFinish: Matte | Dewy | Satin | Bronzed

**BÖLÜM: EDİTÖRYAL KİMLİK (yeni)**
- editorialReference: Quiet Luxury | Avant-Garde | Classic Elegance | Modern Power | Mediterranean Warm | Minimalist Edge
- jewelryAffinity: Yüzük | Kolye | Küpe | Bilezlik | Genel

**AYIRT EDİCİ ÖZELLİKLER (opsiyonel, mevcut YÜZ bölümüne ekle)**
- browShape: İnce & Kemersiz | Doğal & Dolgun | Bold & Düz | Arch
- freckles: Yok | Hafif | Belirgin
- mole: seçenekler

### 4. ModelCreator.tsx: canGenerate güncelle
Yeni zorunlu alanlar: makeupStyle, editorialReference, jewelryAffinity
(bodyProportions opsiyonel, distinctiveFeatures tamamen opsiyonel)

### 5. ModelSelector.tsx / ModelGallery.tsx
Pose üretiminde yeni alanları modelData'ya ekle.

## Sonraki Adım (Aşama 2)
3 açı üretimi + Visual DNA — Aşama 1 tamamlandıktan sonra.

## Tamamlanan İşler (Bu Oturumda)
- GSD v1.22.0 kuruldu
- Codebase haritası: 7 doküman (.planning/codebase/)
- Planning dosyaları: PROJECT.md, config.json, REQUIREMENTS.md, ROADMAP.md, STATE.md
- Phase 1 Security Hardening: 4/4 plan tamamlandı
  - SEC-01: API key leak fix (check-video-status.ts)
  - SEC-02: Auth bypass fix (her iki video endpoint)
  - SEC-03: Atomic credit refund (generate-jewelry.ts)
  - SEC-04: Storage bucket private + generate-design.ts signed URL
- Model: gemini-3-pro → gemini-3.1-flash-image-preview (Nano Banana 2)
