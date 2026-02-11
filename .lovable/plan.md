

## Sorun Analizi

Master pakette 3 gorsel tek bir arka plan isleminde sirayla uretiliyor. Her gorsel ~20MB+ bellek tuketiyor ve 2. veya 3. gorselde Edge Function bellek limiti (150MB) asilarak islem cokuyor. Retouch basarili cunku sadece 1 gorsel uretiyor.

Veritabani kayitlari bunu dogruluyor:
- Retouch (b5d52d8a): Basariyla tamamlandi, 1 gorsel
- Master (69743456): "generating" durumunda takili kaldi, 0 tamamlanan gorsel, bellek cokusu

## Cozum: Adim Adim Uretim Mimarisi

Master paketi tek bir Edge Function cagrisi yerine **3 ayri Edge Function cagrisi** ile isleyecek sekilde degistiriyoruz. Her cagri 1 gorsel uretir (Retouch'un basarili paterni).

### 1. Edge Function Degisiklikleri (`generate-jewelry/index.ts`)

**Yeni parametre eklenmesi:** `stepIndex` (hangi gorselin uretilecegi: 0, 1, 2)

Master pakette davranis degisikligi:
- `stepIndex` belirtilmezse veya 0 ise: Analiz + 1. gorsel (Editorial) uretilir
- `stepIndex: 1` ise: 2. gorsel (E-Ticaret) uretilir  
- `stepIndex: 2` ise: 3. gorsel (Model) uretilir

Her adimda sadece 1 gorsel uretilir, bellek limiti asilmaz.

Analiz sonucu ve mevcut gorsel URL'leri `processing_jobs` tablosuna kaydedilir, sonraki adimlar bu veriyi kullanir.

### 2. Frontend Orkestrasyon (`Generate.tsx`)

Master paket secildiginde frontend sureci yonetir:
1. Adim 0: Edge function'i `stepIndex: 0` ile cagir -> jobId alinir, polling baslar
2. Job tamamlandiginda (1. gorsel hazir): `stepIndex: 1` ile yeni cagri yapilir
3. Job tamamlandiginda (2. gorsel hazir): `stepIndex: 2` ile yeni cagri yapilir
4. Tum gorseller tamamlandiginda sonuclar sayfasina yonlendirilir

Polling mantigi her adimda kartlari gunceller (completed/generating/waiting).

### 3. Kart Tasarimi Genisletme (`GeneratingPanel.tsx`)

- Kartlar mobilde `grid-cols-1`, tablette `grid-cols-2`, masaustunde `grid-cols-3` olarak duzenlenir
- Kart yuksekligi arttirilir, gorsel alani buyutulur
- Tamamlanan kartlara tiklanabilirlik eklenir (buyuk goruntuleme)
- Her kart icin durum gostergesi daha belirgin hale getirilir

### 4. Veritabani Kullanimi

`processing_jobs` tablosundaki mevcut `result_urls` ve `analysis_data` alanlari kullanilir. Yeni tablo veya sutun gerekli degil. Her adim sonucunu bu tabloya yazar, sonraki adim okur.

### Teknik Akis

```text
Frontend                    Edge Function
   |                             |
   |-- stepIndex:0 ------------->|
   |<-- jobId, imageId ----------|
   |                             |-- Analiz + Editorial uret
   |   (polling)                 |-- result_urls'e ekle
   |<-- status: step_0_done -----|
   |                             |
   |-- stepIndex:1 ------------->|
   |<-- ayni jobId --------------|
   |                             |-- E-Ticaret uret
   |   (polling)                 |-- result_urls'e ekle
   |<-- status: step_1_done -----|
   |                             |
   |-- stepIndex:2 ------------->|
   |<-- ayni jobId --------------|
   |                             |-- Model uret
   |   (polling)                 |-- result_urls'e ekle
   |<-- status: completed -------|
   |                             |
   |-- navigate(/sonuclar) ----->|
```

### Degisecek Dosyalar

1. **`supabase/functions/generate-jewelry/index.ts`** - Master pakette tek gorsel uretim mantigi, stepIndex parametresi, analiz verisinin jobs tablosuna kaydedilmesi
2. **`src/pages/Generate.tsx`** - Master pakette 3 asamali orkestrasyon, her adim icin ayri edge function cagrisi ve polling
3. **`src/components/generate/GeneratingPanel.tsx`** - Mobil uyumlu responsive kart tasarimi, daha buyuk gorsel alanlari, tiklama ile buyutme

