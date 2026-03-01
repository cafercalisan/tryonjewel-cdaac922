# TryOnJewel — Architecture

## Overall Pattern

TryOnJewel is a **full-stack SaaS application** structured as a Vite single-page application (SPA) deployed alongside Vercel serverless functions. The frontend and backend are deployed together on Vercel, sharing the same domain: the React SPA is served as static assets, and all API routes live under `/api/*` as Node.js serverless functions.

There is no separate backend server or container. All compute-intensive work — AI image generation, video generation, credit management — runs in Vercel's serverless runtime under `api/`. The data layer is entirely Supabase (PostgreSQL + Auth + Storage).

```
Browser (React SPA)
       |
       | fetch /api/<name>  (POST + Bearer token)
       v
Vercel Serverless Functions  (api/*.ts)
       |              |
       v              v
  Supabase DB    Google Gemini API
  (Postgres)     (gemini-2.5-flash, gemini-3-pro,
  Supabase Auth   veo-3.1-fast-generate-preview, veo-2.0)
  Supabase Storage
```

---

## Layers

### 1. Frontend — Vite SPA (`src/`)

Entry point: `src/main.tsx` renders `src/App.tsx` into `index.html`.

`src/App.tsx` is the router root. It wraps the entire app in:
- `QueryClientProvider` — TanStack React Query for server state
- `AuthProvider` — global auth context (`src/hooks/useAuth.tsx`)
- `TooltipProvider` + `Toaster`/`Sonner` — UI providers
- `BrowserRouter` with `Routes` — client-side routing

Routes are split into **public** (no auth required) and **protected** (wrapped in `ProtectedRoute`).

#### Public pages
| Route | Component |
|---|---|
| `/` | `src/pages/Landing.tsx` |
| `/ornekler` | `src/pages/Examples.tsx` |
| `/giris` | `src/pages/Login.tsx` |
| `/kayit` | `src/pages/Signup.tsx` |
| `/sahneler` | `src/pages/Scenes.tsx` |
| `/demo/premium-hero` | `src/pages/PremiumHeroDemo.tsx` |

#### Protected pages (require auth)
| Route | Component |
|---|---|
| `/panel` | `src/pages/Dashboard.tsx` |
| `/olustur` | `src/pages/Generate.tsx` |
| `/sonuclar` | `src/pages/Results.tsx` |
| `/tasarim-olustur` | `src/pages/CreateDesign.tsx` |
| `/tasarim-sonuc` | `src/pages/DesignResults.tsx` |
| `/gorsellerim` | `src/pages/Gallery.tsx` |
| `/modellerim` | `src/pages/ModelGallery.tsx` |
| `/videolarim` | `src/pages/Videos.tsx` |
| `/hesap` | `src/pages/Account.tsx` |
| `/admin` | `src/pages/Admin.tsx` |

### 2. API Endpoints — Vercel Serverless (`api/`)

Each file exports a default `handler(req, res)` function that Vercel maps to an HTTP endpoint at `/api/<filename>`. All handlers are TypeScript compiled at deploy time.

| File | Endpoint | Purpose | `maxDuration` |
|---|---|---|---|
| `api/generate-jewelry.ts` | `POST /api/generate-jewelry` | Core: analyze jewelry + generate 3 images via Gemini | 300s |
| `api/generate-design.ts` | `POST /api/generate-design` | Marketing design images for campaigns | 300s |
| `api/generate-model.ts` | `POST /api/generate-model` | AI fashion model portrait generation (Character DNA) | 300s |
| `api/generate-video.ts` | `POST /api/generate-video` | Video generation via Veo 3.1 (with Veo 2.0 fallback) | 300s |
| `api/check-video-status.ts` | `POST /api/check-video-status` | Poll Google LRO for video completion | 60s |
| `api/admin-set-credits.ts` | `POST /api/admin-set-credits` | Admin-only: set user credit balance | 30s |

### 3. Shared API Utilities (`api/_lib/`)

The `_lib/` prefix prevents Vercel from treating these as route handlers.

- **`api/_lib/cors.ts`** — CORS helper. Exports `corsHeaders` (record of header key/value pairs), `handleCors()` (sets headers on response), and `sendCorsResponse()` (sets headers + sends JSON with status code). All handlers apply these at the top before any logic.

- **`api/_lib/auth.ts`** — Auth middleware. `authenticateUser(req)` extracts the `Authorization: Bearer <token>` header, creates a Supabase client scoped to that token, and calls `supabase.auth.getUser()`. Returns `{ userId: string }` on success or `{ error, status }` on failure.

- **`api/_lib/supabase.ts`** — Two client factories:
  - `getServiceClient()` — uses `SUPABASE_SERVICE_ROLE_KEY`, bypasses RLS. Used for all DB writes in API handlers.
  - `getAuthClient(authHeader)` — uses `SUPABASE_ANON_KEY` with the user's `Authorization` header forwarded. Used only for identity verification in `authenticateUser`.

