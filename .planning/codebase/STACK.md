# TryOnJewel — Tech Stack

## Languages & Runtimes

- **TypeScript 5.8.3** — used across frontend and all serverless API handlers
- **Node.js** — runtime for Vercel serverless functions (no explicit engine pin in `package.json`; Vercel defaults to Node 20.x for `@vercel/node ^5`)
- **ES module project** — `"type": "module"` in `package.json`

### TypeScript Config Split

Two configs, one root coordinator:

- `tsconfig.json` — root references file; sets shared loose linting flags (`noImplicitAny: false`, `strictNullChecks: false`, `skipLibCheck: true`, `allowJs: true`). Path alias `@/*` → `./src/*`
- `tsconfig.app.json` — frontend target: `ES2020`, lib `[ES2020, DOM, DOM.Iterable]`, module `ESNext`, bundler `moduleResolution`, `jsx: react-jsx`, `strict: false`, `noEmit: true`. Includes `src/`
- `tsconfig.node.json` — build tooling target: `ES2022`, lib `ES2023`, `strict: true`, `noFallthroughCasesInSwitch: true`. Includes only `vite.config.ts`

---

## Frontend

### Framework & Build

| Tool | Version | Notes |
|------|---------|-------|
| React | ^18.3.1 | with `react-dom ^18.3.1` |
| Vite | ^5.4.19 | SPA bundler |
| `@vitejs/plugin-react-swc` | ^3.11.0 | SWC-based fast transform (replaces Babel) |

**`vite.config.ts`** key settings:
```ts
server: { host: '::', port: 8080 }
resolve.alias: { '@': path.resolve(__dirname, './src') }
plugins: [react()]
```

**`vercel.json`** build config:
```json
{
  "buildCommand": "vite build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
}
```
The rewrite rule serves `index.html` for all non-`/api/` routes (client-side routing).

### UI & Styling

| Library | Version | Role |
|---------|---------|------|
| Tailwind CSS | ^3.4.17 | Utility CSS |
| `tailwindcss-animate` | ^1.0.7 | Animation utilities |
| `tailwind-merge` | ^2.6.0 | Merges conflicting Tailwind classes |
| `@tailwindcss/typography` | ^0.5.16 | Prose typographic styles (dev dep) |
| `class-variance-authority` | ^0.7.1 | Component variant API (CVA) |
| `clsx` | ^2.1.1 | Conditional class names |
| PostCSS + autoprefixer | ^8.5.6 / ^10.4.21 | CSS post-processing |
| `next-themes` | ^0.3.0 | Dark/light theme toggling |
| `@paper-design/shaders-react` | ^0.0.71 | Animated mesh gradient shader (hero background) |

**shadcn/ui** — the full Radix UI component set is installed (accordion through tooltip, 24 packages). These are wired through CVA and Tailwind, with `lucide-react ^0.462.0` for icons.

### State, Data & Forms

| Library | Version | Role |
|---------|---------|------|
| `@tanstack/react-query` | ^5.83.0 | Server state / caching |
| `react-hook-form` | ^7.61.1 | Form state |
| `@hookform/resolvers` | ^3.10.0 | Zod adapter for react-hook-form |
| `zod` | ^3.25.76 | Schema validation |
| `react-router-dom` | ^6.30.1 | Client-side routing |

### Animation & UI Extras

| Library | Version | Role |
|---------|---------|------|
| `framer-motion` | ^12.24.11 | Animations/transitions |
| `embla-carousel-react` | ^8.6.0 | Carousel |
| `react-resizable-panels` | ^2.1.9 | Resizable panel layouts |
| `recharts` | ^2.15.4 | Charts |
| `sonner` | ^1.7.4 | Toast notifications |
| `vaul` | ^0.9.9 | Drawer component |
| `cmdk` | ^1.1.1 | Command palette |
| `input-otp` | ^1.4.2 | OTP input |
| `react-day-picker` | ^8.10.1 | Date picker |
| `date-fns` | ^3.6.0 | Date utilities |

---

## Backend — Vercel Serverless Functions

All handlers live in `api/` and use `@vercel/node ^5.6.2` types + `@vercel/functions ^3.4.2` runtime utilities.

### Handler Files

| File | `maxDuration` | Purpose |
|------|--------------|---------|
| `api/generate-jewelry.ts` | 300s | Main generation: analysis + 3 parallel 4K images via Gemini |
| `api/generate-design.ts` | 300s | Marketing design generation (Instagram/banner) |
| `api/generate-model.ts` | 300s | AI model/character image generation (Character DNA system) |
| `api/generate-video.ts` | 300s | Video generation via Veo 3.1 → Veo 2.0 fallback |
| `api/check-video-status.ts` | 60s | Polls Google long-running operation, uploads result to Supabase Storage |
| `api/admin-set-credits.ts` | 30s | Admin-only credit management via Supabase RPC |

### Shared Utilities (`api/_lib/`)

| File | Exports | Purpose |
|------|---------|---------|
| `api/_lib/cors.ts` | `corsHeaders`, `handleCors()`, `sendCorsResponse()` | CORS headers for all responses; origin `*` |
| `api/_lib/auth.ts` | `authenticateUser()` | Validates `Authorization: Bearer <token>` via Supabase auth |
| `api/_lib/supabase.ts` | `getServiceClient()`, `getAuthClient()` | Two Supabase client factories: service role (admin ops) and user-scoped auth client |

### Pattern: All handlers follow this structure
1. Apply CORS headers and handle `OPTIONS` preflight
2. Authenticate user via `authenticateUser()` or direct `supabase.auth.getUser()`
3. Validate request body
4. Execute business logic
5. Return via `sendCorsResponse()`

---

## Dev Tooling

| Tool | Version | Config |
|------|---------|--------|
| ESLint | ^9.32.0 | `@eslint/js`, `typescript-eslint ^8.38.0`, `eslint-plugin-react-hooks ^5.2.0`, `eslint-plugin-react-refresh ^0.4.20` |
| `globals` | ^15.15.0 | ESLint global env definitions |
| npm scripts | — | `dev` (Vite dev server on :8080), `build` (Vite production), `build:dev` (Vite dev mode), `lint` (ESLint), `preview` |

No test framework is installed. No Prettier config found in `package.json`.
