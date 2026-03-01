# TryOnJewel — Directory Structure

## Full Directory Tree

```
tryonjewel-cdaac922/
├── index.html                        # Vite HTML shell entry point
├── package.json                      # Dependencies + npm scripts
├── vite.config.ts (implicit)         # Vite build config
├── postcss.config.js                 # PostCSS (Tailwind pipeline)
├── tailwind.config.ts (implicit)     # Tailwind configuration
├── components.json                   # shadcn/ui component registry config
├── eslint.config.js                  # ESLint flat config
├── tsconfig.json (implicit)          # TypeScript config
├── bun.lockb                         # Bun lockfile (package manager used for installs)
├── package-lock.json                 # npm lockfile
│
├── api/                              # Vercel Serverless Functions (backend)
│   ├── _lib/                         # Shared utilities (NOT exposed as routes)
│   │   ├── cors.ts                   # CORS headers + response helpers
│   │   ├── auth.ts                   # JWT authentication middleware
│   │   └── supabase.ts              # Supabase client factories (service + auth-scoped)
│   ├── generate-jewelry.ts           # Core: analyze + generate 3 images (Gemini)
│   ├── generate-design.ts            # Marketing campaign design generation
│   ├── generate-model.ts             # AI fashion model portrait generation
│   ├── generate-video.ts             # Video generation (Veo 3.1 + 2.0 fallback)
│   ├── check-video-status.ts         # Long-running operation status polling
│   └── admin-set-credits.ts          # Admin: set user credit balance
│
├── src/                              # Frontend source (Vite + React + TypeScript)
│   ├── main.tsx                      # React entry point (createRoot)
│   ├── App.tsx                       # Router root + provider tree
│   ├── App.css                       # Global app styles (minimal)
│   ├── index.css                     # Tailwind @layer base/components/utilities
│   ├── vite-env.d.ts                 # Vite env type declarations
│   │
│   ├── pages/                        # Route-level page components (one per route)
│   │   ├── Landing.tsx               # Public: marketing landing page
│   │   ├── Examples.tsx              # Public: before/after showcase gallery
│   │   ├── Scenes.tsx                # Public: available shooting scenes catalog
│   │   ├── PremiumHeroDemo.tsx       # Public: isolated hero component demo
│   │   ├── Login.tsx                 # Public: email/password login form
│   │   ├── Signup.tsx                # Public: registration form (with Zod validation)
│   │   ├── Dashboard.tsx             # Protected: home panel, recent images, quick actions
│   │   ├── Generate.tsx              # Protected: jewelry image generation wizard
│   │   ├── Results.tsx               # Protected: view generated images, download, video
│   │   ├── Gallery.tsx               # Protected: full image history browser
│   │   ├── CreateDesign.tsx          # Protected: marketing design creation form
│   │   ├── DesignResults.tsx         # Protected: view generated marketing designs
│   │   ├── ModelGallery.tsx          # Protected: saved AI model character gallery
│   │   ├── Videos.tsx                # Protected: generated videos list + player
│   │   ├── Account.tsx               # Protected: profile settings, credit balance
│   │   ├── Admin.tsx                 # Protected (admin role): user management, credits
│   │   ├── Index.tsx                 # Redirect placeholder
│   │   └── NotFound.tsx              # 404 catch-all
│   │
│   ├── components/                   # Reusable UI components, grouped by domain
│   │   ├── auth/
│   │   │   └── ProtectedRoute.tsx    # Auth guard: redirects to /giris if unauthenticated
│   │   │
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx         # Shell wrapper: Header + main + Footer + bg gradients
│   │   │   ├── Header.tsx            # Navigation bar with auth state + credit display
│   │   │   └── Footer.tsx            # Site footer with links
│   │   │
│   │   ├── generate/                 # Components for the Generate page wizard
│   │   │   ├── UploadArea.tsx        # Drag-and-drop jewelry image upload
│   │   │   ├── ProductTypeSelector.tsx # Jewelry type picker (ring, necklace, earring, etc.)
│   │   │   ├── MetalColorSelector.tsx  # Gold/silver/rose gold color toggle
│   │   │   ├── SceneSelector.tsx     # Scene card grid with preview images
│   │   │   ├── PackageSelector.tsx   # Package type (standard 3-image, single, retouch)
│   │   │   ├── StyleReferenceUpload.tsx # Optional style reference image upload
│   │   │   ├── ModelCreator.tsx      # UI for creating/editing Character DNA model configs
│   │   │   ├── ModelSelector.tsx     # Select from saved user_models
│   │   │   ├── ColorPalette.tsx      # Color accent picker UI
│   │   │   ├── SkuInput.tsx          # SKU/product code text input
│   │   │   ├── GeneratingPanel.tsx   # Animated progress overlay during generation
│   │   │   └── SummaryPanel.tsx      # Pre-submit order summary display
│   │   │
│   │   ├── gallery/
│   │   │   ├── BeforeAfterComparison.tsx  # Side-by-side before/after image layout
│   │   │   └── ImageNavigator.tsx         # Keyboard/arrow navigation for image sets
│   │   │
│   │   ├── design/
│   │   │   └── DesignGeneratingOverlay.tsx # Loading state overlay for design generation
│   │   │
│   │   ├── video/
│   │   │   ├── VideoGenerateButton.tsx    # Button + modal to trigger video generation
│   │   │   └── VideoPlayer.tsx            # HTML5 video player with download
│   │   │
│   │   ├── landing/                  # Landing page section components
│   │   │   ├── PremiumHero.tsx       # Animated mesh gradient hero (WebGL shader)
│   │   │   ├── AnimatedWord.tsx      # Rotating word animation in hero text
│   │   │   ├── BeforeAfterShowcase.tsx    # Landing: before/after pairs
│   │   │   ├── ImageComparisonSlider.tsx  # Draggable split-view slider
│   │   │   ├── InfiniteProductShowcase.tsx # Auto-scrolling product image carousel
│   │   │   └── TransformationGallery.tsx  # Grid gallery of transformation examples
│   │   │
│   │   ├── ui/                       # shadcn/ui primitive components (auto-generated)
│   │   │   ├── button.tsx            # Button variants
│   │   │   ├── dialog.tsx            # Modal dialog
│   │   │   ├── image-lightbox.tsx    # Full-screen image lightbox (custom addition)
│   │   │   ├── toast.tsx             # Toast notification primitives
│   │   │   ├── toaster.tsx           # Toast container
│   │   │   ├── sonner.tsx            # Sonner toast integration
│   │   │   ├── tabs.tsx, card.tsx, input.tsx, select.tsx, ...  # Standard Radix-based primitives
│   │   │   └── (30+ additional shadcn primitives)
│   │   │
│   │   └── NavLink.tsx               # Active-state-aware nav link wrapper
│   │
│   ├── hooks/                        # Custom React hooks
│   │   ├── useAuth.tsx               # AuthContext provider + useAuth() hook
│   │   ├── useProfile.tsx            # useProfile(), useUpdateProfile(), useDeductCredit()
│   │   ├── useIsAdmin.ts             # Checks user_roles table for 'admin' role
│   │   ├── useVideoStatusPolling.ts  # Polls check-video-status for in-progress videos
│   │   ├── use-mobile.tsx            # Responsive breakpoint detection hook
│   │   └── use-toast.ts             # shadcn toast hook
│   │
│   ├── lib/                          # Pure utility functions (no React)
│   │   ├── api.ts                    # invokeApi(): frontend HTTP bridge to /api/* routes
│   │   ├── compressImage.ts          # Canvas-based JPEG compression (max 1.4 MB, 2048px)
│   │   ├── downloadImage.ts          # Fetch + trigger browser download for images
│   │   ├── getSignedImageUrl.ts      # Supabase Storage signed URL generator + 1hr cache
│   │   ├── jewelryFacts.ts           # Static copy: fun facts displayed during generation
│   │   ├── utils.ts                  # shadcn cn() utility (clsx + tailwind-merge)
│   │   └── validation.ts             # Zod schemas: signupSchema, loginSchema, profileUpdateSchema
│   │
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts             # Singleton supabase client (anon key, localStorage session)
│   │       └── types.ts              # Auto-generated Supabase TypeScript types (Database schema)
│   │
│   └── assets/                       # Static assets bundled by Vite
│       ├── moore-logo.png            # Brand logo
│       └── showcase/                 # Pre-built before/after showcase images (.webp)
│           ├── emerald-bracelet-original.webp
│           ├── emerald-bracelet-result-1.webp
│           ├── emerald-bracelet-result-2.webp
│           ├── emerald-bracelet-result-3.webp
│           ├── ring-original.webp / ring-result.webp
│           ├── earring-original.webp / earring-result.webp
│           ├── sapphire-bracelet-*.webp
│           ├── blue-sapphire-bracelet-*.webp
│           └── diamond-set-original.webp
│
├── public/                           # Static files served as-is (not bundled)
│   ├── favicon.ico
│   ├── robots.txt
│   ├── placeholder.svg
│   ├── lovable-uploads/              # Legacy uploaded assets
│   └── landing/                     # Landing page before/after image pairs
│       ├── before-1.jpg ... before-8.jpg
│       └── after-1.jpg ... after-custom.jpg
│
├── supabase/                         # Supabase local dev + migration files
│   ├── config.toml                   # Supabase CLI project config
│   ├── migrations/                   # SQL migration files (timestamped)
│   │   ├── 20260107201226_*.sql      # Initial schema
│   │   ├── 20260108080841_*.sql
│   │   ├── 20260108202024_*.sql
│   │   ├── 20260108232301_*.sql
│   │   ├── 20260109091129_*.sql
│   │   ├── 20260111171635_*.sql
│   │   └── 20260111174049_*.sql      # Most recent migration
│   ├── functions/                    # Legacy Supabase Edge Functions (superseded by api/)
│   │   ├── generate-jewelry/index.ts
│   │   ├── generate-design/index.ts
│   │   ├── generate-model/index.ts
│   │   ├── generate-video/index.ts
│   │   ├── check-video-status/index.ts
│   │   └── admin-set-credits/index.ts
│   └── .temp/                        # Supabase CLI temp files (gitignored)
│
├── .vercel/
│   ├── project.json                  # Vercel project + org IDs
│   └── README.txt
│
├── .vscode/
│   └── launch.json                   # VS Code debug configuration
│
├── .claude/                          # Claude Code settings
│   ├── settings.local.json
│   └── skills/                       # Claude skill definitions
│
├── .env                              # Local environment variables (gitignored)
├── .env.example                      # Environment variable template
└── .gitignore
```