### 4. Supabase (Database + Auth + Storage)

**Authentication**: Supabase Auth (email/password). Sessions are stored in `localStorage` on the client; JWT is passed as `Authorization: Bearer <token>` to every API call.

**Database tables** (defined in `src/integrations/supabase/types.ts`):

| Table | Purpose |
|---|---|
| `profiles` | User profile + `credits` balance (integer) |
| `images` | Each generation job: `status`, `generated_image_urls[]`, `analysis_data`, `scene_id` |
| `processing_jobs` | Internal job queue for tracking multi-image generation progress |
| `scenes` | Library of named shooting scenes (editorial, ecommerce, model, etc.) with prompts |
| `user_models` | Saved custom AI model character configs (Character DNA) |
| `user_roles` | Role-based access; `role: 'admin'` gates admin features |
| `videos` | Video generation jobs: `operation_id` (Google LRO name), `status`, `video_url` |

**Storage**: `jewelry-images` bucket stores uploaded originals and generated outputs. The frontend uses `src/lib/getSignedImageUrl.ts` to generate signed 2-hour URLs from storage paths, with an in-memory cache.

**RLS**: Row-level security enforced on the client side by using the anon key + user JWT. Service role key (used by API handlers) bypasses RLS intentionally for server-side writes.

**Database functions (RPCs)**:
- `has_role(_user_id, _role)` — checks `user_roles` table
- `deduct_credits(_user_id, _amount)` — atomic credit deduction, returns `{ success, current_credits }`
- `refund_credits(_user_id, _amount)` — credit refund on video failure
- `admin_set_credits(_user_id, _credits)` — admin absolute credit set

---

## Data Flow

### Jewelry Image Generation (primary flow)

```
1. User uploads jewelry photo on /olustur (Generate.tsx)
   - Image is compressed client-side via src/lib/compressImage.ts (max 1.4 MB, 2048px)
   - User selects product type, scene, package, optional metal color + style reference

2. Frontend calls invokeApi('generate-jewelry', { body: { ... } })
   - src/lib/api.ts reads the session JWT from supabase.auth.getSession()
   - POSTs to /api/generate-jewelry with Authorization: Bearer <token>

3. api/generate-jewelry.ts handler:
   a. Applies CORS headers
   b. authenticateUser() validates the JWT
   c. Creates a job record in Supabase processing_jobs table (status: 'pending')
   d. Credits are deducted via RPC deduct_credits (admin users are exempt)
   e. Uploads the source image to Supabase Storage jewelry-images bucket
   f. PHASE 1 — Analysis: calls Gemini 2.5-flash (GOOGLE_ANALYSIS_API_KEY)
      with the jewelry image to extract a structured analysis_data JSON
      (type, metal, stones, proportions, visual_dna fingerprint)
   g. PHASE 2 — Generation: for each of 3 images, calls Gemini 3-pro
      (GOOGLE_API_KEY) with a scene-specific prompt built from the analysis.
      Prompts include: PRODUCT_IDENTITY_CARD (cross-image consistency),
      FIDELITY_BLOCK, scene description, lighting, camera angle, outfit config.
      3x retry with exponential backoff per image.
   h. Generated images are stored to Supabase Storage, URLs written to
      images.generated_image_urls[]
   i. Job status updated to 'completed' (or 'completed' if >= 1 of 3 succeeded)
   j. Returns { success: true, imageId, imageUrls[] }

4. Frontend navigates to /sonuclar?id=<imageId>
   - Results.tsx polls the images table via React Query (refetchInterval)
   - Displays generated images with lightbox, download, video generation buttons
```

### Video Generation (async long-running)

```
1. User clicks "Generate Video" on Results.tsx
   - VideoGenerateButton.tsx calls invokeApi('generate-video', { body: { imageUrl, videoId, promptType, videoFormat } })

2. api/generate-video.ts:
   a. Authenticates user, checks/deducts 200 credits
   b. Fetches source image as base64
   c. Calls Google Veo 3.1 (veo-3.1-fast-generate-preview) via @google/genai SDK
      - If multi-frame mode: includes lastFrame config for two-image interpolation
   d. On Veo 3.1 failure: falls back to Veo 2.0 REST API
   e. Stores Google LRO operation_id in videos.operation_id
   f. Returns immediately with { status: 'processing', operationId }

3. Frontend polls via useVideoStatusPolling hook (src/hooks/useVideoStatusPolling.ts)
   - Polls every 8 seconds by calling invokeApi('check-video-status', { body: { videoId } })
   - check-video-status.ts calls GET https://generativelanguage.googleapis.com/v1beta/<operationId>
   - When done: downloads video, uploads to Supabase Storage, updates videos.video_url
   - On failure: refunds 200 credits via refund_credits RPC
```

