# M001: Hetzner Self-Hosted — Tam Çalışan Platform

**Vision:** Platformun core feature'ı olan AI görsel üretimi Hetzner'de sorunsuz çalışır. Tüm uçtan uca akış (upload → analiz → üretim → galeri) production-ready.

## Success Criteria

- Kullanıcı fotoğraf yükleyip standart pakette 3 görsel üretebilir
- Tek görsel (single) ve rötuş (retouch) paketleri de çalışır
- Üretim sırasında progress bar gerçek ilerlemeyi gösterir
- Üretilen görseller galeriden görüntülenebilir ve indirilebilir
- `/api/health` endpoint'i tüm servisleri (DB, MinIO, Gemini) doğrular
- Container restart sonrası tüm servisler otomatik çalışır

## Key Risks / Unknowns

- Gemini API hatası root cause'u bilinmiyor — model adı, API key, request format, ya da rate limit olabilir
- MinIO signed URL'ler Docker internal URL dönüyor olabilir — browser'dan erişilemez

## Proof Strategy

- Gemini API → S01'de retire: sunucu loglarından hatayı teşhis edip, çalışan bir üretim döngüsü ile kanıtlama
- MinIO URL → S02'de retire: üretilen görselin browser'dan yüklenmesi ile kanıtlama

## Verification Classes

- Contract verification: `/api/health` endpoint tüm servisleri check eder
- Integration verification: Tam üretim döngüsü (upload → galeri) gerçek Gemini API ile
- Operational verification: Docker container restart sonrası servisler ayağa kalkar
- UAT / human verification: Gerçek kullanıcı akışı — giriş, yükleme, üretim, galeri

## Milestone Definition of Done

This milestone is complete only when all are true:

- Gemini görsel üretimi (v1) sorunsuz çalışır
- MinIO upload ve signed URL'ler browser'dan erişilebilir
- Processing job polling düzgün çalışır
- En az bir tam uçtan uca test browser'da yapılır
- Health endpoint tüm servisleri yeşil raporlar
- Bilinen code bug'lar (duplicate import vb.) temizlenir

## Slices

- [ ] **S01: Gemini API Görsel Üretimi Fix** `risk:high` `depends:[]`
  > After this: Bir fotoğraf yüklenip, 3 kampanya görseli üretilir ve processing_jobs tablosunda completed olarak görünür

- [ ] **S02: Uçtan Uca Doğrulama ve Temizlik** `risk:low` `depends:[S01]`
  > After this: Browser'da tam akış çalışır — giriş, yükleme, üretim, galeri görüntüleme, indirme. Bilinen code sorunları temizlenmiş, health endpoint canlı.

## Boundary Map

### S01 → S02

Produces:
- Çalışan `generate-jewelry` endpoint'i — Gemini API'yi başarıyla çağırır, görselleri MinIO'ya yazar, processing_jobs'ı günceller
- Doğrulanmış environment variable seti (hangi key'ler gerekli, hangi model adları geçerli)

Consumes:
- nothing (first slice)
