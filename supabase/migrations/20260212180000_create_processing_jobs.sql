-- Create processing_jobs table for tracking generation progress
CREATE TABLE IF NOT EXISTS public.processing_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  image_record_id uuid REFERENCES public.images(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  total_images integer NOT NULL DEFAULT 3,
  completed_images integer NOT NULL DEFAULT 0,
  progress integer NOT NULL DEFAULT 0,
  current_step text DEFAULT 'pending',
  credits_used integer NOT NULL DEFAULT 0,
  error_message text,
  result_urls text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;

-- Users can read their own jobs
CREATE POLICY "Users can read own processing jobs"
  ON public.processing_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (for serverless functions)
CREATE POLICY "Service role full access on processing_jobs"
  ON public.processing_jobs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_processing_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_processing_jobs_updated_at
  BEFORE UPDATE ON public.processing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_processing_jobs_updated_at();

-- Index for active job queries
CREATE INDEX idx_processing_jobs_user_status ON public.processing_jobs(user_id, status);
CREATE INDEX idx_processing_jobs_updated_at ON public.processing_jobs(updated_at);
