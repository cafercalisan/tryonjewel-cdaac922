# TryOnJewel — External Integrations

## 1. Google Gemini (AI)

The project uses two distinct Google API keys to keep analysis and generation traffic separate.

### Models in Use

| Model | Constant | Used In | Purpose |
|-------|----------|---------|---------|
| `models/gemini-2.5-flash` | `ANALYSIS_MODEL` | `api/generate-jewelry.ts` | Jewelry attribute analysis (type, metal, stones, visual DNA) and style reference analysis |
| `gemini-3-pro-image-preview` | `IMAGE_GEN_MODEL` | `api/generate-jewelry.ts` | 4K image generation (3 images per job, with 3x retry per image) |
| Dynamic discovery | — | `api/generate-design.ts` | Marketing design generation; queries `GET /v1beta/models` at runtime to find a working image-generation model |
| Gemini (via `GOOGLE_API_KEY`) | — | `api/generate-model.ts` | Character DNA model image generation |
| `veo-3.1-fast-generate-preview` | — | `api/generate-video.ts` | Primary video generation (image-to-video, multi-frame) |
| `veo-2.0-generate-001` | — | `api/generate-video.ts` | Veo 2.0 fallback when Veo 3.1 fails |

### API Endpoints Called Directly (REST)

All calls go to Google's Generative Language API:

```
# Image generation (generate-jewelry.ts)
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=<GOOGLE_API_KEY>

# Analysis (generate-jewelry.ts, style reference)
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=<GOOGLE_ANALYSIS_API_KEY>

# Design model discovery (generate-design.ts)
GET  https://generativelanguage.googleapis.com/v1beta/models?key=<GOOGLE_API_KEY>

# Veo 2.0 video (generate-video.ts fallback)
POST https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning?key=<GOOGLE_API_KEY>

# Operation status polling (check-video-status.ts)
GET  https://generativelanguage.googleapis.com/v1beta/<operation_name>
     Header: x-goog-api-key: <GOOGLE_API_KEY>
```

The SDK `@google/genai ^1.41.0` is used for Veo 3.1 in `api/generate-video.ts`:
```ts
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
await ai.models.generateVideos({ model: 'veo-3.1-fast-generate-preview', ... });
```

### Image Generation Config

```ts
generationConfig: {
  responseModalities: ['TEXT', 'IMAGE'],
  temperature: 0.12,          // start; retries use 0.17, 0.22
  imageConfig: {
    aspectRatio: '3:4',       // default portrait; overridable
    imageSize: '4K',
  },
}
```

- 3 images generated in parallel per job via `waitUntil` (`@vercel/functions`)
- Each image has 3 retry attempts with increasing temperature and delay (0ms, 3000ms, 5000ms)
- Partial success policy: 1+ of 3 images = job marked `completed`
- Max image payload size before rejection: 1.5 MB (`MAX_IMAGE_SIZE`)

---

## 2. Supabase

Supabase is used for authentication, database, and file storage.

### Client Factories (`api/_lib/supabase.ts`)

```ts
// Service role — bypasses RLS, used for admin ops, job updates, storage uploads
getServiceClient()  // uses SUPABASE_SERVICE_ROLE_KEY

// User-scoped — respects RLS, used for auth verification
getAuthClient(authHeader)  // passes Authorization header through to Supabase
```

Frontend uses the public anon client from `src/integrations/supabase/client` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### Authentication

- Standard Supabase Auth (JWT tokens in `Authorization: Bearer <token>`)
- `api/_lib/auth.ts` → `authenticateUser()` extracts the token, calls `supabase.auth.getUser()`, returns `{ userId }` or `{ error, status }`
- `check-video-status.ts` and `generate-video.ts` use `getServiceClient().auth.getUser(token)` directly instead of the shared helper

### Database Tables (inferred from API code)

| Table | Used In | Key Operations |
|-------|---------|---------------|
| `processing_jobs` | `generate-jewelry.ts` | INSERT on job start; UPDATE `status`, `current_step`, `progress`, `result_urls`, `error_message` throughout generation |
| `generated_images` | `generate-jewelry.ts` | INSERT record before generation; UPDATE with result URLs |
| `videos` | `generate-video.ts`, `check-video-status.ts` | INSERT/UPDATE `status`, `prompt`, `operation_id`, `video_url`, `error_message` |
| (user profiles / credits) | All generation handlers | Queried for credit balances |

### Database RPCs (Stored Procedures)

