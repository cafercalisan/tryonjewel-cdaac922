
## Deep Analysis - 4 Critical Problems Found

### Problem 1: Stuck Job Blocking Everything
Job `e40cc12c` crashed with "Memory limit exceeded" but remains in `generating` status at progress 20. The 5-minute auto-cleanup hasn't triggered because `updated_at` is recent. This blocks ALL new generation attempts with the "ACTIVE_JOB_EXISTS" (409) error.

### Problem 2: Memory Limit Crashes During Generation
The edge function requests **4K images** from Gemini (`imageSize: '4K'`). A 4K image (3072x4096 pixels) as base64 is ~15-30MB. Combined with the analysis data, input image, and response parsing, this easily exceeds the **150MB memory limit** of Supabase Edge Functions. This is why every standard generation crashes at progress 20 (right after analysis, when generation begins).

### Problem 3: Images Table Out of Sync
When jobs fail (auto-cleaned or memory crash), the `processing_jobs` table gets updated to `failed`, but the `images` table stays stuck in `generating` status forever. There are 7+ orphaned image records stuck in `generating/analyzing` status.

### Problem 4: Only 1 Image Generated
The current standard flow generates only 1 image. Previously there were 3 images per generation. The user explicitly wants 3 images back.

---

## Solution Plan

### Step 1: Clean Stuck Data (SQL Migration)
- Mark stuck job `e40cc12c` as failed
- Fix all orphaned `images` records that have corresponding failed jobs -- update their status to `failed` too
- This immediately unblocks the user

### Step 2: Fix Memory Crashes - Reduce Image Size
In `callGeminiImageGeneration()`:
- Change `imageSize: '4K'` to `imageSize: '2K'`
- This reduces the base64 response from ~20MB to ~5MB, well within 150MB limits
- The images will still be high quality (2048x2730 pixels) -- more than enough for web display and downloads
- The download function already upscales client-side via canvas for 4K output

### Step 3: Restore 3-Image Generation
In the `processGenerationInBackground` function, for standard (scene-based) generation:
- Generate 3 images sequentially (not parallel, to avoid memory spikes)
- After each generation + upload, explicitly null the image buffer
- Update progress incrementally: 30% after image 1, 60% after image 2, 90% after image 3
- Use slightly varied prompts for each (different lighting angle descriptions) to create meaningful variations

For retouch and style-reference modes: keep at 1 image (these are single-output by nature).

### Step 4: Fix Auto-Cleanup to Sync Images Table
In the main handler's auto-cleanup section (line 968-973):
- After marking stuck jobs as failed, also query those jobs for their `image_record_id`
- Update the corresponding `images` records to `failed` status with error message
- This prevents orphaned records

### Step 5: Update Frontend for 3 Images
- Change `totalImages` from 1 to 3 in `Generate.tsx`
- Update `total_images` in the job creation from 1 to 3
- The Results page already handles multiple images with thumbnails grid -- no changes needed there

---

## Technical Details

### Files to Change

**1. SQL Migration** - Clean stuck data + sync images table

```sql
-- Clean stuck job
UPDATE processing_jobs SET status = 'failed', error_message = 'Memory cleanup' 
WHERE id = 'e40cc12c-655c-4884-a14c-48776c674daa' AND status = 'generating';

-- Sync orphaned images with failed jobs
UPDATE images SET status = 'failed', error_message = 'Generation failed'
WHERE status IN ('generating', 'analyzing') 
AND id IN (SELECT image_record_id FROM processing_jobs WHERE status = 'failed');
```

**2. `supabase/functions/generate-jewelry/index.ts`**
- Line 59: Change `imageSize: '4K'` to `imageSize: '2K'`
- Lines 783-820: Replace single standard generation with a loop that generates 3 images sequentially with memory cleanup
- Lines 968-973: After auto-cleanup of stuck jobs, also update corresponding images table records
- Line 1047: Change `total_images: 1` to `total_images: 3`

**3. `src/pages/Generate.tsx`**
- Line 260: Change `totalImages = 1` to `totalImages = 3`

### Memory Budget After Fix
- Input image base64: ~1.5MB
- Analysis response: ~0.1MB
- Generation response (2K): ~5MB per image
- Only 1 image in memory at a time (sequential + null after upload)
- Total peak: ~10MB -- well within 150MB limit
