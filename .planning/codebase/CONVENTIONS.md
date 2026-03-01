# TryOnJewel – Codebase Conventions

This document reflects conventions observed in the actual codebase. It is descriptive, not prescriptive.

---

## TypeScript Usage Patterns

### Strictness

TypeScript 5.8 is configured via `tsconfig.app.json`. The non-null assertion operator (`!`) is used freely in API files when environment variables are expected to be present:

```ts
// api/_lib/supabase.ts
const SUPABASE_URL = process.env.SUPABASE_URL!;
```

The `any` type appears occasionally in API response parsing:

```ts
// api/generate-model.ts
const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
```

### Interfaces vs. Types

Both are used. `interface` is preferred for object shapes with multiple named fields; `type` is used for union literals:

```ts
// src/pages/Generate.tsx
type PackageType = 'standard' | 'single' | 'retouch';
type GenerationStep = 'idle' | 'analyzing' | 'generating' | 'finalizing';

interface UploadedImage {
  file: File;
  preview: string;
  originalSize: number;
  compressedSize: number;
}
```

```ts
// src/components/generate/GeneratingPanel.tsx
interface GeneratingPanelProps {
  step: 'idle' | 'analyzing' | 'generating' | 'finalizing';
  packageType?: 'standard' | 'single' | 'retouch';
  previewImage?: string | null;
  currentStep?: string | null;
  progress?: number;
  completedImages?: number;
  totalImages?: number;
  selectedScenes?: string[];
}
```

API data models also use `interface`:

```ts
// api/generate-jewelry.ts
interface EditorialScene {
  name: string;
  category: 'outdoor' | 'campaign' | 'fashion' | 'architectural' | 'surface';
  prompt: string;
}

interface CharacterPersona {
  name: string;
  age: number;
  heritage: string;
  // ... many more fields
}
```

### Generics

Used through `@tanstack/react-query` and Supabase client. Query functions are typed via their return type:

```ts
// src/hooks/useProfile.tsx
return useQuery({
  queryKey: ['profile', user?.id],
  queryFn: async (): Promise<Profile | null> => { ... },
});
```

```ts
// src/pages/Generate.tsx
const { data: scenes } = useQuery({
  queryKey: ["scenes"],
  queryFn: async (): Promise<Scene[]> => { ... },
});
```

### Zod-inferred Types

Form types are derived from Zod schemas rather than written manually:

```ts
// src/lib/validation.ts
export type SignupFormData = z.infer<typeof signupSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;
```

### Record Types

`Record<string, T>` is used frequently for lookup tables in API files:

```ts
// api/generate-model.ts
const SSS_PROFILES: Record<string, string> = { ... };
const POSE_LIBRARY: Record<string, { name: string; camera: string; ... }> = { ... };
```

---

## React Patterns

### Component Style

All components are function components. Page-level components use `export default function`. Sub-components use named exports:

```ts
// Page (default export)
export default function Generate() { ... }

// Sub-component (named export)
export function AppLayout({ children, showFooter = true }: AppLayoutProps) { ... }
export function GeneratingPanel({ step, ... }: GeneratingPanelProps) { ... }
```

### Hooks Usage

Custom hooks live in `src/hooks/`. Each hook wraps a single concern:

- `useAuth` — context-based authentication state (`src/hooks/useAuth.tsx`)
- `useProfile` — TanStack Query wrapper over Supabase profiles table (`src/hooks/useProfile.tsx`)
- `useIsAdmin` — TanStack Query wrapper to check `user_roles` table (`src/hooks/useIsAdmin.ts`)
- `useVideoStatusPolling` — polling logic encapsulated via `useRef` + `useCallback` + `useEffect` (`src/hooks/useVideoStatusPolling.ts`)

### State Management

No global state library (no Redux, Zustand, or Jotai). State is managed via:

1. **React Context** — only for auth (`AuthContext` in `src/hooks/useAuth.tsx`)
2. **TanStack Query** — all server data fetching and caching (`useQuery`, `useMutation`)
3. **Local `useState`** — form state, UI flags, polling refs; all co-located in the page component

The `Generate` page is a representative example: it holds all generation-related state locally (14+ `useState` calls) rather than lifting state to a shared store.

### Ref Usage

`useRef` is used for mutable non-rendering values — specifically interval/timeout handles to avoid re-renders during polling:

```ts
// src/pages/Generate.tsx
const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// src/hooks/useVideoStatusPolling.ts
const pollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
const isPollingRef = useRef<Set<string>>(new Set());
```

### Context Pattern

The auth context follows the standard provider + typed hook pattern:

```ts
// src/hooks/useAuth.tsx
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

### Animation

Framer Motion (`framer-motion`) is the animation library. `AnimatePresence` + `motion.*` components are used for conditional section mounting/unmounting in forms:

```tsx
// src/pages/Generate.tsx
<AnimatePresence>
  {!isRetouchMode && (
    <motion.section
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      ...
    </motion.section>
  )}
</AnimatePresence>
```

`whileHover` and `whileTap` are used on interactive buttons:

```tsx
<motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
```

### Callback Memoization

`useCallback` is applied to event handlers that are passed to child components or used as `useEffect` dependencies:

```ts
// src/pages/Generate.tsx
const processFile = useCallback(async (file: File) => { ... }, [uploadedImages.length]);
const removeImage = useCallback((index: number) => { ... }, []);
const handleFileDrop = useCallback((e: React.DragEvent) => { ... }, [processFile, uploadedImages.length]);
```

`useMemo` is used for derived/filtered data:

```ts
const filteredScenes = useMemo(() => { ... }, [scenes, selectedProductType]);
const canGenerate = useMemo(() => { ... }, [uploadedImages.length, user, profile, ...]);
```

---

## Error Handling Patterns

### API Layer (Vercel Serverless Functions)

Every handler follows the same outer try/catch with the discriminated union auth result pattern:

```ts
// api/generate-model.ts — representative pattern
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Set CORS headers unconditionally
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

  // 2. Handle preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 3. Authenticate — early return on failure
    const authResult = await authenticateUser(req);
    if ('error' in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }

    // 4. Validate inputs — early return on failure
    if (!name || !skinTone || ...) {
      return sendCorsResponse(res, 400, { error: 'Missing required fields' });
    }

    // 5. Specific HTTP status for rate limiting
    if (response.status === 429) {
      return sendCorsResponse(res, 429, { error: 'Rate limit exceeded. Please try again later.' });
    }

    // 6. Supabase errors checked inline
    if (uploadError) throw new Error('Failed to upload image');

    // 7. Happy path response
    return sendCorsResponse(res, 200, { success: true, model: modelRecord });

  } catch (error) {
    // 8. Catch-all with instanceof guard
    console.error('Error:', error);
    return sendCorsResponse(res, 500, { error: error instanceof Error ? error.message : 'Unexpected error' });
  }
}
```

The `authenticateUser` helper returns a discriminated union (`{ userId }` or `{ error, status }`) checked with `'error' in authResult`.

### Frontend Error Handling

Errors surface to the user via `sonner` toasts. The `invokeApi` helper normalizes all API errors into `{ data, error }` shape:

```ts
// src/lib/api.ts
} catch (err) {
  return {
    data: null,
    error: {
      message: err instanceof Error ? err.message : 'Network error',
      status: 0,
    },
  };
}
```

Callers check `if (error) throw error` and catch in the page-level try/catch:

```ts
// src/pages/Generate.tsx
} catch (error) {
  console.error("Generation error:", error);
  toast.error(error instanceof Error ? error.message : "Görsel oluşturulurken bir hata oluştu.");
  setIsGenerating(false);
}
```

Transient errors (502, 503, 429) trigger an exponential-backoff retry loop in `invokeWithRetry`:

```ts
const baseMs = 800 * Math.pow(2, attempt);
const jitter = Math.floor(Math.random() * 300);
await new Promise(r => setTimeout(r, baseMs + jitter));
```

TanStack Query mutations use `onSuccess` callbacks; errors propagate naturally.

---

## Import Organization

Imports are not enforced by a linter rule but follow a consistent manual ordering observed across files:

1. React and React ecosystem (`react`, `react-router-dom`, `framer-motion`)
2. Internal path aliases (`@/components/...`, `@/hooks/...`, `@/lib/...`, `@/integrations/...`)
3. Third-party icon/utility imports (`lucide-react`, `sonner`, `@tanstack/react-query`)
4. Static asset imports (`@/assets/...`)

The `@/` path alias maps to `src/` and is configured in `tsconfig.app.json` and `vite.config.ts`.

API files (`api/`) import from relative `'./_lib/...'` with `.js` extensions (required for Node ESM interop with Vercel):

```ts
import { getServiceClient } from './_lib/supabase.js';
import { authenticateUser } from './_lib/auth.js';
import { corsHeaders, sendCorsResponse } from './_lib/cors.js';
```

---

## Naming Conventions

### Files

| Context | Convention | Example |
|---|---|---|
| React components | PascalCase `.tsx` | `GeneratingPanel.tsx`, `AppLayout.tsx` |
| Custom hooks | camelCase `use*.tsx` or `use*.ts` | `useAuth.tsx`, `useIsAdmin.ts` |
| Utility libraries | camelCase `.ts` | `compressImage.ts`, `validation.ts`, `api.ts` |
| API handlers | kebab-case `.ts` | `generate-jewelry.ts`, `check-video-status.ts` |
| Private API utilities | underscore prefix dir | `api/_lib/` |

### Functions and Variables

- **React components**: PascalCase (`AppLayout`, `GeneratingPanel`)
- **Hook functions**: `use` prefix + PascalCase (`useAuth`, `useProfile`, `useIsAdmin`)
- **Event handlers**: `handle` prefix (`handleGenerate`, `handleFileDrop`, `handleFileSelect`)
- **Boolean state variables**: `is`/`has`/`can` prefix (`isGenerating`, `hasStyleReference`, `canGenerate`)
- **API constants**: SCREAMING_SNAKE_CASE (`GOOGLE_API_KEY`, `MAX_IMAGE_SIZE`, `EDITORIAL_SCENE_POOL`)
- **Config objects**: SCREAMING_SNAKE_CASE for module-level lookup tables (`SSS_PROFILES`, `POSE_LIBRARY`, `CHARACTER_PERSONAS`)
- **Builder functions**: `build` prefix (`buildAdvancedPrompt`, `buildCharacterMasterData`)

### Database Columns vs. JavaScript

Supabase table columns use `snake_case` (`skin_tone`, `hair_color`, `user_id`). These are mapped to camelCase in TypeScript interfaces on the frontend (`skinTone`, `hairColor`). The mapping is manual — no ORM or auto-mapper is used.

### Routes

Turkish-language URL slugs are used for authenticated routes:
- `/olustur` (Generate)
- `/sonuclar` (Results)
- `/panel` (Dashboard)
- `/gorsellerim` (Gallery)
- `/modellerim` (Model Gallery)
- `/hesap` (Account)

---

## Tailwind / CSS Patterns

### Design Tokens

All colors, shadows, and border radius values are defined as CSS custom properties in `src/index.css` and consumed by the Tailwind config via `hsl(var(--token))`:

```css
/* src/index.css */
--gold: 38 45% 55%;
--gold-light: 38 30% 92%;
--gold-dark: 38 45% 35%;
--shadow-sm: 3px 3px 0px 0px #000000;
```

```ts
// tailwind.config.ts
gold: {
  DEFAULT: 'hsl(var(--gold))',
  light: 'hsl(var(--gold-light))',
  dark: 'hsl(var(--gold-dark))',
},
```

### Custom Utility Classes

Several semantic utility classes are defined in `src/index.css` using `@layer utilities`. They are referenced in JSX without configuration:

```
gradient-gold          — gold gradient background
gradient-gold-subtle   — lighter gold gradient
border-gold            — custom gold border color
shadow-luxury          — luxury drop shadow
animate-glow-gold      — gold glow animation
```

### `cn()` Helper

The `cn` function from `src/lib/utils.ts` (wrapping `clsx` + `tailwind-merge`) is the universal way to compose conditional class strings:

```ts
// src/lib/utils.ts
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Usage pattern throughout components:

```tsx
className={cn(
  "base-classes",
  isSelected && "conditional-classes",
  isDisabled && "disabled-classes"
)}
```

Inline ternary strings are also common for simple binary cases:

```tsx
className={`relative p-3 rounded-xl border-2 transition-all ${
  isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30 bg-card'
}`}
```

### Layout Patterns

- `container` class with `max-w-5xl mx-auto` for page content
- `grid lg:grid-cols-[1fr,340px] gap-6` for the main generate form layout (content + sticky summary sidebar)
- `lg:sticky lg:top-24 h-fit` for the sticky summary panel
- `space-y-6` for vertical section stacking
- `min-h-screen flex flex-col` on the root layout

### Dark Mode

Dark mode is configured (`darkMode: ["class"]`) but appears minimally implemented. CSS variables are not duplicated for a `.dark` class in `src/index.css`.

### Responsive Approach

Mobile-first. Breakpoints used: `sm:`, `md:`, `lg:`. Common patterns:
- `grid-cols-3 sm:grid-cols-6` for product type selectors
- `grid-cols-3 sm:grid-cols-5` for metal color selectors
- `text-2xl md:text-3xl` for headings
- `py-6 md:py-10` for vertical spacing

---

## Common Utilities

### `src/lib/api.ts` — `invokeApi`

