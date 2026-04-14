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
  style_analysis_data JSONB,
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
  total_images INTEGER NOT NULL DEFAULT 1,
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

-- ══════════════════════════════════════════════
-- SCENE PROMPTS SEED DATA (38 scenes)
-- ══════════════════════════════════════════════

-- ── EDITORIAL (14) — Sadece ürün, sade/şık yüzey sergileme ──

INSERT INTO scenes (name, name_tr, description, description_tr, prompt, category, sub_category, product_type_category, sort_order)
VALUES
('Black Velvet Classic', 'Siyah Kadife Klasik', 'Rich black velvet fabric surface', 'Zengin siyah kadife kumaş yüzeyi',
 'Jewelry placed on rich black velvet fabric with deep texture folds creating luxurious depth. Soft overhead lighting reveals velvet fiber texture. Dark moody atmosphere with subtle warm highlights on the jewelry. No hands, no model, no human elements. Pure product showcase on elegant velvet surface. Cartier catalog aesthetic.',
 'editorial', 'surface', 'genel', 1),

('Reflective Black Glass', 'Parlak Siyah Cam', 'Polished black glass mirror surface', 'Cilalı siyah cam ayna yüzeyi',
 'Jewelry displayed on polished black glass surface creating perfect mirror-like reflections. Dramatic rim lighting from behind. Ultra-modern sleek high-tech luxury presentation. No hands, no model. Clean minimal product-only composition. The reflection doubles the visual impact.',
 'editorial', 'surface', 'genel', 2),

('Silk Cascade', 'İpek Kumaş', 'Cream silk fabric draping', 'Krem ipek kumaş drapesi',
 'Jewelry resting on cascading folds of cream silk fabric draping in soft organic waves. Soft diffused overhead light creates delicate shadow-light interplay along silk curves. Warm champagne and ivory tonal palette. No hands, no model. Intimate haute couture still life. Shallow depth of field keeps jewelry razor-sharp while silk edges dissolve into creamy bokeh.',
 'editorial', 'texture', 'genel', 3),

('Raw Marble Quarry', 'Ham Mermer', 'Natural Calacatta marble block', 'Doğal Calacatta mermer blok',
 'Jewelry placed on a raw Calacatta marble block with natural gold veins running through white stone. Polished on placement area, unpolished on edges. Hard natural daylight from above creates stark shadows. No hands, no model. Industrial luxury — raw meets refined. Gold veins complement the jewelry metal. Museum-quality mineral specimen presentation.',
 'editorial', 'texture', 'genel', 4),

('Liquid Gold Pour', 'Erimiş Altın', 'Surreal molten gold surface', 'Sürreal erimiş altın yüzeyi',
 'Surreal campaign image: jewelry appears to float on a surface of liquid molten gold. Metallic liquid creates rippling reflections and warm golden light from below. Ultra-luxury avant-garde advertising aesthetic. Background transitions from liquid gold to deep black. No hands, no model. Dramatic rim lighting separates jewelry from molten surface. Hyper-real yet dreamlike.',
 'editorial', 'creative', 'genel', 5),

('Midnight Orchid', 'Gece Orkidesi', 'Dark orchid petals arrangement', 'Koyu orkide yaprakları düzeni',
 'Jewelry nestled among dark almost-black orchid petals. Deep purple-to-black gradients in botanical elements. Macro-level detail on orchid textures. Single soft light source from above-left creates intimate mysterious illumination. No hands, no model. Dark botanical luxury — nature meets haute joaillerie. Moody romantic gothic elegance.',
 'editorial', 'creative', 'genel', 6),

('Tiffany Blue Studio', 'Tiffany Mavisi Stüdyo', 'Iconic soft blue backdrop studio', 'İkonik soft mavi fon stüdyo',
 'Pristine white lacquered surface with iconic soft blue gradient backdrop. Perfect three-point studio lighting. Immaculate minimal aspirational. No hands, no model. Luxury brand campaign precision with zero distractions. Jewelry as the sole star of the frame. Clean infinity curve background.',
 'editorial', 'campaign', 'genel', 7),

