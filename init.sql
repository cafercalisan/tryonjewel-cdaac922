-- TryOnJewel - Consolidated Database Schema
-- PostgreSQL 16 (bare metal)
-- Replaces Supabase auth + 28 migration files

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ══════════════════════════════════════════════
-- USERS (replaces Supabase auth.users)
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ══════════════════════════════════════════════
-- ENUMS
-- ══════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ══════════════════════════════════════════════
-- PROFILES
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  company TEXT,
  credits INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_email ON profiles(email);

-- ══════════════════════════════════════════════
-- USER ROLES
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

-- ══════════════════════════════════════════════
-- SCENES
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_tr TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  description_tr TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'studio',
  sub_category TEXT NOT NULL DEFAULT 'general',
  product_type_category TEXT NOT NULL DEFAULT 'genel',
  preview_image_url TEXT,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scenes_category ON scenes(category);

-- ══════════════════════════════════════════════
-- IMAGES
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
  original_image_url TEXT NOT NULL,
  generated_image_urls TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  name TEXT,
  aspect_ratio TEXT NOT NULL DEFAULT '3:4',
  analysis_data JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_images_user_id ON images(user_id);
CREATE INDEX idx_images_status ON images(status);
CREATE INDEX idx_images_created_at ON images(created_at DESC);

-- ══════════════════════════════════════════════
-- PROCESSING JOBS
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS processing_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_record_id UUID REFERENCES images(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_images INTEGER NOT NULL DEFAULT 6,
  completed_images INTEGER NOT NULL DEFAULT 0,
  progress INTEGER NOT NULL DEFAULT 0,
  current_step TEXT DEFAULT 'pending',
  error_message TEXT,
  result_urls JSONB,
  failed_image_indices JSONB,
  credits_used INTEGER DEFAULT 0,
  refunded BOOLEAN DEFAULT false,
  partial_refund_amount INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_processing_jobs_user_id ON processing_jobs(user_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_updated_at ON processing_jobs(updated_at);

-- ══════════════════════════════════════════════
-- VIDEOS
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_image_url TEXT NOT NULL,
  video_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  operation_id TEXT,
  prompt TEXT,
  duration INTEGER,
  aspect_ratio TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_videos_user_id ON videos(user_id);
CREATE INDEX idx_videos_status ON videos(status);

-- ══════════════════════════════════════════════
-- USER MODELS
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'female',
  age_range TEXT NOT NULL DEFAULT '25-30',
  ethnicity TEXT NOT NULL DEFAULT 'Turkish',
  skin_tone TEXT NOT NULL DEFAULT 'medium',
  skin_undertone TEXT NOT NULL DEFAULT 'warm',
  hair_color TEXT NOT NULL DEFAULT 'brown',
  hair_texture TEXT NOT NULL DEFAULT 'wavy',
  hair_style TEXT,
  eye_color TEXT,
  face_shape TEXT,
  expression TEXT,
  preview_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_models_user_id ON user_models(user_id);

-- ══════════════════════════════════════════════
-- BRAND PROFILES
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS brand_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_name TEXT,
  brand_style TEXT,
  brand_colors TEXT,
  brand_mood TEXT,
  logo_url TEXT,
  brand_dna_prompt TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_brand_profiles_user_id ON brand_profiles(user_id);

-- ══════════════════════════════════════════════
-- RPC FUNCTIONS
-- ══════════════════════════════════════════════

-- Deduct credits
CREATE OR REPLACE FUNCTION deduct_credits(_user_id UUID, _amount INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  current_credits INTEGER;
  remaining INTEGER;
BEGIN
  SELECT credits INTO current_credits FROM profiles WHERE id = _user_id FOR UPDATE;

  IF current_credits IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found', 'current_credits', 0);
  END IF;

  IF current_credits < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits', 'current_credits', current_credits);
  END IF;

  remaining := current_credits - _amount;
  UPDATE profiles SET credits = remaining, updated_at = NOW() WHERE id = _user_id;

  RETURN jsonb_build_object('success', true, 'remaining_credits', remaining, 'current_credits', current_credits);
END;
$$;

-- Refund credits
CREATE OR REPLACE FUNCTION refund_credits(_user_id UUID, _amount INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  current_credits INTEGER;
  new_credits INTEGER;
BEGIN
  SELECT credits INTO current_credits FROM profiles WHERE id = _user_id FOR UPDATE;

  IF current_credits IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  new_credits := current_credits + _amount;
  UPDATE profiles SET credits = new_credits, updated_at = NOW() WHERE id = _user_id;

  RETURN jsonb_build_object('success', true, 'new_credits', new_credits);
END;
$$;

-- Admin set credits
CREATE OR REPLACE FUNCTION admin_set_credits(_user_id UUID, _credits INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  old_credits INTEGER;
BEGIN
  SELECT credits INTO old_credits FROM profiles WHERE id = _user_id FOR UPDATE;

  IF old_credits IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  UPDATE profiles SET credits = _credits, updated_at = NOW() WHERE id = _user_id;

  RETURN jsonb_build_object('success', true, 'old_credits', old_credits, 'new_credits', _credits);
END;
$$;

-- Has role check
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role);
END;
$$;

-- ══════════════════════════════════════════════
-- AUTO-UPDATE updated_at TRIGGER
-- ══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_processing_jobs_updated_at BEFORE UPDATE ON processing_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_videos_updated_at BEFORE UPDATE ON videos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_user_models_updated_at BEFORE UPDATE ON user_models FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_brand_profiles_updated_at BEFORE UPDATE ON brand_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