The single point of contact for all frontend-to-API communication. Wraps `fetch`, attaches the Supabase JWT, and normalizes `{ data, error }` response shape. Used everywhere instead of Supabase Edge Functions:

```ts
const { data, error } = await invokeApi("generate-jewelry", { body });
```

### `src/lib/utils.ts` — `cn`

Class name composition. Used in nearly every component file.

### `src/lib/compressImage.ts` — `compressImage` / `formatFileSize`

Client-side image compression via Canvas API. Called before upload to stay under the 1.5 MB Gemini API limit. Uses recursive quality reduction from 0.9 downward.

### `src/lib/validation.ts` — Zod Schemas

Three schemas: `signupSchema`, `loginSchema`, `profileUpdateSchema`. Used with `react-hook-form` + `@hookform/resolvers/zod`.

### `src/lib/jewelryFacts.ts` — `getRandomFacts`

Returns random jewelry facts for display in the `GeneratingPanel` loading state.

### `src/lib/getSignedImageUrl.ts` / `src/lib/downloadImage.ts`

Helper utilities for Supabase Storage signed URL retrieval and browser-side image download.

### `api/_lib/`

Three shared utilities for all Vercel serverless functions:

- `cors.ts` — `corsHeaders` object and `sendCorsResponse(res, status, body)` helper
- `auth.ts` — `authenticateUser(req)` returning discriminated union
- `supabase.ts` — `getServiceClient()` and `getAuthClient(authHeader)` factory functions

### Third-Party Utilities

| Package | Usage |
|---|---|
| `@tanstack/react-query` | All server-state fetching and mutation |
| `framer-motion` | Animations and transitions |
| `sonner` | Toast notifications (`toast.success`, `toast.error`, `toast.info`) |
| `zod` | Form schema validation |
| `react-hook-form` | Form state management |
| `lucide-react` | All icons |
| `@supabase/supabase-js` | Database, auth, storage client |
| `date-fns` | Date formatting (used in gallery/results) |
| `clsx` + `tailwind-merge` | Class name composition via `cn()` |
