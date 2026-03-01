# TryOnJewel – Testing

## Status: No Tests

There are no test files in the project source. A search for `*.test.*` and `*.spec.*` files under the project root returns only files inside `node_modules/` (from third-party packages such as `react-day-picker` and `zod`).

There is no test framework installed. The `package.json` scripts section contains:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "build:dev": "vite build --mode development",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

No `test`, `test:watch`, or `test:coverage` script exists. No test runner (`vitest`, `jest`, `@testing-library/react`, `playwright`, `cypress`) appears in `dependencies` or `devDependencies`.

ESLint is configured (`eslint.config.js`) with `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh`. This is the only automated code quality tool that runs.

---

## Manual Testing Approach (Inferred)

Based on the codebase structure, testing is done manually against the live deployed environment or the local dev server:

```
npm run dev   # starts Vite at localhost:5173
```

The Vercel serverless functions require Vercel CLI (`vercel dev`) or deployment to a preview environment to be callable, since they run in Node and are not served by Vite.

### Critical User Flows to Verify Manually

**Authentication**
- Sign up with a new email (`/kayit`)
- Log in with an existing account (`/giris`)
- Protected routes redirect unauthenticated users (enforced by `src/components/auth/ProtectedRoute.tsx`)
- Auth token is attached to API calls (`src/lib/api.ts` reads session from Supabase)

**Image Generation — Generate Page (`/olustur`)**
- Upload 1–4 jewelry images (drag-and-drop and file picker)
- Images larger than 1.4 MB are compressed client-side (`src/lib/compressImage.ts`)
- Select package type: Standard (3 scenes), Single, or Retouch
- Standard package: select exactly 3 scenes; Generate button disabled until 3 are chosen
- Submission calls `api/generate-jewelry.ts` via `invokeApi`
- Polling begins immediately after job submission (2-second interval, 5-minute timeout)
- Generation step UI updates: `analyzing` → `generating` → `finalizing`
- Success navigates to `/sonuclar?id=<imageId>`
- Failure shows a toast error and resets the form state
- Transient errors (502, 503, 429) trigger automatic retries with exponential backoff

**Model Generation (`/modellerim`)**
- Create a new model via character DNA form
- Generate poses for an existing model
- Model record is saved to `user_models` table after generation

**Video Generation (`/videolarim`)**
- Generate video from an image
- Status polling starts automatically for processing videos (8-second interval)
- Manual re-check button triggers `check-video-status` API

**Credits**
- Credit balance displayed in the summary panel
- Insufficient credits disables the Generate button
- Admin users bypass credit checks (checked via Supabase `has_role` RPC)

**Gallery (`/gorsellerim`)**
- Generated images appear with signed URLs
- Download button triggers browser download
- Video generation button appears on eligible images

---

## What Would Need Testing

The following areas carry the most logic risk and would be the first candidates if tests were added:

### Unit Tests (Pure Logic)

**`src/lib/compressImage.ts`**
- `compressImage()` correctly reduces file size below threshold
- `compressImage()` returns original file if already small enough
- `formatFileSize()` correctly formats bytes, KB, MB

**`src/lib/validation.ts`**
- Zod schemas accept valid inputs
- Zod schemas reject invalid inputs with correct error messages (Turkish locale)
- Edge cases: empty strings, max-length strings, Turkish character regex

**`src/lib/api.ts` — `invokeApi`**
- Attaches Bearer token when session exists
- Returns `{ data: null, error }` on network failure
- Returns `{ data, error: null }` on 200 response
- Returns `{ data, error }` with error.status on non-200 response

**`src/pages/Generate.tsx` — `invokeWithRetry`**
- Retries on 502/503/429 up to 3 times
- Does not retry on 400/500 errors
- Exponential backoff timing is applied between retries

### Integration Tests (Component + Hooks)

**`useAuth` hook**
- Renders children when authenticated
- `ProtectedRoute` redirects to `/giris` when unauthenticated

**`useProfile` hook**
- Returns profile data when user is authenticated
- Returns `null` when user is `null`

**`canGenerate` logic in `Generate` page**
- False when no images uploaded
- False when insufficient credits (non-admin)
- True for Standard package only when exactly 3 scenes selected
- True for Single package when style reference OR custom prompt is present
- True for Retouch package when image is uploaded

### API/E2E Tests (Serverless Functions)

**`api/_lib/auth.ts` — `authenticateUser`**
- Returns `{ error: 'Unauthorized', status: 401 }` when no Authorization header
- Returns `{ error: 'Unauthorized', status: 401 }` with invalid token
- Returns `{ userId }` with valid token

**`api/generate-jewelry.ts`**
- Returns 401 without auth
- Returns 400 with missing required body fields
- Returns 429 when Gemini rate limit is hit
- Returns 200 with `{ success: true, jobId, imageId }` on success
- Stuck job cleanup fires after 3 minutes of no progress

**`api/generate-model.ts`**
- Correctly distinguishes new model creation from pose generation based on `modelData` + `poseType`
- Returns `{ success: true, imageUrl }` for pose generation
- Returns `{ success: true, model: modelRecord }` for new model creation

---

## Recommended Test Setup (If Adding Tests)

Given the Vite + TypeScript + React stack, the natural choice is:

**Unit + Component tests:** [Vitest](https://vitest.dev/) + [@testing-library/react](https://testing-library.com/docs/react-testing-library/intro/)

```
npm install -D vitest @testing-library/react @testing-library/user-event jsdom
```

Add to `package.json`:
```json
"test": "vitest",
"test:ui": "vitest --ui",
"test:coverage": "vitest run --coverage"
```

Add to `vite.config.ts`:
```ts
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: './src/test/setup.ts',
}
```

**API/E2E tests:** [Playwright](https://playwright.dev/) against a `vercel dev` local environment, or dedicated unit tests for pure API logic by extracting business logic into testable functions separate from the Vercel handler.

**Priority order for first tests:**
1. `src/lib/validation.ts` — pure functions, zero dependencies
2. `src/lib/compressImage.ts` — pure functions (mock Canvas API)
3. `src/lib/api.ts` — mock `fetch`, verify token attachment and error normalization
4. `api/_lib/auth.ts` — mock Supabase client, verify auth flow
5. `canGenerate` logic in `src/pages/Generate.tsx` — extract to a pure function first
