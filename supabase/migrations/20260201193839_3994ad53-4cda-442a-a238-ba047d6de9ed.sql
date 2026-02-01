-- Add new fields to processing_jobs for partial success handling
ALTER TABLE public.processing_jobs 
ADD COLUMN IF NOT EXISTS partial_refund_amount integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_image_indices jsonb DEFAULT '[]'::jsonb;