('Cartier Window Display', 'Cartier Vitrin', 'High-end boutique window at night', 'Lüks butik vitrin gece',
 'High-end jewelry boutique window display at night. Deep navy blue velvet platform with museum-grade spot lighting. Warm gold accent lights. Dark exterior reflections in glass. No hands, no model. Exclusive prestigious campaign atmosphere. Jewelry presented as a precious artifact in its display case.',
 'editorial', 'campaign', 'genel', 8),

('Modern Minimalist', 'Modern Minimalist', 'Pure white studio cyclorama', 'Saf beyaz stüdyo cyclorama',
 'Pure white studio cyclorama with three-point professional lighting. Clean infinity curve background. No shadows, no distractions. No hands, no model. Surgical precision lighting reveals every facet. Contemporary luxury brand campaign. Jewelry floating in pristine white space.',
 'editorial', 'campaign', 'genel', 9),

('Noir Glamour', 'Noir Glamur', 'Single dramatic spotlight on black lacquer', 'Siyah lake üzerinde dramatik spot',
 'Single dramatic spotlight on glossy black lacquered surface. Deep chiaroscuro lighting — jewelry emerges from darkness. Strong contrast film-noir mood. No hands, no model. Bold seductive luxury campaign. The spotlight creates a pool of light where only the jewelry exists.',
 'editorial', 'campaign', 'genel', 10),

('Frozen Crystal', 'Buzlu Kristal', 'Ice crystal surface with arctic palette', 'Buz kristal yüzey arktik palet',
 'Jewelry resting upon crystal-clear ice formations. Arctic blue-white color palette with prismatic light refractions creating rainbow spectra. Frost crystals frame the edges. No hands, no model. Cold studio lighting with sharp highlights. Ultra-clean pure winter luxury campaign.',
 'editorial', 'creative', 'genel', 11),

('Japanese Zen Stone', 'Japon Zen Taşı', 'Smooth river stone in zen garden', 'Zen bahçesinde düz nehir taşı',
 'Jewelry placed on a smooth river stone within a miniature Japanese zen garden. Raked white sand with precise parallel lines surrounds the stone. Minimalist composition with asymmetric balance. No hands, no model. Soft even natural light. Meditative calm wabi-sabi aesthetic. The simplicity amplifies the jewelry complexity.',
 'editorial', 'architectural', 'genel', 12),

('Crushed Velvet Midnight', 'Kadife Gece Mavisi', 'Deep navy-purple crushed velvet', 'Koyu lacivert-mor kadife',
 'Deep midnight navy-purple crushed velvet fabric beneath the jewelry. Crushed texture creates rich directional light patterns. Single focused spotlight illuminates only the jewelry while velvet falls into dramatic bokeh. No hands, no model. Rich sumptuous deeply saturated. Intimate boudoir campaign aesthetic.',
 'editorial', 'texture', 'genel', 13),

('Floating Glass Platform', 'Cam Platform', 'Clear glass platform above cloudscape', 'Bulutların üstünde cam platform',
 'Jewelry on a perfectly clear glass platform that appears to float in mid-air. Below the glass a dramatic cloudscape is visible creating a surreal floating-above-clouds illusion. No hands, no model. Ultra-modern architectural concept. Clean precise lighting eliminates shadows on glass. Jewelry appears suspended in space between earth and sky.',
 'editorial', 'architectural', 'genel', 14)
ON CONFLICT DO NOTHING;

-- ── ECOMMERCE (5) — Saf ürün fotoğrafı, satış amaçlı ──

INSERT INTO scenes (name, name_tr, description, description_tr, prompt, category, sub_category, product_type_category, sort_order)
VALUES
('Pure White Background', 'Saf Beyaz Fon', 'Clean white ecommerce background', 'Temiz beyaz e-ticaret fonu',
 'Professional e-commerce product photography. Pure white (#FFFFFF) seamless background. Omnidirectional studio lighting eliminating all shadows. No hands, no model, no props. Jewelry centered in frame with perfect exposure. Clean precise commercial product shot for online store. Every detail visible.',
 'ecommerce', 'white', 'genel', 20),

