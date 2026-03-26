// ── Generation modes (PRD Section 8) ──
export enum GenerationMode {
  RETOUCH = 'retouch',
  READY_SCENE = 'ready_scene',
  REFERENCE_FUSION = 'reference_fusion',
  MODEL_SHOWCASE = 'model_showcase',
  EXPERIENCE = 'experience',
  BASIC_VIDEO = 'basic_video',
  MASTER_PACKAGE = 'master_package',
}

// ── Product types (PRD Section 10.3) ──
export enum ProductType {
  RING = 'ring',
  EARRING = 'earring',
  NECKLACE = 'necklace',
  BRACELET = 'bracelet',
  SET = 'set',
}

// ── Metal colors ──
export enum MetalColor {
  YELLOW_GOLD = 'yellow_gold',
  WHITE_GOLD = 'white_gold',
  ROSE_GOLD = 'rose_gold',
  PLATINUM = 'platinum',
  SILVER = 'silver',
  MIXED = 'mixed',
}

// ── Reference types (PRD Section 10.2) ──
export enum ReferenceType {
  STYLE = 'style',
  SCENE = 'scene',
  MODEL = 'model',
  CAMPAIGN = 'campaign',
  COMPOSITION = 'composition',
}

// ── Reference fusion strategies (PRD Section 8.3) ──
export enum FusionStrategy {
  STYLE_TRANSFER = 'style_transfer',
  SCENE_REBUILD = 'scene_rebuild',
  REFERENCE_MERGE = 'reference_merge',
}

// ── Job statuses (PRD Section 10.8) ──
export enum JobStatus {
  QUEUED = 'queued',
  ANALYZING_PRODUCT = 'analyzing_product',
  ANALYZING_REFERENCE = 'analyzing_reference',
  COMPOSING_PROMPT = 'composing_prompt',
  GENERATING = 'generating',
  QC_CHECK = 'qc_check',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// ── Job item statuses ──
export enum JobItemStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// ── QC verdicts (PRD Section 16) ──
export enum QCVerdict {
  PASS = 'pass',
  SOFT_WARNING = 'soft_warning',
  FAIL_REGENERATE = 'fail_regenerate',
}

// ── Asset types ──
export enum AssetType {
  IMAGE = 'image',
  VIDEO = 'video',
}

// ── Scene categories ──
export enum SceneCategory {
  EDITORIAL = 'editorial',
  ECOMMERCE = 'ecommerce',
  MODEL = 'model',
  MACRO = 'macro',
  CLOSEUP = 'closeup',
  LIFESTYLE = 'lifestyle',
}

// ── Gemini model names ──
export const GEMINI_MODELS = {
  FLASH: 'gemini-3.1-flash-preview',
  FLASH_IMAGE: 'gemini-3.1-flash-image-preview',
  PRO_IMAGE: 'gemini-3-pro-image-preview',
  ANALYSIS: 'gemini-3.1-flash-lite-preview',
  VEO: 'veo-3.1',
} as const;

// ── Queue names ──
export const QUEUE_NAMES = {
  ANALYSIS: 'analysis',
  IMAGE_GENERATION: 'image-generation',
  VIDEO_GENERATION: 'video-generation',
  QC: 'qc',
} as const;
