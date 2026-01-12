ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS operation_id TEXT;

CREATE INDEX IF NOT EXISTS idx_videos_operation_id ON public.videos(operation_id);