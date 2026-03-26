import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrdTables1711468800000 implements MigrationInterface {
  name = 'AddPrdTables1711468800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Enum types ──
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE generation_mode AS ENUM (
          'retouch', 'ready_scene', 'reference_fusion',
          'model_showcase', 'experience', 'basic_video', 'master_package'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE job_status AS ENUM (
          'queued', 'analyzing_product', 'analyzing_reference',
          'composing_prompt', 'generating', 'qc_check', 'completed', 'failed'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE job_item_status AS ENUM ('queued', 'processing', 'completed', 'failed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE product_type_enum AS ENUM ('ring', 'earring', 'necklace', 'bracelet', 'set');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE metal_color_enum AS ENUM (
          'yellow_gold', 'white_gold', 'rose_gold', 'platinum', 'silver', 'mixed'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE reference_type_enum AS ENUM ('style', 'scene', 'model', 'campaign', 'composition');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE fusion_strategy_enum AS ENUM ('style_transfer', 'scene_rebuild', 'reference_merge');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE qc_verdict_enum AS ENUM ('pass', 'soft_warning', 'fail_regenerate');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE asset_type_enum AS ENUM ('image', 'video');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // ── Products ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        original_image_url TEXT NOT NULL,
        product_type product_type_enum,
        category TEXT,
        metal_color metal_color_enum,
        dominant_shape TEXT,
        stone_presence BOOLEAN DEFAULT false,
        stone_layout_summary TEXT,
        set_group_id UUID,
        complexity_score NUMERIC,
        analysis_json JSONB,
        status TEXT DEFAULT 'uploaded',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);`);

    // ── Product Sets ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS product_sets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        set_name TEXT NOT NULL,
        metal_family TEXT,
        style_family TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── References ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "references" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        original_image_url TEXT NOT NULL,
        reference_type reference_type_enum,
        analysis_json JSONB,
        mood_tags TEXT[] DEFAULT '{}',
        environment_type TEXT,
        composition_type TEXT,
        light_type TEXT,
        color_palette JSONB,
        wardrobe_style TEXT,
        mood_class TEXT,
        camera_perspective TEXT,
        subject_presence BOOLEAN DEFAULT false,
        luxury_intensity_score NUMERIC,
        suggested_fusion_strategy fusion_strategy_enum,
        status TEXT DEFAULT 'uploaded',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_references_user_id ON "references"(user_id);`);

    // ── Generation Jobs ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS generation_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        set_group_id UUID,
        reference_id UUID REFERENCES "references"(id) ON DELETE SET NULL,
        job_mode generation_mode NOT NULL,
        requested_package TEXT,
        model_id UUID,
        scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
        reference_strategy TEXT,
        output_ratio TEXT DEFAULT '3:4',
        resolution TEXT,
        status job_status DEFAULT 'queued',
        progress INTEGER DEFAULT 0,
        error_message TEXT,
        prompt_version TEXT,
        image_model_name TEXT,
        video_model_name TEXT,
        credits_used INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_generation_jobs_user_id ON generation_jobs(user_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON generation_jobs(status);`);

    // ── Generation Job Items ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS generation_job_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
        item_type TEXT NOT NULL,
        mode TEXT,
        pose_key TEXT,
        motion_key TEXT,
        status job_item_status DEFAULT 'queued',
        worker_attempt_count INTEGER DEFAULT 0,
        output_image_id UUID,
        output_video_id UUID,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_job_items_job_id ON generation_job_items(job_id);`);

    // ── Generated Images (v2) ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS generated_images (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        set_group_id UUID,
        reference_id UUID REFERENCES "references"(id) ON DELETE SET NULL,
        model_id UUID,
        scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
        job_id UUID REFERENCES generation_jobs(id) ON DELETE SET NULL,
        image_type TEXT,
        mode generation_mode,
        output_url TEXT NOT NULL,
        preview_url TEXT,
        resolution TEXT,
        qc_score NUMERIC,
        qc_verdict TEXT,
        prompt_snapshot_json JSONB,
        is_favorite BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_generated_images_user_id ON generated_images(user_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_generated_images_mode ON generated_images(mode);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_generated_images_created_at ON generated_images(created_at DESC);`);

    // ── Videos (v2) ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS videos_v2 (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        reference_id UUID REFERENCES "references"(id) ON DELETE SET NULL,
        source_image_id UUID,
        job_id UUID REFERENCES generation_jobs(id) ON DELETE SET NULL,
        mode generation_mode,
        output_url TEXT NOT NULL,
        duration_seconds INTEGER,
        resolution TEXT,
        motion_preset TEXT,
        qc_score NUMERIC,
        prompt_snapshot_json JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── QC Reports ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS qc_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_type asset_type_enum NOT NULL,
        image_id UUID,
        video_id UUID,
        visibility_score NUMERIC,
        fidelity_score NUMERIC,
        artifact_score NUMERIC,
        temporal_score NUMERIC,
        verdict qc_verdict_enum,
        notes_json JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Prompt Templates ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS prompt_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        mode generation_mode NOT NULL,
        version TEXT NOT NULL,
        template_json JSONB NOT NULL,
        image_model_name TEXT,
        video_model_name TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_prompt_templates_mode ON prompt_templates(mode);`);

    // ── Triggers for updated_at ──
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_v2()
      RETURNS TRIGGER AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_generation_jobs_updated_at ON generation_jobs;
      CREATE TRIGGER trg_generation_jobs_updated_at
        BEFORE UPDATE ON generation_jobs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_v2();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS qc_reports CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS prompt_templates CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS videos_v2 CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS generated_images CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS generation_job_items CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS generation_jobs CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "references" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS product_sets CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS products CASCADE;`);
    // Don't drop enum types — they might be used elsewhere
  }
}
