-- Add product_type_category to scenes table for categorizing by jewelry type
ALTER TABLE public.scenes 
ADD COLUMN IF NOT EXISTS product_type_category text NOT NULL DEFAULT 'genel';

-- Add sub_category for model/product sub-categorization 
ALTER TABLE public.scenes 
ADD COLUMN IF NOT EXISTS sub_category text NOT NULL DEFAULT 'standart';

-- Add is_premium column for master package scenes
ALTER TABLE public.scenes 
ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;

-- Update existing scenes with appropriate product_type_category based on their current category and name
-- Manken scenes get appropriate product types
UPDATE public.scenes 
SET product_type_category = 'kolye', sub_category = 'manken'
WHERE category = 'manken' AND (name_tr ILIKE '%boyun%' OR name_tr ILIKE '%dekolte%');

UPDATE public.scenes 
SET product_type_category = 'yuzuk', sub_category = 'manken'
WHERE category = 'manken' AND name_tr ILIKE '%el%';

UPDATE public.scenes 
SET product_type_category = 'kupe', sub_category = 'manken'
WHERE category = 'manken' AND name_tr ILIKE '%kulak%';

UPDATE public.scenes 
SET product_type_category = 'bileklik', sub_category = 'manken'
WHERE category = 'manken' AND name_tr ILIKE '%bilek%';

UPDATE public.scenes 
SET product_type_category = 'genel', sub_category = 'manken'
WHERE category = 'manken' AND (name_tr ILIKE '%portre%' AND name_tr NOT ILIKE '%boyun%' AND name_tr NOT ILIKE '%kulak%');

-- Urun scenes keep 'urun' as sub_category
UPDATE public.scenes 
SET sub_category = 'urun'
WHERE category = 'urun';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_scenes_product_type_category ON public.scenes(product_type_category);
CREATE INDEX IF NOT EXISTS idx_scenes_sub_category ON public.scenes(sub_category);