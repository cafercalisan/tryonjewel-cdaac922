-- Add started_at column to processing_jobs for better timeout tracking
ALTER TABLE public.processing_jobs 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Update existing stuck jobs to failed status
UPDATE public.processing_jobs 
SET status = 'failed', 
    error_message = 'İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.',
    updated_at = now()
WHERE status = 'generating' 
  AND updated_at < now() - interval '10 minutes';