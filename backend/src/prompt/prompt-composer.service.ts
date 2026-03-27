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
  poseKey?: string;               // multi-angle: front, three_quarter, side, top_down
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
    blocks.task = this.buildTaskBlock(input.mode, input.poseKey);

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
    blocks.camera = this.buildCameraBlock(input.mode, input.productAnalysis, input.poseKey);

    // ── Lighting block ──
    blocks.lighting = this.buildLightingBlock(input.mode, input.referenceAnalysis, input.poseKey);

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

  private buildTaskBlock(mode: GenerationMode, poseKey?: string): string {
    // ── Multi-angle retouch has angle-specific task instructions ──
    if (mode === GenerationMode.RETOUCH && poseKey) {
      const angleLabels: Record<string, string> = {
        front: 'FRONTAL VIEW',
        three_quarter: 'THREE-QUARTER VIEW (30-40° rotation)',
        side: 'SIDE PROFILE VIEW (90° rotation)',
        top_down: 'TOP-DOWN / BIRD\'S EYE VIEW',
      };
      const label = angleLabels[poseKey] || poseKey.toUpperCase();
      return [
        `Generate a professional e-commerce retouch of this jewelry product from the ${label}.`,
        'Remove all background imperfections and replace with a clean, pure white (#FFFFFF) seamless studio background.',
        'Balance metal colors, enhance diamond/gemstone brilliance, clean edges.',
        `IMPORTANT: Render the product as it would appear when photographed from this specific angle (${label}).`,
        'Use the provided reference image to understand the product\'s exact geometry, then mentally rotate it to the requested angle.',
        'The output must look like a real photograph taken from this angle — not a digital rotation or distortion of the original.',
        'Maintain absolute fidelity to the product design: same stones, same metal, same proportions.',
      ].join(' ');
    }

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

  private buildCameraBlock(mode: GenerationMode, analysis: ProductAnalysisResult, poseKey?: string): string {
    // ── Multi-angle retouch camera directions ──
    if (mode === GenerationMode.RETOUCH && poseKey) {
      const angleCamera = this.getRetouchAngleCamera(poseKey, analysis.product_type);
      if (angleCamera) return `Camera: ${angleCamera}`;
    }

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

  /** Angle-specific camera instructions for multi-angle retouch */
  private getRetouchAngleCamera(poseKey: string, productType: string): string | null {
    const isRing = productType === 'ring';
    const isEarring = productType === 'earring';
    const isNecklace = productType === 'necklace';
    const isBracelet = productType === 'bracelet';

    const angles: Record<string, string> = {
      front: [
        'Straight-on frontal shot, camera perfectly aligned with the product center.',
        'The jewelry fills 70-80% of the frame height.',
        'Lens: 90-100mm macro equivalent, f/8 for full sharpness edge-to-edge.',
        isRing ? 'Ring standing upright, face-on view showing the main stone and setting clearly.' :
        isEarring ? 'Earring face-on, showing the full decorative front surface.' :
        isNecklace ? 'Pendant centered, chain draped symmetrically.' :
        isBracelet ? 'Bracelet laid flat or on a cylindrical form, clasp hidden, main design visible.' :
        'Product positioned to show the most iconic frontal view.',
        'This is the hero product shot — pristine, centered, definitive.',
      ].join(' '),

      three_quarter: [
        'Three-quarter angle shot (approximately 30-40° rotation from frontal).',
        'Camera slightly elevated (10-15° above eye level).',
        'This angle reveals depth and three-dimensionality of the piece.',
        isRing ? 'Ring rotated to show the side profile of the setting and band curvature. Stone brilliance catching the new angle.' :
        isEarring ? 'Earring angled to reveal post/clip mechanism and side profile depth.' :
        isNecklace ? 'Chain links and pendant shown at angle revealing craftsmanship depth.' :
        isBracelet ? 'Bracelet curved form visible, showing thickness and link construction.' :
        'Product rotated to reveal construction details not visible from front.',
        'Lens: 90mm macro, f/5.6 for gentle depth falloff on the far edge.',
      ].join(' '),

      side: [
        'Pure side profile shot (90° rotation from frontal view).',
        'Camera at product eye-level, capturing the thinnest silhouette.',
        isRing ? 'Ring in perfect profile showing band thickness, stone height, setting architecture from the side.' :
        isEarring ? 'Earring side view showing depth, drop length, and structural engineering.' :
        isNecklace ? 'Pendant side profile showing thickness and bail connection. Chain links visible in profile.' :
        isBracelet ? 'Bracelet side view showing hinge mechanism, clasp, and cross-section profile.' :
        'Clean silhouette view emphasizing the profile geometry.',
        'This view communicates scale and proportion that frontal cannot.',
        'Lens: 100mm macro, f/8, razor-sharp across the narrow depth plane.',
      ].join(' '),

      top_down: [
        'Top-down (bird\'s eye) shot, camera directly above the product looking straight down.',
        'Product laying flat on the surface.',
        isRing ? 'Ring laying flat, showing the full circle, stone from directly above revealing the table facet and halo if present.' :
        isEarring ? 'Pair of earrings laid symmetrically side by side from above.' :
        isNecklace ? 'Necklace arranged in elegant oval or circle layout from above, pendant at the bottom center.' :
        isBracelet ? 'Bracelet in a circle or open arc from above, showing the full circumference pattern.' :
        'Product arranged flat showing the overall footprint and pattern from above.',
        'This angle is crucial for showing stone arrangement, engraving patterns, and symmetry.',
        'Lens: 85mm, f/11 for maximum depth of field across the flat plane.',
      ].join(' '),
    };

    return angles[poseKey] || null;
  }

  private buildLightingBlock(mode: GenerationMode, refAnalysis?: ReferenceAnalysisResult, poseKey?: string): string {
    if (refAnalysis?.light_type) {
      return `Lighting: ${refAnalysis.light_type} — inspired by reference image lighting.`;
    }

    // ── Multi-angle retouch lighting ──
    if (mode === GenerationMode.RETOUCH && poseKey) {
      const angleLighting: Record<string, string> = {
        front: 'Two softboxes at 45° left and right (key+fill), overhead strip light for top sparkle. Even, shadow-free, commercial. White bounce below for under-chin fill on raised pieces.',
        three_quarter: 'Key light shifted to match the viewing angle (front-left at 40°), accent rim light from back-right to separate edge from background. Gentle shadow under the piece adds dimensionality.',
        side: 'Single key light directly opposite the camera (behind the product from camera\'s perspective) creating a dramatic rim/edge light. Fill card on camera side to lift shadow detail. This reveals surface texture and engraving.',
        top_down: 'Ring light or circular softbox directly around the lens for even overhead illumination. No directional shadow — the flat lay demands shadowless clarity. Subtle dark card below camera to add contrast to metal reflections.',
      };
      return `Lighting: ${angleLighting[poseKey] || angleLighting.front}`;
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
