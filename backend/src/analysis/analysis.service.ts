import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GEMINI_MODELS } from '../common/enums';

export interface ProductAnalysisResult {
  product_type: string;      // ring, earring, necklace, bracelet, set
  category: string;           // fine_jewelry, fashion_jewelry, bridal, etc.
  metal_color: string;        // yellow_gold, white_gold, rose_gold, platinum, silver, mixed
  dominant_shape: string;     // round, oval, marquise, pear, heart, emerald, princess, cushion, etc.
  stone_presence: boolean;
  stone_types: string[];      // diamond, ruby, sapphire, emerald, pearl, etc.
  stone_layout_summary: string; // e.g. "single center stone with halo", "pavé band"
  stone_count_estimate: string; // "1", "3", "many", "none"
  complexity_score: number;   // 1-10 — how complex the piece is
  craftsmanship_notes: string;
  key_visual_features: string[];
  recommended_angles: string[]; // front, side, top, detail
  product_condition: string;  // excellent, good, fair, needs_retouch
  background_quality: string; // clean, busy, mixed
}

export interface ReferenceAnalysisResult {
  reference_type: string;     // style, scene, model, campaign, composition
  environment_type: string;   // studio, outdoor, indoor, abstract
  composition_type: string;   // centered, rule_of_thirds, diagonal, symmetrical
  light_type: string;         // natural, studio, dramatic, soft, golden_hour
  color_palette: { primary: string; secondary: string; accent: string; mood: string };
  wardrobe_style: string;     // minimal, elegant, casual, formal, editorial
  mood_class: string;         // luxury, romantic, bold, quiet_luxury, resort, gala, wedding
  camera_perspective: string; // close_up, medium, full_body, overhead, low_angle
  subject_presence: boolean;
  subject_pose_summary: string;
  luxury_intensity_score: number; // 1-10
  suggested_fusion_strategy: string; // style_transfer, scene_rebuild, reference_merge
  reusability_notes: string;
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);
  private readonly apiKey: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('GOOGLE_ANALYSIS_API_KEY')
      || this.config.get<string>('GOOGLE_API_KEY')
      || '';
    if (!this.apiKey) this.logger.warn('No Google API key — analysis will fail');
  }

  async analyzeProduct(imageBase64: string): Promise<ProductAnalysisResult> {
    const prompt = `You are a professional jewelry analyst. Analyze this jewelry image and return a JSON object with EXACTLY these fields:

{
  "product_type": "ring|earring|necklace|bracelet|set",
  "category": "fine_jewelry|fashion_jewelry|bridal|vintage|artisan",
  "metal_color": "yellow_gold|white_gold|rose_gold|platinum|silver|mixed",
  "dominant_shape": "description of dominant shape/cut",
  "stone_presence": true/false,
  "stone_types": ["diamond", "ruby", ...] or [],
  "stone_layout_summary": "description of stone arrangement",
  "stone_count_estimate": "none|1|2|3|few|many",
  "complexity_score": 1-10,
  "craftsmanship_notes": "brief quality/craft observation",
  "key_visual_features": ["feature1", "feature2"],
  "recommended_angles": ["front", "side", "detail"],
  "product_condition": "excellent|good|fair|needs_retouch",
  "background_quality": "clean|busy|mixed"
}

Return ONLY valid JSON, no markdown, no explanation.`;

    return this.callGeminiVision<ProductAnalysisResult>(prompt, imageBase64);
  }

  async analyzeReference(imageBase64: string): Promise<ReferenceAnalysisResult> {
    const prompt = `You are a professional creative director analyzing a reference image for jewelry campaign production. Analyze this image and return a JSON object with EXACTLY these fields:

{
  "reference_type": "style|scene|model|campaign|composition",
  "environment_type": "studio|outdoor|indoor|abstract",
  "composition_type": "centered|rule_of_thirds|diagonal|symmetrical|dynamic",
  "light_type": "natural|studio|dramatic|soft|golden_hour|rim|chiaroscuro",
  "color_palette": {"primary": "hex_or_name", "secondary": "hex_or_name", "accent": "hex_or_name", "mood": "warm|cool|neutral|mixed"},
  "wardrobe_style": "minimal|elegant|casual|formal|editorial|luxury",
  "mood_class": "luxury|romantic|bold|quiet_luxury|resort|gala|wedding|editorial|artistic",
  "camera_perspective": "close_up|medium|full_body|overhead|low_angle|profile",
  "subject_presence": true/false,
  "subject_pose_summary": "description of pose or 'no subject'",
  "luxury_intensity_score": 1-10,
  "suggested_fusion_strategy": "style_transfer|scene_rebuild|reference_merge",
  "reusability_notes": "how this reference can best be used with jewelry products"
}

Return ONLY valid JSON, no markdown, no explanation.`;

    return this.callGeminiVision<ReferenceAnalysisResult>(prompt, imageBase64);
  }

  private async callGeminiVision<T>(prompt: string, imageBase64: string): Promise<T> {
    const model = GEMINI_MODELS.ANALYSIS;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const requestBody = {
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    };

    this.logger.log(`Calling Gemini ${model} for analysis...`);
    const startTime = Date.now();

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(`Gemini analysis error ${response.status}: ${errText.substring(0, 300)}`);
      throw new Error(`Gemini analysis API error ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Gemini returned no text content');
    }

    const elapsed = Date.now() - startTime;
    this.logger.log(`Gemini analysis completed in ${elapsed}ms`);

    // Parse JSON — handle markdown code blocks
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch (parseErr) {
      this.logger.error(`Failed to parse Gemini response: ${cleaned.substring(0, 200)}`);
      throw new Error('Failed to parse analysis JSON from Gemini');
    }
  }
}
