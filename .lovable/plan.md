

# Background Processing Implementasyonu - WORKER_LIMIT Çözümü

## Problem Analizi

Mevcut `generate-jewelry` Edge Function, **Master Package** için 3 görseli **senkron olarak** üretiyor. Her görsel ~30-40 saniye sürüyor ve CPU-yoğun işlemler (base64 encoding, API çağrıları) 2 saniyelik CPU limitini aşıyor.

**Supabase Pro Plan bu sorunu çözmez** çünkü:
- Free: 2 sec CPU / 150 sec wall clock
- Pro: 2 sec CPU / 400 sec wall clock (CPU aynı kalıyor)

---

## Çözüm Mimarisi

```text
┌─────────────────┐      ┌──────────────────────┐      ┌─────────────────┐
│   Frontend      │──1──▶│  Edge Function       │──2──▶│  processing_    │
│   (Generate.tsx)│      │  (generate-jewelry)  │      │  jobs table     │
└─────────────────┘      └──────────────────────┘      └─────────────────┘
        │                         │                            │
        │                         │ 3. EdgeRuntime             │
        │                         │    .waitUntil()            │
        │                         ▼                            │
        │                ┌──────────────────────┐              │
        │                │  Background Worker   │──4──────────▶│
        │                │  (async processing)  │   update     │
        │                └──────────────────────┘   status     │
        │                                                      │
        └───────────────────5. Poll status ───────────────────▶│
```

### Akış:
1. Frontend request gönderir
2. Edge Function hemen `job_id` oluşturup döner (~100ms)
3. `EdgeRuntime.waitUntil()` ile arka plan işlemi başlar
4. Her görsel tamamlandığında DB güncellenir
5. Frontend job durumunu polling ile takip eder

---

## Teknik Implementasyon Planı

### Adım 1: processing_jobs Tablosu Oluşturma

Database'e yeni bir tablo eklenecek:

**Tablo Şeması:**
- `id` (UUID, primary key)
- `user_id` (UUID, foreign key to profiles)
- `status` (TEXT): `pending`, `analyzing`, `generating`, `completed`, `failed`
- `progress` (INTEGER): 0-100
- `current_step` (TEXT): Kullanıcıya gösterilecek mesaj
- `total_images` (INTEGER): Toplam üretilecek görsel sayısı
- `completed_images` (INTEGER): Tamamlanan görsel sayısı
- `image_record_id` (UUID): İlişkili images kaydı
- `result_urls` (JSONB): Tamamlanan görsel URL'leri
- `error_message` (TEXT): Hata durumunda mesaj
- `created_at`, `updated_at` (TIMESTAMPTZ)

**RLS Politikaları:**
- Kullanıcılar sadece kendi job'larını görebilir
- Service role tüm job'ları güncelleyebilir

---

### Adım 2: Edge Function Yeniden Yapılandırma

**generate-jewelry/index.ts** dosyası ikiye ayrılacak:

**A) Ana Handler (Hızlı Yanıt):**
```
1. Kullanıcı doğrulama
2. Kredi kontrolü ve düşme
3. Job kaydı oluşturma (status: pending)
4. Image kaydı oluşturma
5. EdgeRuntime.waitUntil() ile background task başlatma
6. Hemen job_id döndürme
```

**B) Background Worker (Async):**
```
1. Görselleri yükleme ve analiz
2. Her görsel için:
   - Prompt oluşturma
   - Gemini API çağrısı
   - Storage'a upload
   - Job progress güncelleme
3. Tamamlandığında status: completed
4. Hata durumunda status: failed + refund
```

---

### Adım 3: Frontend Polling Sistemi

**Generate.tsx** ve ilgili hook'lar güncellenecek:

**Yeni Hook: useJobPolling**
```typescript
// Örnek yapı
const useJobPolling = (jobId: string | null) => {
  // 2 saniyede bir job durumunu kontrol et
  // status === 'completed' olunca sonuçları döndür
  // status === 'failed' olunca hata göster
  // progress değerini UI'a aktar
}
```

**UI Güncellemeleri:**
- Mevcut "Generating..." overlay'i gerçek progress gösterecek
- "Görsel 1/3 tamamlandı" gibi canlı güncellemeler
- Hata durumunda kullanıcıya bilgi + kredi iadesi bildirimi

---

### Adım 4: Hata Yönetimi ve Kredi İadesi

**Partial Failure Handling:**
- 3 görselden 2'si başarılı olursa: Kısmi başarı göster
- Tüm görseller başarısız olursa: Tam kredi iadesi
- Zaman aşımı (10 dakika): Job failed olarak işaretle

**Kredi İadesi Mekanizması:**
- Background worker hata yakalayınca `refund_credits` RPC çağırılır
- Job kaydına refund bilgisi eklenir

---

## Dosya Değişiklikleri

| Dosya | Değişiklik |
|-------|------------|
| `supabase/migrations/xxx_processing_jobs.sql` | Yeni tablo ve RLS |
| `supabase/functions/generate-jewelry/index.ts` | Background processing |
| `src/hooks/useJobPolling.ts` | Yeni polling hook |
| `src/pages/Generate.tsx` | Polling entegrasyonu |
| `src/components/generate/GeneratingPanel.tsx` | Gerçek progress UI |
| `src/integrations/supabase/types.ts` | Otomatik güncellenir |

---

## Beklenen Sonuçlar

- Edge Function yanıt süresi: ~30-40 saniye → ~500ms
- WORKER_LIMIT hatası: Çözülür
- Kullanıcı deneyimi: Gerçek zamanlı progress gösterimi
- Güvenilirlik: Partial failure handling + kredi iadesi
- Ölçeklenebilirlik: Birden fazla eşzamanlı job desteklenir

---

## Alternatif Değerlendirme

**Lovable Cloud vs Kendi Supabase:**
- Lovable Cloud edge function'ları aynı limitlere tabi
- Kendi Supabase Pro hesabınız da aynı limitlere tabi
- **Çözüm platform değişikliği değil, mimari değişiklik**

Bu plan onaylanırsa implementasyona başlayabilirim.

