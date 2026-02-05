

# Görsel Üretim Hatası Düzeltme ve Kredi Sistemi Güncelleme Planı

## Tespit Edilen Sorunlar

### 1. Edge Function 404 Hatası
- `generate-jewelry` edge function'a yapılan istekler 404 dönüyor
- Bu, function'ın düzgün deploy edilmediğini veya erişilemez olduğunu gösteriyor
- Çözüm: Edge function'ı yeniden deploy etmek

### 2. Frontend-Backend Kredi Uyumsuzluğu

| Paket | Frontend (Gösterilen) | Backend (Gerçek) |
|-------|----------------------|------------------|
| Standard/Retouch | 1 kredi | 10 kredi |
| Master | 2 kredi | 20 kredi |

Kullanıcıya 1 kredi gösterilirken aslında 10 kredi düşürülüyor. Bu **kritik bir UX sorunu**.

### 3. 4K Çıktı Desteği Eksik
- Mevcut yapıda `generationConfig` içinde 4K çıktı parametresi yok
- Gemini 3 Pro Image Preview modeli 4K destekliyor

---

## Uygulama Planı

### Adım 1: Kredi Sistemini Senkronize Et
**Dosya:** `src/pages/Generate.tsx`

```typescript
// Eski (satır 207):
const creditsNeeded = packageType === 'master' ? 2 : 1;

// Yeni:
const creditsNeeded = packageType === 'master' ? 20 : 10;
```

### Adım 2: PackageSelector'da Kredi Bilgisini Güncelle
**Dosya:** `src/components/generate/PackageSelector.tsx`

```typescript
// Package objelerinde credits değerlerini güncelle
{ id: 'standard', credits: 10, ... }
{ id: 'master', credits: 20, ... }
{ id: 'retouch', credits: 10, ... }
```

### Adım 3: Edge Function'a 4K Desteği Ekle
**Dosya:** `supabase/functions/generate-jewelry/index.ts`

`callGeminiImageGeneration` fonksiyonunda:

```typescript
generationConfig: {
  responseModalities: ['TEXT', 'IMAGE'],
  temperature: 0.15,
  // 4K çıktı için eklenmesi gereken parametreler:
  imageSize: '4K',
  maxOutputTokens: 8192,
}
```

### Adım 4: Edge Function'ı Yeniden Deploy Et
- `generate-jewelry` function'ını yeniden deploy ederek 404 hatasını çöz

---

## Teknik Detaylar

### Kredi Yapısı (Güncellenen)

| Paket | Kredi Maliyeti | Çıktı Sayısı | Açıklama |
|-------|---------------|--------------|----------|
| Standard | 10 kredi | 1 görsel | Tek sahne görseli |
| Master | 20 kredi | 3 görsel | E-ticaret + Katalog + Model |
| Retouch | 10 kredi | 1 görsel | Profesyonel rötuş |

### 4K Çıktı Özellikleri
- Gemini 3 Pro Image Preview modeli native 4K destekler
- `imageSize: '4K'` parametresi ile yüksek çözünürlük
- `maxOutputTokens: 8192` ile detaylı görsel üretimi

### Değiştirilecek Dosyalar
1. `src/pages/Generate.tsx` - Kredi hesaplama
2. `src/components/generate/PackageSelector.tsx` - UI kredi gösterimi
3. `supabase/functions/generate-jewelry/index.ts` - 4K config + yeniden deploy

