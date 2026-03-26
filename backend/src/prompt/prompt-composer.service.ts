import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromptTemplate } from '../entities/prompt-template.entity';
import { GenerationMode } from '../common/enums';
import { ProductAnalysisResult, ReferenceAnalysisResult } from '../analysis/analysis.service';

export interface PromptComposeInput {
  mode: GenerationMode;
  productAnalysis: ProductAnalysisResult;
  scenePrompt?: string;           // from scenes table
  referenceAnalysis?: ReferenceAnalysisResult;
  fusionStrategy?: string;        // style_transfer, scene_rebuild, reference_merge
  modelDna?: Record<string, any>; // model identity payload
  outputRatio?: string;
  additionalInstructions?: string;
}

export interface ComposedPrompt {
  promptText: string;
  promptVersion: string;
  mode: GenerationMode;
  blocks: Record<string, string>;
}

@Injectable()
export class PromptComposerService {
  private readonly logger = new Logger(PromptComposerService.name);

  constructor(
    @InjectRepository(PromptTemplate) private templateRepo: Repository<PromptTemplate>,
  ) {}

  async compose(input: PromptComposeInput): Promise<ComposedPrompt> {
    // Get active template for mode
    const template = await this.templateRepo.findOne({
      where: { mode: input.mode, isActive: true },
      order: { createdAt: 'DESC' },
    });

    const blocks: Record<string, string> = {};

    // ── Task block ──
    blocks.task = this.buildTaskBlock(input.mode);

    // ── Product fidelity block ──
    blocks.fidelity = this.buildFidelityBlock(input.productAnalysis);

    // ── Scene block ──
    if (input.scenePrompt) {
      blocks.scene = input.scenePrompt;
    }

    // ── Reference block (PRD Section 15.1) ──
    if (input.referenceAnalysis && input.fusionStrategy) {
      blocks.reference = this.buildReferenceBlock(input.referenceAnalysis, input.fusionStrategy);
    }

    // ── Identity lock block ──
    if (input.modelDna) {
      blocks.identity = this.buildIdentityBlock(input.modelDna);
    }

    // ── Camera block ──
    blocks.camera = this.buildCameraBlock(input.mode, input.productAnalysis);

    // ── Lighting block ──
    blocks.lighting = this.buildLightingBlock(input.mode, input.referenceAnalysis);

    // ── Negative prompt block ──
    blocks.negative = this.buildNegativeBlock(input.mode);

    // ── Mode-specific styling ──
    blocks.styling = this.buildStylingBlock(input.mode, input.productAnalysis, input.referenceAnalysis);

    // Compose final prompt
    const promptParts = [
      blocks.task,
      blocks.fidelity,
      blocks.scene,
      blocks.reference,
      blocks.identity,
      blocks.camera,
      blocks.lighting,
      blocks.styling,
      input.additionalInstructions,
      `\n\nNEGATIVE (avoid): ${blocks.negative}`,
    ].filter(Boolean);

    return {
      promptText: promptParts.join('\n\n'),
      promptVersion: template?.version || 'seed-v1',
      mode: input.mode,
      blocks,
    };
  }

  // ── Block builders ──

  private buildTaskBlock(mode: GenerationMode): string {
    const tasks: Record<string, string> = {
      [GenerationMode.RETOUCH]:
        'Clean up and retouch this jewelry product image for e-commerce. Remove background imperfections, balance metal colors, enhance diamond/gemstone brilliance, clean edges. Output a professional catalog-ready product image.',
      [GenerationMode.READY_SCENE]:
        'Place this jewelry product naturally into the specified luxury scene. Match realistic shadows, reflections, and scale. The jewelry should look as if it was photographed in this scene.',
      [GenerationMode.REFERENCE_FUSION]:
        'Create a new image of this jewelry product inspired by the reference image style. Follow the specified fusion strategy while keeping the jewelry product accurate and prominent.',
      [GenerationMode.MODEL_SHOWCASE]:
        'Generate a professional editorial photograph of a model wearing this jewelry piece. The model should have the specified identity characteristics. The jewelry must be the focal point and anatomically correctly placed.',
      [GenerationMode.EXPERIENCE]:
        'Create an atmospheric, story-driven image featuring this jewelry piece in a lifestyle moment. The image should evoke luxury, emotion, and aspiration. Editorial campaign quality.',
    };
    return tasks[mode] || tasks[GenerationMode.RETOUCH];
  }

  private buildFidelityBlock(analysis: ProductAnalysisResult): string {
    const parts = [
      `Product type: ${analysis.product_type}`,
      `Metal: ${analysis.metal_color}`,
      analysis.stone_presence ? `Stones: ${analysis.stone_types?.join(', ')} — ${analysis.stone_layout_summary}` : 'No gemstones',
      `Shape: ${analysis.dominant_shape}`,
      `Key features: ${analysis.key_visual_features?.join(', ')}`,
      '',
      'CRITICAL: Preserve the exact jewelry geometry, metal color, stone arrangement, and proportions. Do not alter the product design.',
    ];
    return parts.join('\n');
  }

