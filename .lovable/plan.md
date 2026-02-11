

## Problem: waitUntil() Guvenirsizligi

Edge Function loglari step 0'in basariyla tamamlandigini gosteriyor ("Master step 0 complete. Generated: 1"), ancak veritabaninda durum hala `generating` olarak kaliyor. `EdgeRuntime.waitUntil()` fonksiyonu, islem bitmeden once kapatiliyor ve DB guncellemesi kayboluyor.

## Cozum: Senkron Calisma Modeli (waitUntil Kaldirilacak)

`waitUntil` kullanmak yerine, her adim senkron olarak calisacak. Edge function islem bitene kadar HTTP yaniti bekletecek ve sonucu dogrudan dondurecek. Polling tamamen kaldirilacak.

Bu yaklasim Retouch'un basarili calisan paterni ile ayni: tek bir gorsel uretimi, senkron donus.

### Teknik Akis

```text
Frontend                        Edge Function
   |                                  |
   |-- stepIndex:0 (await fetch) ---->|
   |                                  |-- Analiz + Editorial uret
   |                                  |-- DB guncelle
   |<-- { success, urls, jobId } -----|  (~120sn)
   |                                  |
   |-- UI: Kart 1 tamamlandi --------|
   |                                  |
   |-- stepIndex:1 (await fetch) ---->|
   |                                  |-- E-Ticaret uret
   |                                  |-- DB guncelle
   |<-- { success, urls } -----------|  (~60sn)
   |                                  |
   |-- UI: Kart 2 tamamlandi --------|
   |                                  |
   |-- stepIndex:2 (await fetch) ---->|
   |                                  |-- Model uret
   |                                  |-- DB guncelle + finalize
   |<-- { success, urls } -----------|  (~60sn)
   |                                  |
   |-- navigate(/sonuclar) --------->|
```

### 1. Edge Function Degisiklikleri (`generate-jewelry/index.ts`)

- `EdgeRuntime.waitUntil()` kaldirilacak
- `processGenerationInBackground` fonksiyonu dogrudan `await` ile cagirilacak
- Fonksiyon islem tamamlandiktan sonra sonuclari dogrudan HTTP yaniti olarak dondurecek
- Her adim sonunda DB guncellemesi garanti edilecek (yanit donmeden once gerceklesecek)
- `result_urls` yanit body'sine eklenecek

Yeni donus formati:
```json
{
  "success": true,
  "jobId": "...",
  "imageId": "...",
  "status": "step_0_done",
  "resultUrls": ["https://..."],
  "totalImages": 3
}
```

### 2. Frontend Degisiklikleri (`Generate.tsx`)

- Polling mekanizmasi tamamen kaldirilacak (`pollingRef`, `startPolling`, `cleanupPolling` fonksiyonlari)
- `handleGenerate` fonksiyonu sirayla 3 `await` cagrisi yapacak
- Her cagri tamamlandiginda ilgili kart durumu guncellenecek
- Stuck job detection gereksiz hale gelecek (senkron calismada takilan islem yok)

Yeni akis:
```
handleGenerate() {
  // Step 0: Editorial
  setCardStatus(0, 'generating')
  const result0 = await invoke('generate-jewelry', { stepIndex: 0 })
  setCardStatus(0, 'completed')
  setResultUrl(0, result0.resultUrls[0])

  // Step 1: E-Commerce  
  setCardStatus(1, 'generating')
  const result1 = await invoke('generate-jewelry', { stepIndex: 1, existingJobId, existingImageId })
  setCardStatus(1, 'completed')
  setResultUrl(1, result1.resultUrls[1])

  // Step 2: Model
  setCardStatus(2, 'generating')
  const result2 = await invoke('generate-jewelry', { stepIndex: 2, existingJobId, existingImageId })
  setCardStatus(2, 'completed')
  
  navigate('/sonuclar')
}
```

### 3. GeneratingPanel Iyilestirmeleri (`GeneratingPanel.tsx`)

- Kart durum yonetimi basitlestirilecek (polling durumlarini izlemeye gerek yok)
- `jobCurrentStep` yerine dogrudan `cardStatuses` prop'u alinacak
- Mobil uyumlu responsive grid korunacak (grid-cols-1 / sm:grid-cols-2 / lg:grid-cols-3)
- Tamamlanan kartlara tiklama ile buyuk goruntuleme ozelligi eklenecek

### Avantajlar

- **Guvenilirlik**: waitUntil kaybedilen DB guncellemesi problemi tamamen ortadan kalkar
- **Basitlik**: Polling, stuck detection, step status tracking mantigi gereksiz hale gelir
- **Daha az hata noktasi**: Her adimin sonucu dogrudan frontend'e doner
- **Ayni performans**: Her adim tek gorsel urettigi icin sure Retouch ile ayni (~60-120sn)

### Degisecek Dosyalar

1. `supabase/functions/generate-jewelry/index.ts` - waitUntil kaldirilacak, senkron await + dogrudan yanit
2. `src/pages/Generate.tsx` - Polling kaldirilacak, sirayla await cagirilari
3. `src/components/generate/GeneratingPanel.tsx` - Prop'lar basitlestirilecek, tiklama ile buyutme eklenmesi

