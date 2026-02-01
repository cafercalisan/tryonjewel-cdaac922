

# Master Paket Üretim Süreci İyileştirmesi

## Problem Özeti

Master pakette üretim %65 civarında takılıyor ve görsel çıktıları görünmüyor. Bunun nedenleri:
1. API çağrılarında timeout kontrolü yok
2. Başarısız görsel için retry mekanizması yok
3. Kısmi başarı (2/3 görsel) durumunda job tamamlanmıyor
4. Kullanıcı her görsel tamamlandığında anlık olarak sonucu göremiyor

---

## Yeni Mimari Tasarım

```text
Kullanıcı Request
       │
       ▼
┌─────────────────────────┐
│ Edge Function (Hızlı)   │
│ - Job ID oluştur        │
│ - Kredi düş              │
│ - Background başlat     │
└─────────────────────────┘
       │ waitUntil()
       ▼
┌─────────────────────────────────────────────────────────────┐
│                  BACKGROUND WORKER                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────┐   4dk timeout   ┌────────────────┐  │
│  │ 1. Katalog Görseli│───────────────▶│ Retry (1x)     │  │
│  │    (Editorial)    │                 └────────────────┘  │
│  └─────────┬─────────┘                         │           │
│            │ Başarılı?                         │           │
│            ▼                                   ▼           │
│  ┌──── DB UPDATE ────┐              ┌─── DB UPDATE ───┐   │
│  │ completed_images=1│              │ (başarısız log) │   │
│  │ result_urls=[url1]│              └─────────────────┘   │
│  └───────────────────┘                                     │
│            │                                               │
│            ▼                                               │
│  ┌───────────────────┐   4dk timeout   ┌────────────────┐  │
│  │ 2. E-Ticaret      │───────────────▶│ Retry (1x)     │  │
│  │    (Sade arkaplan)│                 └────────────────┘  │
│  └─────────┬─────────┘                                     │
│            │                                               │
│            ▼                                               │
│  ┌───────────────────┐   4dk timeout   ┌────────────────┐  │
│  │ 3. Model Çekimi   │───────────────▶│ Retry (1x)     │  │
│  │    (Manken)       │                 └────────────────┘  │
│  └─────────┬─────────┘                                     │
│            │                                               │
│            ▼                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ SONUÇ DEĞERLENDİRME                                 │   │
│  │ • 3/3 başarılı → status: completed                  │   │
│  │ • 2/3 başarılı → status: completed + kısmi iade     │   │
│  │ • 1/3 başarılı → status: completed + kısmi iade     │   │
│  │ • 0/3 başarılı → status: failed + tam iade          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
       │
       │ Realtime Updates
       ▼
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Generate.tsx)                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         GeneratingPanel (Üretim Ekranı)             │   │
│  │                                                     │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐             │   │
│  │  │ KART 1  │  │ KART 2  │  │ KART 3  │             │   │
│  │  │ Katalog │  │E-Ticaret│  │ Model   │             │   │
│  │  │         │  │         │  │         │             │   │
│  │  │ [Görsel]│  │[Spinner]│  │[Bekliyor]│            │   │
│  │  │   ✓     │  │   ...   │  │    ○    │             │   │
│  │  └─────────┘  └─────────┘  └─────────┘             │   │
│  │                                                     │   │
│  │  Progress: ████████░░░░░░░░░░ 45%                   │   │
│  │  "E-ticaret görseli oluşturuluyor (2/3)..."        │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Teknik Değişiklikler

### 1. Edge Function: Timeout + Retry Mekanizması

**Dosya:** `supabase/functions/generate-jewelry/index.ts`

Yeni `generateSingleImageWithTimeout` fonksiyonu eklenecek:
- Her görsel için 4 dakika (240.000ms) timeout
- Başarısız olursa 1 kez retry
- `Promise.race()` ile timeout kontrolü
- Her görsel sonucu anında DB'ye yazılacak

```text
Örnek akış:
1. Katalog görseli başlat → 4dk timeout ile izle
2. Başarılı → DB güncelle (completed_images=1, result_urls=[url])
3. Başarısız → 1x retry → hala başarısız → log yaz, devam et
4. E-ticaret görseli başlat → aynı süreç
5. Model çekimi başlat → aynı süreç
6. Toplam sonuçları değerlendir → kısmi/tam iade hesapla
```

### 2. Kısmi Başarı ve Kredi İadesi

**Kısmi iade formülü:**
- 3/3 başarılı → 0 kredi iade
- 2/3 başarılı → 7 kredi iade (20 × 1/3)
- 1/3 başarılı → 14 kredi iade (20 × 2/3)
- 0/3 başarılı → 20 kredi iade (tam)

Yeni `processing_jobs` alanları:
- `partial_refund_amount` (INTEGER) - İade edilen kredi miktarı
- `failed_image_indices` (JSONB) - Hangi görsellerin başarısız olduğu

### 3. Frontend: 3 Kartlı Önizleme UI

**Dosya:** `src/components/generate/GeneratingPanel.tsx`

Yeni kart bazlı UI:
- 3 kart: "Lüks Katalog", "E-Ticaret", "Model Çekimi"
- Her kart durumu:
  - `waiting` → Gri placeholder + "Bekliyor..."
  - `generating` → Spinner + pulse animasyonu
  - `completed` → Gerçek görsel thumbnail
  - `failed` → Kırmızı uyarı ikonu
- Kartlar `result_urls` array'inden sırayla dolar
- Tamamlanan görsele tıklayınca büyük önizleme

---

## Dosya Değişiklik Listesi

| Dosya | Değişiklik |
|-------|------------|
| `supabase/functions/generate-jewelry/index.ts` | Timeout wrapper, retry logic, kısmi başarı yönetimi |
| `src/components/generate/GeneratingPanel.tsx` | 3 kartlı önizleme UI, anlık görsel gösterimi |
| `src/hooks/useJobPolling.ts` | `result_urls` değişikliklerini takip etme |
| `supabase/migrations/xxx_update_processing_jobs.sql` | Yeni alanlar: `partial_refund_amount`, `failed_image_indices` |

---

## Kullanıcı Deneyimi Akışı

1. Kullanıcı "Oluştur" butonuna basar
2. 3 boş kart görünür (Katalog / E-Ticaret / Model)
3. 1. kart: Spinner döner, "Lüks katalog görseli oluşturuluyor..."
4. ~30-40sn sonra 1. kart tamamlanır, görsel görünür, ✓ işareti
5. 2. kart: Spinner başlar, "E-ticaret görseli oluşturuluyor..."
6. ~30-40sn sonra 2. kart tamamlanır
7. 3. kart: Spinner başlar, "Model çekimi oluşturuluyor..."
8. ~30-40sn sonra 3. kart tamamlanır (veya 4dk timeout sonrası başarısız)
9. İşlem biter: Başarılı görseller sonuçlar sayfasına yönlendirilir
10. Kısmi başarı varsa: "2/3 görsel başarılı. 7 kredi iade edildi." bildirimi

---

## Zaman ve Güvenilirlik İyileştirmesi

| Durum | Eski Sistem | Yeni Sistem |
|-------|-------------|-------------|
| Normal üretim | ~2-3 dk | ~2-3 dk (aynı) |
| 3. görsel takılırsa | Sonsuza kadar bekler | 4dk sonra timeout + devam |
| 2/3 başarılı | Hiçbir sonuç yok | 2 görsel gösterilir + kısmi iade |
| Anlık feedback | Sadece progress % | Her görsel anında görünür |