### Auth Flow

```
1. Signup (Signup.tsx) → supabase.auth.signUp() with email/password + metadata
2. Login (Login.tsx) → supabase.auth.signInWithPassword()
3. useAuth hook (src/hooks/useAuth.tsx):
   - Listens to supabase.auth.onAuthStateChange
   - Exposes { user, session, loading, signIn, signUp, signOut }
4. ProtectedRoute (src/components/auth/ProtectedRoute.tsx):
   - Redirects to /giris if no user
   - Shows spinner while loading === true
5. Every API call reads session.access_token and passes as Bearer token
```

---

## Key Abstractions

### CORS Helper (`api/_lib/cors.ts`)
Every handler starts with:
```typescript
Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
if (req.method === 'OPTIONS') return res.status(200).end();
```
The `sendCorsResponse(res, status, body)` function combines setting headers and writing the JSON response in one call. This prevents any endpoint from accidentally missing CORS headers.

### Auth Middleware (`api/_lib/auth.ts`)
`authenticateUser(req)` is a discriminated union return: either `{ userId }` (success) or `{ error, status }` (failure). Callers use a type guard:
```typescript
const authResult = await authenticateUser(req);
if ('error' in authResult) {
  return sendCorsResponse(res, authResult.status, { error: authResult.error });
}
```

### Frontend API Bridge (`src/lib/api.ts`)
`invokeApi(name, { body })` is the single function all frontend code uses to reach the serverless API. It:
1. Reads the current Supabase session JWT automatically
2. POSTs to `/api/<name>` with `Content-Type: application/json`
3. Returns `{ data, error }` — mirroring Supabase's own SDK interface for ease of use

This replaced a previous Supabase Edge Functions approach and centralizes all HTTP communication logic.

### Job Queue Model (processing_jobs table)
The `processing_jobs` table is a lightweight job tracking layer for image generation:
- Fields: `status`, `progress`, `completed_images`, `total_images`, `failed_image_indices`, `result_urls`, `credits_used`, `refunded`
- The API writes job state throughout the process; the frontend polls via React Query
- Partial success logic: 1 or more images completing out of 3 counts as `completed`
- Stuck job cleanup: jobs older than 3 minutes in non-terminal state are automatically cleaned up

### Character DNA System (`api/generate-jewelry.ts`, `api/generate-model.ts`)
Both the jewelry handler (for model-scene images) and the standalone model generator use a structured character identity system:
- 8 named `CharacterPersona` objects with deterministic physical attributes (skin tone, eye color, hair, heritage)
- `PRODUCT_TYPE_MODEL_CONFIG` maps jewelry product types (`yuzuk`, `kolye`, `kupe`, etc.) to body regions and appropriate pose lists
- `OUTFIT_POOL` (5 archetypes) matched to product type to ensure neckline/sleeve styling optimizes jewelry visibility
- All selected randomly per generation call, but internally consistent via structured prompt blocks

### Video Status Polling (`src/hooks/useVideoStatusPolling.ts`)
A custom React hook using `useRef` for timer tracking (not state, to avoid re-renders). For each video in `processing` or `generating` status:
- Initial poll starts after 3 seconds
- Subsequent polls every 8 seconds
- Stops automatically on `completed` or `error`
- Exposes `manualCheck(videoId)` for user-triggered refresh
- Uses TanStack React Query `invalidateQueries` to trigger UI refresh after each status check

---

## Entry Points

| Entry Point | Purpose |
|---|---|
| `index.html` | HTML shell; Vite injects `<script type="module" src="/src/main.tsx">` |
| `src/main.tsx` | React root — `createRoot(...).render(<App />)` |
| `src/App.tsx` | Router + provider tree; all routes defined here |
| `api/generate-jewelry.ts` | Primary AI generation serverless handler |
| `api/generate-video.ts` | Video generation serverless handler |
| `src/integrations/supabase/client.ts` | Singleton Supabase client (anon key, frontend) |
| `api/_lib/supabase.ts` | Supabase client factories (service role + auth-scoped, backend) |

---

## Environment Variables

### Frontend (Vite, `VITE_` prefix)
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key

### Backend (Vercel serverless, no prefix)
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anon key (for auth token verification)
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (bypasses RLS)
- `GOOGLE_API_KEY` — Gemini 3-pro image generation + Veo fallback
- `GOOGLE_ANALYSIS_API_KEY` — Gemini 2.5-flash analysis calls (separate key for quota isolation)
- `GOOGLE_VEO_API_KEY` — (optional) Dedicated Veo API key; falls back to `GOOGLE_API_KEY`
