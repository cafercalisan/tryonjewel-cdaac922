-- Brand Profiles table for Marka DNA system
CREATE TABLE IF NOT EXISTS brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  brand_name TEXT,
  logo_url TEXT,
  -- Color System
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  color_palette JSONB DEFAULT '[]'::jsonb,
  -- Style Preferences
  style_keywords TEXT[] DEFAULT '{}',
  lighting_preference TEXT,
  mood_description TEXT,
  background_preference TEXT,
  -- Reference Images
  reference_image_urls TEXT[] DEFAULT '{}',
  -- AI Analysis Output
  analysis_data JSONB,
  brand_dna_prompt TEXT,
  -- Meta
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own brand profile"
  ON brand_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own brand profile"
  ON brand_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own brand profile"
  ON brand_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can read all (for generation API)
CREATE POLICY "Service role can read all brand profiles"
  ON brand_profiles FOR SELECT
  TO service_role
  USING (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_brand_profiles_user_id ON brand_profiles(user_id);
