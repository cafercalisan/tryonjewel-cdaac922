

## Problem Analysis

Three interrelated issues are causing the WORKER_LIMIT (546) and Memory Limit errors:

1. **Synchronous execution blocks workers**: The edge function `await`s the entire generation process (60-120 seconds), occupying a worker the whole time. Supabase Edge Functions have strict compute limits -- this approach exhausts available workers.

2. **Dead code inflates memory**: ~300 lines of Master package logic remain in the edge function despite being removed from the UI. This unnecessary code increases the function's memory footprint.

3. **Single image output**: Since the Master package was removed, Standard and Retouch packages only generate 1 image. The previous 3-image output came from Master.

## Solution: Lightweight Dispatch + Background Processing + Polling

Switch to a **fire-and-forget** pattern: the edge function creates a job record, kicks off background processing with `EdgeRuntime.waitUntil()`, and returns immediately. The frontend polls the database for completion.

```text
Frontend                        Edge Function                    Background
   |                                  |                              |
   |-- POST generate-jewelry -------->|                              |
   |                                  |-- Create job (pending)       |
   |                                  |-- waitUntil(process...)  --->|
   |<-- 200 { jobId, imageId } -------|  (~200ms)                    |
   |                                  |                              |-- Analyze
   |-- Poll DB every 3s ------------->|                              |-- Generate
   |-- Poll DB every 3s ------------->|                              |-- Upload
   |-- Poll DB (status=completed) --->|                              |-- Update DB
   |                                  |                              |
   |-- Navigate to /sonuclar -------->|                              |
```

### Changes

**1. Edge Function (`supabase/functions/generate-jewelry/index.ts`)**

- Replace synchronous `await processGenerationInBackground(...)` with `EdgeRuntime.waitUntil(processGenerationInBackground(...))`
- Return immediately with `{ jobId, imageId }` after job creation (~200ms response)
- Remove all Master package dead code (~300 lines: master prompts, step logic, color maps, catalog backgrounds, model shot prompts for master)
- Remove `isMasterPackage` references throughout
- Keep single-flight control and auto-cleanup logic

**2. Frontend (`src/pages/Generate.tsx`)**

- After receiving `{ jobId, imageId }` from the edge function, start polling the `processing_jobs` table every 3 seconds
- Poll query: `select status, result_urls, error_message from processing_jobs where id = jobId`
- On `status = 'completed'`: navigate to results page
- On `status = 'failed'`: show error toast, stop polling
- Add a 3-minute timeout safety net (stop polling, show error)
- Keep the existing `invokeWithRetry` wrapper for the initial HTTP call

**3. Generating Panel (`src/components/generate/GeneratingPanel.tsx`)**

- Update to show progress based on polling status
- Display current step information from the job record
- Add timeout indicator if generation takes longer than expected

### Why This Fixes the Issues

- **WORKER_LIMIT**: Edge function returns in ~200ms instead of 60-120s. Worker is freed immediately.
- **Memory**: Background processing runs independently; removing 300 lines of dead Master code reduces baseline memory.
- **Reliability**: Even if background process crashes, the job stays in `generating` status and auto-cleanup marks it as failed after 5 minutes. Credits are refunded.

### Files to Change

1. `supabase/functions/generate-jewelry/index.ts` -- waitUntil + remove Master dead code
2. `src/pages/Generate.tsx` -- add polling logic
3. `src/components/generate/GeneratingPanel.tsx` -- polling-aware progress display