('Light Grey Gradient', 'Açık Gri Gradient', 'Subtle grey gradient background', 'Hafif gri gradient fon',
 'Professional e-commerce product photography. Subtle light grey gradient background transitioning from white center to soft grey edges. Soft studio lighting with gentle shadow beneath for dimension. No hands, no model, no props. Clean modern product presentation for luxury e-commerce.',
 'ecommerce', 'grey', 'genel', 21),

('Warm Cream Background', 'Krem Fon', 'Warm cream/beige backdrop', 'Sıcak krem/bej fon',
 'Professional e-commerce product photography. Warm cream-beige background creating inviting atmosphere. Soft diffused lighting with gentle warmth. No hands, no model, no props. Jewelry presented with subtle warm undertone suggesting luxury and comfort. Perfect for boutique online stores.',
 'ecommerce', 'cream', 'genel', 22),

('Soft Pastel Background', 'Pastel Ton Fon', 'Muted pastel color backdrop', 'Yumuşak pastel renkli fon',
 'Professional e-commerce product photography. Soft muted pastel background — subtle blush pink or dusty rose. Delicate studio lighting with even exposure. No hands, no model, no props. Feminine elegant product presentation. Clean lines and perfect product isolation.',
 'ecommerce', 'pastel', 'genel', 23),

('Shadow Play White', 'Gölge Oyunu', 'White background with artistic shadow', 'Beyaz fon sanatsal gölge',
 'Professional e-commerce product photography. White background with intentional artistic shadow cast by the jewelry creating elegant depth. Single directional light source from upper-left. No hands, no model, no props. Modern minimalist product shot with character through shadow.',
 'ecommerce', 'shadow', 'genel', 24)
ON CONFLICT DO NOTHING;

-- ── MODEL (7) — Manken üzerinde çekim ──

INSERT INTO scenes (name, name_tr, description, description_tr, prompt, category, sub_category, product_type_category, sort_order)
VALUES
('Editorial Full Body', 'Editorial Tam Boy', 'Full body fashion editorial with model', 'Tam boy moda editorial manken çekimi',
 'High-fashion editorial photography with model wearing the jewelry. Full body composition with dramatic pose. Professional studio lighting with beauty dish and rim light. Clean backdrop. Model styled in elegant minimalist outfit that complements but never overshadows the jewelry. Magazine cover quality.',
 'model', 'editorial', 'genel', 30),

('Portrait Elegance', 'Portre Zarafet', 'Close portrait highlighting jewelry', 'Mücevheri öne çıkaran yakın portre',
 'Elegant portrait photography. Model shot from shoulders up with jewelry as the focal point. Soft beauty lighting with catchlights in eyes. Shallow depth of field with model sharp and background dissolved. Natural makeup enhancing but not competing with jewelry. Editorial portrait style.',
 'model', 'portrait', 'genel', 31),

('Power Pose Editorial', 'Güçlü Duruş', 'Confident power pose with jewelry', 'Özgüvenli güçlü duruş mücevherle',
 'Powerful editorial photography. Model in confident commanding pose wearing the jewelry. Strong geometric composition. Dramatic directional lighting creating bold shadows. Dark sophisticated backdrop. The jewelry adds authority and luxury to an already powerful image. Tom Ford campaign energy.',
 'model', 'power', 'genel', 32),

('Hand Ring Detail', 'Yüzük El Detay', 'Elegant hand pose showcasing ring', 'Yüzüğü sergileyen zarif el pozu',
 'Elegant hand portrait photography. Model hand in graceful artistic pose wearing the ring. Beautiful manicured fingers with subtle nail color. Soft diffused lighting highlighting metal and stone. Shallow depth of field. Background softly blurred. The hand pose tells a story — touching silk, resting on shoulder, or delicate gesture.',
 'model', 'hand_detail', 'yuzuk', 33),

