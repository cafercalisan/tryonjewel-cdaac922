

# Master ve Standard Paket Üretim Sorunları - Kapsamlı Düzeltme

## Tespit Edilen Problemler

### 1. Memory/CPU Limit Exceeded
Edge function loglarında `Memory limit exceeded` ve `CPU Time exceeded` hataları görülüyor. Background worker sessizce crash oluyor.

### 2. Job'lar "generating" Durumunda Takılı Kalıyor
Veritabanı sorgusu:
- **Master paketi (5ac846a5)**: progress: 40%, status: generating, 1 görsel tamamlandı ama 2. görselide takıldı
- **Standard paketi (1644801c)**: progress: 30%, status: generating, hiç görsel yok

### 3. Crash Recovery Eksikliği
`EdgeRuntime.waitUntil()` içindeki process crash olunca try-catch çalışmıyor. Job sonsuza kadar "generating" kalıyor.

### 4. Model Çekimi Özel Sorunu
Model shot prompt'u ~4000+ karakter ve çoklu resim referansı kullanıyor. Bu, memory kullanımını artırıyor.

---

## Çözüm Planı

### Adım 1: Takılı Job'ları Temizleme (Database)

Öncelikle mevcut takılı job'ları düzeltip, timeout mekanizması ekleyeceğiz:

**Yeni Alan Ekleme:**
- `started_at` (TIMESTAMPTZ) - İşlemin ne zaman başladığını izlemek için
- Database-level timeout kontrolü için kullanılacak

**Frontend Timeout Kontrolü:**
- Eğer job 10 dakikadan fazla "generating" durumundaysa, frontend bunu "timeout" olarak işaretler
- Kullanıcıya uygun mesaj gösterilir

### Adım 2: Edge Function İyileştirmeleri

**A) Memory Optimizasyonu:**
- Base64 görsellerini daha küçük tutma (mevcut 1.5MB limit iyi)
- Prompt boyutlarını azaltma (gereksiz tekrarları kaldırma)
- Her görsel arasında bellek temizleme

**B) Daha Sağlam Hata Yakalama:**
```text
Her generateSingleImageWithTimeout çağrısı için:
1. Try-catch ile sarmalama
2. Başarısız olursa job progress güncelle
3. Sonraki görsele geç
4. ASLA tüm process'i durdurma
```

**C) Model Çekimi Prompt Sadeleştirme:**
- Gereksiz tekrarlanan blokları kaldır
- Prompt boyutunu %40 azalt
- Daha az base64 referans kullan

### Adım 3: Frontend Sağlamlık İyileştirmeleri

**Timeout Detection:**
```text
useJobPolling hook'una ekleme:
- Job 10 dakika boyunca "generating" ise timeout say
- Kullanıcıya "İşlem zaman aşımına uğradı" mesajı göster
- Kısmi sonuçlar varsa göster
```

**Stuck Job Recovery:**
- "generating" durumundaki eski job'lar için kullanıcıya bilgi ver
- "Yeniden dene" butonu ekle

---

## Teknik Değişiklikler

### 1. Edge Function (`generate-jewelry/index.ts`)

**Değişiklik 1 - Her görsel arasında DB güncelle:**
```text
Mevcut: Her 3 görsel de bittikten sonra final update
Yeni: Her generateSingleImageWithTimeout sonunda HEMEN DB güncelle
```

**Değişiklik 2 - Model çekimi prompt optimizasyonu:**
```text
Mevcut: ~4000 karakter prompt + tekrarlanan fidelityBlock
Yeni: ~2500 karakter optimize edilmiş prompt
```

**Değişiklik 3 - Daha agresif timeout:**
```text
Mevcut: 4 dakika timeout
Yeni: 3 dakika timeout (memory pressure'ı azaltmak için)
```

**Değişiklik 4 - Crash-resistant job update:**
```text
Her görsel generation başlamadan ÖNCE:
- job.current_step güncelle
- job.started_at güncelle

Her görsel generation sonunda:
- Başarılı: result_urls + completed_images güncelle
- Başarısız: failed_image_indices güncelle
- HER DURUMDA: progress güncelle
```

### 2. Frontend Hook (`useJobPolling.ts`)

**Değişiklik: Timeout Detection**
```text
if (job.status === 'generating' && 
    Date.now() - new Date(job.updated_at).getTime() > 600000) {
  // 10 dakika geçti, timeout say
  setIsStuck(true);
}
```

### 3. Database Migration

**Yeni alanlar:**
- `started_at` (TIMESTAMPTZ) - İşlem başlangıç zamanı

---

## Dosya Değişiklikleri

| Dosya | Değişiklik |
|-------|------------|
| `supabase/functions/generate-jewelry/index.ts` | Timeout azaltma, prompt optimizasyonu, crash-resistant updates |
| `src/hooks/useJobPolling.ts` | Stuck job detection, timeout handling |
| `src/pages/Generate.tsx` | Timeout UI, retry button |
| `src/components/generate/GeneratingPanel.tsx` | Timeout state gösterimi |
| `supabase/migrations/xxx.sql` | `started_at` alanı ekleme |

---

## Model Çekimi Özel Optimizasyonu

Model çekimi en çok memory kullanan işlem. Şu değişiklikler yapılacak:

**Mevcut Sorun:**
- 3 base64 resim yükleniyor (original + önceki 2 üretim)
- 4000+ karakter prompt
- Memory pressure → crash

**Çözüm:**
- Sadece original resmi kullan (önceki üretimleri referans olarak kullanma)
- Prompt'u 2500 karaktere düşür
- Timeout'u 3 dakikaya indir

---

## Beklenen Sonuçlar

| Metrik | Öncesi | Sonrası |
|--------|--------|---------|
| Memory crash | Sık | Nadir |
| Takılı job'lar | Var | Timeout ile çözülür |
| Model çekimi başarı | ~50% | ~80% |
| Kullanıcı feedback | Sonsuz bekleme | 10dk sonra timeout mesajı |
| Kısmi sonuçlar | Gösterilmiyor | Her tamamlanan görünür |

---

## Önemli Notlar

1. **Memory limit Supabase Edge Function'ların doğal kısıtlaması** - Tamamen ortadan kaldırılamaz, sadece minimize edilebilir
2. **Model çekimi her zaman en riskli işlem olacak** - İnsan figürü üretmek daha fazla kaynak gerektirir
3. **Kısmi başarı kabul edilebilir** - 2/3 görsel üretilirse kullanıcı memnun olabilir

