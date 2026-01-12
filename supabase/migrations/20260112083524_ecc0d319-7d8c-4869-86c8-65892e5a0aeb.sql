-- Add new columns for enhanced model customization
ALTER TABLE public.user_models 
ADD COLUMN IF NOT EXISTS face_shape text,
ADD COLUMN IF NOT EXISTS eye_color text,
ADD COLUMN IF NOT EXISTS expression text,
ADD COLUMN IF NOT EXISTS hair_style text;

-- Add comments for documentation
COMMENT ON COLUMN public.user_models.face_shape IS 'Yüz tipi: oval, heart, square, round, diamond, angular';
COMMENT ON COLUMN public.user_models.eye_color IS 'Göz rengi: brown, dark-brown, hazel, green, blue, gray';
COMMENT ON COLUMN public.user_models.expression IS 'Yüz ifadesi: serene, confident, mysterious, warm, intense';
COMMENT ON COLUMN public.user_models.hair_style IS 'Saç stili: slicked-back, loose, updo, side-part, natural';