('Neck Necklace Portrait', 'Kolye Boyun Portre', 'Neck and decolletage with necklace', 'Kolye ile boyun ve dekolte',
 'Intimate portrait focusing on neck and decolletage. Model wearing the necklace with head slightly tilted. Soft beauty lighting emphasizing skin texture and jewelry sparkle. Clean elegant clothing that reveals neckline. Shallow DOF with jewelry tack-sharp. The necklace as the hero of the composition.',
 'model', 'neck_detail', 'kolye', 34),

('Ear Earring Close', 'Küpe Kulak Yakın', 'Profile shot highlighting earring', 'Küpeyi öne çıkaran profil çekim',
 'Profile or three-quarter portrait photography. Model with elegant hairstyle pulled back revealing ear and earring. Soft rim light catching the earring facets. Beautiful skin texture visible. Minimal distracting elements. The earring catches light beautifully against the model profile. Editorial jewelry portrait.',
 'model', 'ear_detail', 'kupe', 35),

('Wrist Bracelet Lifestyle', 'Bileklik Bilek Yaşam', 'Wrist detail with bracelet', 'Bileklikle bilek detay',
 'Lifestyle wrist portrait. Model wrist wearing the bracelet in a natural elegant moment — reaching for a coffee cup, touching fabric, or resting on a luxurious surface. Soft natural lighting. Shallow depth of field keeping bracelet sharp. The bracelet integrates naturally into a moment of luxury.',
 'model', 'wrist_detail', 'bileklik', 36)
ON CONFLICT DO NOTHING;

-- ── MACRO (4) — Yakın çekim detay ──

INSERT INTO scenes (name, name_tr, description, description_tr, prompt, category, sub_category, product_type_category, sort_order)
VALUES
('Extreme Stone Detail', 'Taş Detay Extreme', 'Ultra close-up on gemstone facets', 'Taş fasetlerinde ultra yakın çekim',
 'Extreme macro photography of the jewelry gemstone. Ultra-shallow depth of field (f/2.8) with only the primary facet in sharp focus. Light refracting through stone creating prismatic fire. Every inclusion and facet visible. No hands, no model. Scientific precision meets artistic beauty. The stone universe revealed.',
 'macro', 'stone', 'genel', 40),

('Metal Texture Study', 'Metal Doku Çalışması', 'Close-up of metal craftsmanship', 'Metal işçiliğinin yakın çekimi',
 'Macro photography study of the jewelry metal surface. Revealing the craftsmanship — polishing marks, grain texture, hallmarks. Directional raking light at low angle emphasizing surface topology. No hands, no model. The quality of metalwork as the subject. Industrial beauty of precision manufacturing.',
 'macro', 'metal', 'genel', 41),

('Setting Architecture', 'Taş Montür Mimarisi', 'Close-up of stone setting/prongs', 'Taş montür ve tırnakların yakın çekimi',
 'Architectural macro photography of the jewelry setting. Prongs, bezels, channels revealed in extreme detail. The engineering precision of stone mounting visible. Directional lighting creating shadows that reveal 3D structure. No hands, no model. The micro-architecture of fine jewelry making.',
 'macro', 'setting', 'genel', 42),

('Light Play Detail', 'Işık Oyunu Detay', 'Capturing light interaction with jewelry', 'Mücevherin ışıkla etkileşimi',
 'Artistic macro photography capturing how light interacts with the jewelry. Brilliance, fire, scintillation all visible. Multiple point light sources creating complex highlight patterns. Shallow DOF with selective focus on the brightest light interaction point. No hands, no model. The physics of beauty — light as the co-star.',
 'macro', 'light', 'genel', 43)
ON CONFLICT DO NOTHING;

-- ── CLOSEUP (4) — Model üzerinde yakın çekim ──