---

## Key File Locations

### API Endpoints
All serverless function handlers live in `api/` at the project root. Vercel maps each file automatically to its route:
- `api/generate-jewelry.ts` → `POST /api/generate-jewelry`
- `api/generate-design.ts` → `POST /api/generate-design`
- `api/generate-model.ts` → `POST /api/generate-model`
- `api/generate-video.ts` → `POST /api/generate-video`
- `api/check-video-status.ts` → `POST /api/check-video-status`
- `api/admin-set-credits.ts` → `POST /api/admin-set-credits`

### Shared Backend Utilities
`api/_lib/` contains three modules imported by all handlers:
- `api/_lib/cors.ts` — `corsHeaders`, `handleCors()`, `sendCorsResponse()`
- `api/_lib/auth.ts` — `authenticateUser(req)`
- `api/_lib/supabase.ts` — `getServiceClient()`, `getAuthClient(authHeader)`

The `_lib` prefix convention is Vercel's mechanism for private modules — any path starting with `_` is not treated as a route.

### Frontend Pages
All page-level components are in `src/pages/`. Each file corresponds to exactly one route defined in `src/App.tsx`. Page components:
- Import `AppLayout` for the standard Header/Footer shell
- Use `useAuth()` and `useProfile()` hooks for user state
- Call `invokeApi()` from `src/lib/api.ts` for all backend communication
- Use TanStack React Query (`useQuery`, `useMutation`) for data fetching and caching

