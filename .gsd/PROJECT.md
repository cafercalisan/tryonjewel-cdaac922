# Project

## What This Is

TryOnJewel — mücevher ürünlerini AI ile çoklu kullanım senaryolarına dönüştüren görsel üretim platformu. Kullanıcı ürün görseli yükler, platform analiz eder, seçilen moda göre (retouch, sahne, referans fusion, model showcase, experience, video) profesyonel kalitede çıktılar üretir.

## Core Value

Tek bir ürün fotoğrafından, profesyonel kalitede e-ticaret, editöriyal, model sunumu ve kampanya görselleri üretmek — ürün geometrisini ve metal sadakatini koruyarak.

## Current State

**Mevcut v1 (legacy):** React + Express + PostgreSQL + MinIO + Gemini API
- Auth: JWT + bcrypt ✅ çalışıyor
- Storage: MinIO S3 uyumlu ✅ çalışıyor
- 38 sahne seed data ✅
- Tek monolitik Generate.tsx (1100+ satır) ile sahne-bazlı üretim
- 2600 satırlık inline generate-jewelry handler
- Hetzner'da deploy edilmiş Docker infra

**Planlanan v2:** PRD'ye uygun modüler mimari ile tam yeniden yazım
- NestJS backend + BullMQ + Redis job queue
- Ürün analizi, referans analizi, QC pipeline
- 7 üretim modu (Retouch, Scene, Reference Fusion, Model Showcase, Experience, Video, Master Package)
- Versiyonlanmış prompt sistemi

## Architecture / Key Patterns

### Frontend
- React 18 + TypeScript + Vite + Tailwind + shadcn/ui
- React Router 6, React Query, Framer Motion
- Mevcut UI bileşenleri (shadcn/ui) korunacak, sayfalar yeniden yazılacak

### Backend (v2 hedef)
- NestJS modüler mimari
- BullMQ + Redis job queue
- PostgreSQL 16 (mevcut Hetzner DB)
- MinIO S3 storage (mevcut)
- Gemini 3.1 Flash + Gemini 3 Pro Image + Veo 3.1

### Yeni Modül Yapısı (hedef)
```
backend/
├── src/
│   ├── auth/          — JWT auth, guards
│   ├── products/      — upload, CRUD, set gruplama
│   ├── references/    — upload, analiz lifecycle
│   ├── analysis/      — product analyzer, reference analyzer
│   ├── models/        — model DNA kütüphanesi
│   ├── scenes/        — sahne kütüphanesi
│   ├── prompt/        — composer, templates, versioning
│   ├── generation/    — orchestrator, job oluşturma
│   ├── workers/       — image worker, video worker, qc worker
│   ├── qc/            — kalite kontrol skorlama
│   ├── gallery/       — asset listeleme, filtreleme
│   ├── admin/         — scene/model/prompt/job yönetimi
│   └── common/        — storage, database, shared types
```

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract.

## Milestone Sequence

- [ ] M003: NestJS Backend Foundation + Core Modes — Tüm backend'i NestJS ile yeniden yaz, 5 temel üretim modunu (Retouch, Scene, Reference Fusion, Model Showcase, Experience) çalıştır, job queue + QC pipeline kur
- [ ] M004: Frontend Rebuild — Generate akışını PRD'ye uygun çok adımlı wizard'a dönüştür, galeri/admin/video sayfalarını yeniden yaz
- [ ] M005: Video Pipeline + Master Package — Veo 3.1 video üretimi, Master Package orkestrasyonu, admin dashboard genişletme