  private buildReferenceBlock(refAnalysis: ReferenceAnalysisResult, strategy: string): string {
    // PRD Section 15.1 — Reference Fusion Rules
    const strategyInstructions: Record<string, string> = {
      style_transfer: `Apply the reference image's visual style: ${refAnalysis.light_type} lighting, ${refAnalysis.mood_class} mood, ${refAnalysis.color_palette?.mood} color temperature. Keep the jewelry product as the hero — do NOT copy the reference subject or scene literally.`,
      scene_rebuild: `Rebuild a scene inspired by the reference: ${refAnalysis.environment_type} environment, ${refAnalysis.composition_type} composition, ${refAnalysis.camera_perspective} perspective. Place the jewelry naturally in this reconstructed scene.`,
      reference_merge: `Integrate the jewelry product into a scene similar to the reference image. Match the ${refAnalysis.light_type} lighting and ${refAnalysis.mood_class} atmosphere. The jewelry should feel native to the scene, not pasted in.`,
    };

    return [
      'REFERENCE GUIDANCE:',
      strategyInstructions[strategy] || strategyInstructions.style_transfer,
      '',
      'RULES: The product must remain visible and prominent. Reference style should enhance, not overpower the jewelry.',
      `Reference mood: ${refAnalysis.mood_class}`,
      `Reference composition: ${refAnalysis.composition_type}`,
      `Luxury intensity: ${refAnalysis.luxury_intensity_score}/10`,
    ].join('\n');
  }

  private buildIdentityBlock(modelDna: Record<string, any>): string {
    const parts = [
      'MODEL IDENTITY (maintain consistency across outputs):',
      modelDna.gender ? `Gender: ${modelDna.gender}` : '',
      modelDna.age_range ? `Age range: ${modelDna.age_range}` : '',
      modelDna.ethnicity ? `Ethnicity: ${modelDna.ethnicity}` : '',
      modelDna.skin_tone ? `Skin tone: ${modelDna.skin_tone}` : '',
      modelDna.hair_color ? `Hair: ${modelDna.hair_color}` : '',
      modelDna.expression ? `Expression: ${modelDna.expression}` : '',
    ].filter(Boolean);
    return parts.join('\n');
  }

  private buildCameraBlock(mode: GenerationMode, analysis: ProductAnalysisResult): string {
    const cameraByMode: Record<string, string> = {
      [GenerationMode.RETOUCH]: 'Straight-on product shot, centered, sharp focus on entire piece.',
      [GenerationMode.READY_SCENE]: 'Slightly elevated angle (15-30°), product centered with scene context visible.',
      [GenerationMode.REFERENCE_FUSION]: 'Match the reference image camera perspective.',
      [GenerationMode.MODEL_SHOWCASE]: analysis.product_type === 'ring'
        ? 'Elegant hand pose, 3/4 angle, shallow depth of field on ring.'
        : 'Portrait or 3/4 body, jewelry as focal point with beautiful bokeh.',
      [GenerationMode.EXPERIENCE]: 'Editorial composition with cinematic framing. Shallow depth of field.',
    };
    return `Camera: ${cameraByMode[mode] || cameraByMode[GenerationMode.RETOUCH]}`;
  }

  private buildLightingBlock(mode: GenerationMode, refAnalysis?: ReferenceAnalysisResult): string {
    if (refAnalysis?.light_type) {
      return `Lighting: ${refAnalysis.light_type} — inspired by reference image lighting.`;
    }
    const lightByMode: Record<string, string> = {
      [GenerationMode.RETOUCH]: 'Clean studio lighting, even exposure, no harsh shadows.',
      [GenerationMode.READY_SCENE]: 'Natural-looking light matching the scene environment.',
      [GenerationMode.MODEL_SHOWCASE]: 'Beauty lighting with key + fill, subtle catchlights.',
      [GenerationMode.EXPERIENCE]: 'Atmospheric lighting matching the story mood — warm, golden, or dramatic.',
    };
    return `Lighting: ${lightByMode[mode] || lightByMode[GenerationMode.RETOUCH]}`;
  }

  private buildNegativeBlock(mode: GenerationMode): string {
    const common = 'blurry, low quality, distorted jewelry, wrong proportions, fake sparkle, extra fingers, deformed hands, watermark, text overlay, cartoon, anime';
    const modeSpecific: Record<string, string> = {
      [GenerationMode.RETOUCH]: `${common}, busy background, props, hands, model`,
      [GenerationMode.READY_SCENE]: `${common}, floating product, wrong shadows, mismatched scale`,
      [GenerationMode.REFERENCE_FUSION]: `${common}, reference image copied literally, product hidden, product distorted by style`,
      [GenerationMode.MODEL_SHOWCASE]: `${common}, jewelry in wrong position, hair covering jewelry, clothing hiding product`,
      [GenerationMode.EXPERIENCE]: `${common}, product invisible, lifestyle scene without jewelry focus`,
    };
    return modeSpecific[mode] || common;
  }

  private buildStylingBlock(mode: GenerationMode, analysis: ProductAnalysisResult, refAnalysis?: ReferenceAnalysisResult): string {
    const parts: string[] = [];

    if (mode === GenerationMode.EXPERIENCE || mode === GenerationMode.MODEL_SHOWCASE) {
      parts.push('Style: High-end editorial campaign, luxury fashion magazine quality.');
      parts.push('Resolution: Ultra-detailed, sharp product with artistic background blur.');
    }

    if (mode === GenerationMode.RETOUCH) {
      parts.push('Style: Professional e-commerce product photography. Clean, precise, commercial.');
    }

    if (refAnalysis?.wardrobe_style) {
      parts.push(`Wardrobe hint: ${refAnalysis.wardrobe_style} — clothing should complement, not compete with jewelry.`);
    }

    return parts.join('\n');
  }
}