### Frontend Components
`src/components/` is organized into domain sub-directories:
- `auth/` — Route guards
- `layout/` — Page shell (Header, Footer, AppLayout)
- `generate/` — Wizard step components for the generation flow
- `gallery/` — Image comparison and navigation
- `design/` — Marketing design flow
- `video/` — Video player and generation trigger
- `landing/` — Marketing site section components
- `ui/` — shadcn/ui primitives (Radix-based, auto-generated via `components.json`)

### Frontend Utilities (`src/lib/`)
Non-React pure utility modules:
- `src/lib/api.ts` — The single HTTP bridge; all `invokeApi()` calls go through here
- `src/lib/compressImage.ts` — Canvas compression before upload
- `src/lib/getSignedImageUrl.ts` — Supabase Storage URL management with caching
- `src/lib/validation.ts` — Zod schemas for forms (signup, login, profile update)
- `src/lib/utils.ts` — `cn()` utility (Tailwind class merging)

### Supabase Integration (`src/integrations/supabase/`)
- `src/integrations/supabase/client.ts` — Frontend singleton: `createClient<Database>(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)` with localStorage session persistence
- `src/integrations/supabase/types.ts` — Auto-generated full TypeScript type definitions for all database tables, enums, functions, and relationships

### Custom Hooks (`src/hooks/`)
- `src/hooks/useAuth.tsx` — Context provider + consumer for Supabase auth state
- `src/hooks/useProfile.tsx` — `useProfile()`, `useUpdateProfile()`, `useDeductCredit()` React Query wrappers
- `src/hooks/useIsAdmin.ts` — Queries `user_roles` table for admin role check
- `src/hooks/useVideoStatusPolling.ts` — Manages setTimeout-based polling for in-progress video jobs

