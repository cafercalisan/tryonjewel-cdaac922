-- Character DNA Expansion: Add makeup, editorial identity, body structure, and distinctive features
ALTER TABLE user_models
  ADD COLUMN IF NOT EXISTS body_proportions TEXT,
  ADD COLUMN IF NOT EXISTS makeup_style TEXT,
  ADD COLUMN IF NOT EXISTS eye_makeup TEXT,
  ADD COLUMN IF NOT EXISTS lip_color TEXT,
  ADD COLUMN IF NOT EXISTS skin_finish TEXT,
  ADD COLUMN IF NOT EXISTS distinctive_features JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS editorial_reference TEXT,
  ADD COLUMN IF NOT EXISTS jewelry_affinity TEXT;