INSERT INTO scenes (name, name_tr, description, description_tr, prompt, category, sub_category, product_type_category, sort_order)
VALUES
('Ring Hand Intimate', 'Yüzük El Yakın', 'Tight crop on hand wearing ring', 'Yüzük takan elin yakın çekimi',
 'Intimate close-up photography. Tight crop on model hand wearing the ring. Fingers in graceful natural position. Soft beauty lighting with shallow DOF (f/1.8). Skin texture visible and beautiful. Background completely dissolved into creamy bokeh. The ring dominates the frame in context of elegant hand.',
 'closeup', 'hand', 'yuzuk', 50),

('Necklace Decolletage Close', 'Kolye Dekolte Yakın', 'Tight crop on necklace on chest', 'Göğüste kolye yakın çekim',
 'Intimate close-up on necklace resting on decolletage. Tight crop showing only collarbone area and necklace. Soft warm lighting on skin. Shallow DOF with necklace pendant tack-sharp. Subtle clothing edge visible but not distracting. The necklace as intimate personal adornment.',
 'closeup', 'neck', 'kolye', 51),

('Earring Profile Close', 'Küpe Profil Yakın', 'Tight crop on ear with earring', 'Küpeli kulak yakın çekim',
 'Intimate close-up on ear wearing the earring. Tight crop showing ear, earlobe, and earring. Hair elegantly swept back. Soft directional light catching earring facets. Skin texture beautiful and natural. Shallow DOF with earring perfectly sharp. The earring as a frame for the face.',
 'closeup', 'ear', 'kupe', 52),

('Bracelet Wrist Close', 'Bileklik Bilek Yakın', 'Tight crop on wrist with bracelet', 'Bileklikli bilek yakın çekim',
 'Intimate close-up on wrist wearing the bracelet. Tight crop showing forearm section with bracelet centered. Graceful wrist position. Soft directional lighting emphasizing both skin and metal. Shallow DOF with bracelet sharp. Natural elegant composition showing bracelet as daily luxury.',
 'closeup', 'wrist', 'bileklik', 53)
ON CONFLICT DO NOTHING;

-- ── LIFESTYLE (4) — Yaşam tarzı lüks ortamlar ──

INSERT INTO scenes (name, name_tr, description, description_tr, prompt, category, sub_category, product_type_category, sort_order)
VALUES
('Morning Luxury Routine', 'Sabah Lüks Rutini', 'Morning routine with jewelry', 'Mücevherle sabah rutini',
 'Lifestyle photography capturing a luxurious morning moment. Model in elegant robe at a marble vanity or breakfast setting. Soft morning light streaming through sheer curtains. The jewelry being the finishing touch of a beautiful morning ritual. Warm intimate atmosphere. Five-star hotel suite or elegant apartment.',
 'lifestyle', 'morning', 'genel', 60),

('Evening Out Glamour', 'Akşam Dışarı Glamur', 'Evening dinner/event moment', 'Akşam yemeği/etkinlik anı',
 'Lifestyle photography capturing an elegant evening moment. Model dressed for a special occasion in upscale restaurant or event venue. Warm ambient candlelight and soft overhead lighting. The jewelry catching light as the perfect evening accessory. Sophisticated atmosphere with subtle bokeh background.',
 'lifestyle', 'evening', 'genel', 61),

('Travel Luxury Moment', 'Seyahat Lüks Anı', 'Travel scene with jewelry', 'Mücevherle seyahat sahnesi',
 'Lifestyle photography capturing a luxurious travel moment. Model at a scenic destination — hotel balcony with view, airplane first class, luxury car interior. Natural light with golden tones. The jewelry as the constant companion of an extraordinary life. Aspirational wanderlust meets personal luxury.',
 'lifestyle', 'travel', 'genel', 62),

('Cafe Culture Chic', 'Kafe Kültürü Şık', 'Parisian cafe style moment', 'Paris kafe tarzı an',
 'Lifestyle photography capturing a chic cafe moment. Model at an elegant European-style cafe — marble table, espresso, morning newspaper or book. Soft natural daylight from large windows. The jewelry visible in a natural casual-luxury context. Effortless Parisian chic. The art of wearing jewelry in everyday extraordinary moments.',
 'lifestyle', 'cafe', 'genel', 63)
ON CONFLICT DO NOTHING;
