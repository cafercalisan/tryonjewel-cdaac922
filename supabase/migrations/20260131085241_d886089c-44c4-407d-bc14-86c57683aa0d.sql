-- ═══════════════════════════════════════════════════════════════
-- processing_jobs Table: Background job tracking for image generation
-- ═══════════════════════════════════════════════════════════════

-- Create the processing_jobs table
CREATE TABLE public.processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  current_step TEXT DEFAULT 'Bekliyor...',
  total_images INTEGER NOT NULL DEFAULT 1,
  completed_images INTEGER NOT NULL DEFAULT 0,
  image_record_id UUID,
  result_urls JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  refunded BOOLEAN DEFAULT false,
  credits_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure status is one of the valid values
  CONSTRAINT valid_status CHECK (status IN ('pending', 'analyzing', 'generating', 'completed', 'failed'))
);

-- Create index for efficient user queries
CREATE INDEX idx_processing_jobs_user_id ON public.processing_jobs(user_id);
CREATE INDEX idx_processing_jobs_status ON public.processing_jobs(status);
CREATE INDEX idx_processing_jobs_created_at ON public.processing_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own jobs
CREATE POLICY "Users can view their own jobs"
ON public.processing_jobs
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own jobs (for client-side creation if needed)
CREATE POLICY "Users can insert their own jobs"
ON public.processing_jobs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (handled via SECURITY DEFINER functions or service key)
-- No explicit policy needed as service_role bypasses RLS

-- Create trigger for updated_at
CREATE TRIGGER update_processing_jobs_updated_at
BEFORE UPDATE ON public.processing_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.processing_jobs;