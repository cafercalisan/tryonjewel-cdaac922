

# MooreLabs 4K Gorsel Uretim, V2 Beta Model ve Veritabani Tasima Plani

## 1. Veritabani Tasima Durumu

Bu proje Lovable Cloud uzerinde calisiyor ve bir kez etkinlestirildikten sonra **baglantisi kesilemez**. Ancak su secenek mevcuttur:

- Lovable Cloud uzerindeki veritabanindaki mevcut tablolari (profiles, images, scenes, videos, processing_jobs, user_roles, user_models) kendi Supabase projenizden de okuyabilir/yazabilirsiniz. Bunun icin kendi Supabase projenize ayni semalari olusturup verileri aktarmaniz gerekir.
- **Onemli**: Edge Function'lar hala Lovable Cloud uzerinde calisacaktir. Tamamen bagimsiz bir Supabase projesine gecis icin projeyi export edip kendi ortaminizda deploy etmeniz gerekir.

Bu adim su an icin **planin disinda** tutulmustur. Once 4K ve V2 Beta sorunlarini cozelim, sonra veri tasima konusunu ayri ele alalim.

---

## 2. 4K Gorsel Uretim - Arka Plan Isleme Mimarisi

### Sorunun Temeli
Edge Function'lar 150MB RAM ve 2 saniye CPU limiti ile calisir. 4K gorsel (~20-30MB base64) bu limitleri asiyor.

### Cozum: EdgeRuntime.waitUntil() ile Asenkron Isleme

Mevcut `processing_jobs` tablosu zaten var ve bu mimari icin uygundur.

### Akis Diyagrami

```text
Kullanici                Edge Function              Arka Plan Islemi
   |                          |                          |
   |--- Uret istegi -------->|                          |
   |                          |-- Job kaydi olustur ---->|
   |                          |-- waitUntil(islem) ----->|
   |<-- jobId dondur --------|                          |
   |                          |                          |-- Gemini API cagir
   |--- Poll (2sn aralik) -->|                          |-- base64 al
   |<-- status: processing --|                          |-- Storage'a yukle
   |--- Poll ---------------->|                          |-- Job guncelle
   |<-- status: completed ---|                          |
   |--- Sonuclari goster     |                          |
```

### Degistirilecek Dosyalar

**`supabase/functions/generate-jewelry/index.ts`**
- Ana handler: Kredi dusumu + job olusturma + aninda jobId dondurme
- `EdgeRuntime.waitUntil()` icinde: Analiz + gorsel uretim + upload + job guncelleme
- `imageConfig` parametresi ekleme (Gemini API resmi formati):

```typescript
generationConfig: {
  responseModalities: ['TEXT', 'IMAGE'],
  temperature: 0.15,
  imageConfig: {
    aspectRatio: '3:4',
    imageSize: '4K'  // Resmi Gemini API parametresi
  }
}
```

**`src/pages/Generate.tsx`**
- `handleGenerate` fonksiyonu: Edge Function'dan jobId alip polling baslatacak
- `processing_jobs` tablosunu 2 saniye aralikla sorgulayacak
- Status degisikliklerini UI'da gosterecek (ilerleme cubugu, adim bilgisi)

**`src/components/generate/GeneratingPanel.tsx`**
- Polling durumunu gostermek icin guncelleme
- "Bekliyor... -> Analiz -> Uretiliyor -> Tamamlandi" adimlari

### Stuck Job Recovery
- `started_at` alani zaten mevcut
- 10 dakikadan uzun suren isler "stuck" olarak isaretlenecek
- Kullaniciya "Yeniden dene" secenegi sunulacak
- Kismi basarili sonuclara erisim imkani

---

## 3. V2 Beta - Farkli Model/API Entegrasyonu

Kullanici farkli bir gorsel uretim modeli istiyor. Secenekler:

| Model | Avantaj | Dezavantaj |
|-------|---------|------------|
| Flux Pro (via Replicate/fal.ai) | Yuksek kalite, hizli | API key gerekli |
| DALL-E 3 (OpenAI) | Iyi kalite, stabil | API key gerekli |
| Ideogram 3.0 | Yuksek kalite, metin destegi | API key gerekli |
| Stability AI (SDXL/SD3) | Acik kaynak, esnek | Kalite degisken |

### Onerilen Yaklasim
- V2 beta olarak **Flux Pro** veya **farkli bir model** eklenebilir
- Mevcut Gemini 3 Pro pipeline'i V1 olarak kalir
- Yeni model V2 beta olarak ayri bir pipeline olusturulur
- Kullanici Generate sayfasinda V1/V2 secimi yapabilir

### Gerekli Adimlar
1. Secilen model icin API key'in Supabase secret olarak eklenmesi
2. `generate-jewelry` fonksiyonunda model secim parametresi eklenmesi
3. Frontend'de V1/V2 toggle eklenmesi

**Not**: Hangi modeli kullanmak istediginizi belirtmeniz gerekiyor. Plan onaylandiktan sonra model secimini yapalim.

---

## 4. Teknik Uygulama Detaylari

### Adim 1: Edge Function Refactor (4K Arka Plan Isleme)
1. `serve()` handler'i hafifletilecek - sadece validasyon, kredi, job kaydi
2. Tum agir islem `EdgeRuntime.waitUntil()` icine tasinacak
3. `processing_jobs` tablosu uzerinden durum takibi

### Adim 2: Frontend Polling Sistemi
1. `handleGenerate` -> jobId al -> polling baslat
2. `useEffect` veya `setInterval` ile 2sn aralik sorgulama
3. `GeneratingPanel` bileseninde gercek zamanli ilerleme

### Adim 3: Gemini imageConfig Duzeltmesi
1. `generationConfig` icine `imageConfig` eklenmesi (resmi API formati)
2. `aspectRatio: '3:4'` ve `imageSize: '4K'` parametreleri

### Adim 4: V2 Beta Model Entegrasyonu
1. API key eklenmesi (kullanici tarafindan)
2. Yeni model cagri fonksiyonu
3. UI'da model secim arayuzu

### Degistirilecek Dosyalar Ozeti
1. `supabase/functions/generate-jewelry/index.ts` - Arka plan isleme + imageConfig
2. `src/pages/Generate.tsx` - Polling sistemi
3. `src/components/generate/GeneratingPanel.tsx` - Ilerleme gosterimi
4. `src/components/generate/PackageSelector.tsx` - V2 beta toggle (opsiyonel)