| RPC | Called In | Purpose |
|-----|----------|---------|
| `has_role(_user_id, _role)` | `generate-jewelry.ts`, `generate-video.ts`, `check-video-status.ts`, `admin-set-credits.ts` | Returns boolean; role `'admin'` skips credit deduction |
| `deduct_credits(_user_id, _amount)` | `generate-jewelry.ts`, `generate-video.ts` | Atomically deducts credits; returns `{ success, current_credits }` |
| `refund_credits(_user_id, _amount)` | `check-video-status.ts` | Refunds credits on video failure or content filter block |
| `admin_set_credits(_user_id, _credits)` | `admin-set-credits.ts` | Admin-only: set absolute credit balance |

### Credit Costs (hardcoded constants)

| Operation | Cost |
|-----------|------|
| Video generation | 200 credits |
| Jewelry image generation | varies by package (`creditsNeeded` param) |

Admins (role `'admin'`) bypass all credit checks.

### Storage

All files go into the **`jewelry-images`** bucket.

| Path Pattern | Content | Created By |
|-------------|---------|-----------|
| `{userId}/generated/{imageRecordId}-{index}.png` | AI-generated jewelry images | `generate-jewelry.ts` |
| `{userId}/style-references/...` | Uploaded style reference images | frontend upload |
| `videos/{videoId}.mp4` | Completed video files (downloaded from Google URI) | `check-video-status.ts` |

Signed URLs (7-day expiry) are used for generated image delivery:
```ts
supabase.storage.from('jewelry-images').createSignedUrl(filePath, 7 * 24 * 60 * 60)
```

---

## 3. Vercel

### Deployment Config (`vercel.json`)

```json
{
  "buildCommand": "vite build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
}
```

All routes not starting with `/api/` are rewritten to `index.html` for SPA navigation.

### Serverless Function Config

Each handler exports `export const config = { maxDuration: N }` to override Vercel's default function timeout:

- `generate-jewelry.ts`, `generate-design.ts`, `generate-model.ts`, `generate-video.ts` → **300 seconds** (max on Pro plan)
- `check-video-status.ts` → **60 seconds**
- `admin-set-credits.ts` → **30 seconds**

`waitUntil` from `@vercel/functions` is used in `generate-jewelry.ts` to keep the background parallel image generation running after the initial HTTP response is sent.

### Frontend API Helper (`src/lib/api.ts`)

```ts
export async function invokeApi(name: string, options: { body?: any } = {})
```

Wraps `fetch('/api/<name>', { method: 'POST', ... })`, attaches the Supabase session JWT as `Authorization: Bearer <token>`. This replaced the previous `supabase.functions.invoke()` approach when the project moved off the Lovable platform.

---

## 4. Environment Variables

### Backend (Vercel server-side only)

| Variable | Used In | Purpose |
|----------|---------|---------|
| `SUPABASE_URL` | `api/_lib/supabase.ts` | Supabase project URL |
| `SUPABASE_ANON_KEY` | `api/_lib/supabase.ts` | Public anon key (for user-scoped auth client) |
| `SUPABASE_SERVICE_ROLE_KEY` | `api/_lib/supabase.ts` | Service role key (bypasses RLS) |
| `GOOGLE_API_KEY` | `generate-jewelry.ts`, `generate-design.ts`, `generate-model.ts`, `generate-video.ts`, `check-video-status.ts` | Primary Google API key (image generation, video, model discovery) |
| `GOOGLE_ANALYSIS_API_KEY` | `generate-jewelry.ts` | Separate key for Gemini 2.5 Flash analysis calls |
| `GOOGLE_VEO_API_KEY` | `generate-video.ts`, `check-video-status.ts` | Optional dedicated Veo key; falls back to `GOOGLE_API_KEY` if not set |

### Frontend (Vite — exposed to browser via `VITE_` prefix)

| Variable | Used In | Purpose |
|----------|---------|---------|
| `VITE_SUPABASE_URL` | `src/integrations/supabase/client` | Supabase project URL for browser client |
| `VITE_SUPABASE_ANON_KEY` | `src/integrations/supabase/client` | Anon key for browser client |

---

## 5. Webhooks & Callbacks

There are **no inbound webhooks**. The project uses a polling pattern instead:

- **Video status polling**: Frontend calls `POST /api/check-video-status` on a 2-second interval (up to 5-minute timeout per project memory). The handler polls the Google long-running operation endpoint `GET https://generativelanguage.googleapis.com/v1beta/<operation_name>`.
- **Stuck job cleanup**: Jobs stuck in `generating` state are auto-cleaned after 3 minutes (per project memory; cleanup logic is in the frontend or a scheduled check, not a webhook).
- **No Supabase Realtime subscriptions** are visible in the API layer; the frontend may use them directly for job progress updates.