---

## Naming Conventions

### Files
- **Page components**: PascalCase matching the route concept in English (`Generate.tsx`, `Dashboard.tsx`, `ModelGallery.tsx`)
- **Feature components**: PascalCase, named by function (`UploadArea.tsx`, `GeneratingPanel.tsx`, `VideoGenerateButton.tsx`)
- **Hooks**: camelCase with `use` prefix (`useAuth.tsx`, `useProfile.tsx`, `useVideoStatusPolling.ts`)
- **Utilities**: camelCase describing the action (`compressImage.ts`, `downloadImage.ts`, `getSignedImageUrl.ts`)
- **API handlers**: kebab-case matching the route (`generate-jewelry.ts`, `check-video-status.ts`)
- **shadcn/ui components**: kebab-case (`image-lightbox.tsx`, `alert-dialog.tsx`, `use-toast.ts`)

### Directories
- Domain grouping in `src/components/`: `auth/`, `layout/`, `generate/`, `gallery/`, `design/`, `video/`, `landing/`, `ui/`
- Private backend modules: `api/_lib/` (underscore prefix prevents Vercel routing)
- Supabase integration isolated: `src/integrations/supabase/` (rather than mixed into `src/lib/`)

### Routes (Turkish)
All authenticated app routes use Turkish slugs, matching the target market:
- `/panel` (dashboard/panel)
- `/olustur` (generate/create)
- `/sonuclar` (results)
- `/gorsellerim` (my images)
- `/modellerim` (my models)
- `/videolarim` (my videos)
- `/hesap` (account)
- `/giris` (login)
- `/kayit` (signup)
- `/ornekler` (examples)
- `/sahneler` (scenes)
- `/tasarim-olustur` / `/tasarim-sonuc` (design create/result)

### Supabase Table Columns
- snake_case throughout (PostgreSQL convention)
- UUID primary keys (`id`)
- Timestamps: `created_at`, `updated_at`
- Status values are strings: `'pending'`, `'processing'`, `'generating'`, `'completed'`, `'error'`
- Image URL arrays: `generated_image_urls` (string[])

---

## File Organization Patterns

### The Generate Flow (multi-file collaboration)
The jewelry generation feature spans multiple files that work as a unit:
1. `src/pages/Generate.tsx` — Orchestrator page: holds all form state, calls API, navigates to results
2. `src/components/generate/*.tsx` — Individual wizard step components (stateless, receive props/callbacks)
3. `src/lib/compressImage.ts` — Pre-upload image preparation
4. `src/lib/api.ts` — HTTP call to backend
5. `api/generate-jewelry.ts` — The actual generation handler

### API Handler Pattern
Every handler in `api/` follows the same structure:
```typescript
export const config = { maxDuration: N };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Apply CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 2. Check environment variables
    // 3. Authenticate user (authenticateUser or inline)
    // 4. Validate request body
    // 5. Business logic
    // 6. Return via sendCorsResponse()
  } catch (error) {
    return sendCorsResponse(res, 500, { error: '...' });
  }
}
```

### React Query Data Fetching Pattern
Pages use React Query for all Supabase reads:
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['resource-name', user?.id],
  queryFn: async () => {
    const { data, error } = await supabase.from('table').select('*').eq('user_id', user!.id);
    if (error) throw error;
    return data;
  },
  enabled: !!user,
});
```

### Credit System Pattern
Credit deduction happens server-side in the API handler (not client-side):
1. API calls `supabase.rpc('deduct_credits', { _user_id, _amount })` before starting generation
2. If `deductResult.success === false`, returns HTTP 402 with error
3. Admin users (`has_role` returns true) skip credit deduction entirely
4. On async failure (video), `refund_credits` RPC is called to restore credits

### Supabase Edge Functions vs Vercel API (Migration Note)
`supabase/functions/` contains legacy Deno Edge Function equivalents of all handlers. These were the original Lovable/Supabase deployment. The active production code is in `api/` (Vercel Node.js). The `supabase/functions/` directory is retained as historical reference but is not deployed or called in production.
