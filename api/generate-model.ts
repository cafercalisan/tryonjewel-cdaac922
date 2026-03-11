import type { Request, Response } from 'express';
import { getServiceClient } from './_lib/supabase.js';
import { authenticateUser } from './_lib/auth.js';
import { handleCors, sendCorsResponse } from './_lib/cors.js';

// ═══════════════════════════════════════════════════════════════
// CHARACTER DNA SYSTEM - Advanced Prompt Engineering
// ═══════════════════════════════════════════════════════════════

const buildCharacterMasterData = (params: {
  name: string; gender: string; ethnicity: string; ageRange: string;
  skinTone: string; skinUndertone: string; faceShape: string;
  eyeColor: string; hairColor: string; hairStyle: string;
  hairTexture: string; expression: string; mood?: string; bodyType?: string;
  makeupStyle?: string; eyeMakeup?: string; lipColor?: string; skinFinish?: string;
  editorialReference?: string; jewelryAffinity?: string;
  bodyProportions?: string; distinctiveFeatures?: Record<string, string>;
}) => {
  let base = `
═══════════════════════════════════════════════════════════════
CHARACTER MASTER DATA - Sabit Karakter Özellikleri
═══════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│ IDENTITY                                                     │
├─────────────────────────────────────────────────────────────┤
│ full_name:        ${params.name}
│ age:              ${params.ageRange} - SABİT
│ nationality:      ${params.ethnicity}
│ vibe:             ${params.mood || 'Sophisticated luxury'}
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FACE STRUCTURE                                               │
├─────────────────────────────────────────────────────────────┤
│ face_shape:       ${params.faceShape}
│ eye_color:        ${params.eyeColor} - EXACT
│ eyebrow_shape:    Natural, well-groomed
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SKIN                                                         │
├─────────────────────────────────────────────────────────────┤
│ skin_tone:        ${params.skinTone}
│ skin_undertone:   ${params.skinUndertone}
│ skin_texture:     smooth with natural pore visibility
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ HAIR                                                         │
├─────────────────────────────────────────────────────────────┤
│ hair_color:       ${params.hairColor}
│ hair_texture:     ${params.hairTexture}
│ hair_style:       ${params.hairStyle}
└─────────────────────────────────────────────────────────────┘
`;

  if (params.makeupStyle || params.eyeMakeup || params.lipColor || params.skinFinish) {
    base += `
┌─────────────────────────────────────────────────────────────┐
│ MAKEUP & APPEARANCE                                          │
├─────────────────────────────────────────────────────────────┤
│ makeup_style:     ${params.makeupStyle || 'natural'}
│ eye_makeup:       ${params.eyeMakeup || 'natural'}
│ lip_color:        ${params.lipColor || 'nude'}
│ skin_finish:      ${params.skinFinish || 'satin'}
└─────────────────────────────────────────────────────────────┘
`;
  }

  if (params.editorialReference || params.jewelryAffinity) {
    base += `
┌─────────────────────────────────────────────────────────────┐
│ EDITORIAL IDENTITY                                           │
├─────────────────────────────────────────────────────────────┤
│ editorial_ref:    ${params.editorialReference || 'quiet-luxury'}
│ jewelry_affinity: ${params.jewelryAffinity || 'general'}
└─────────────────────────────────────────────────────────────┘
`;
  }

  if (params.bodyProportions) {
    base += `
┌─────────────────────────────────────────────────────────────┐
│ BODY STRUCTURE                                               │
├─────────────────────────────────────────────────────────────┤
│ proportions:      ${params.bodyProportions}
└─────────────────────────────────────────────────────────────┘
`;
  }

  if (params.distinctiveFeatures && Object.keys(params.distinctiveFeatures).length > 0) {
    const features = Object.entries(params.distinctiveFeatures)
      .map(([k, v]) => `│ ${k}: ${v}`)
      .join('\n');
    base += `
┌─────────────────────────────────────────────────────────────┐
│ DISTINCTIVE FEATURES                                         │
├─────────────────────────────────────────────────────────────┤
${features}
└─────────────────────────────────────────────────────────────┘
`;
  }

  return base;
};

const SSS_PROFILES: Record<string, string> = {
  'fair': 'Ultra-deep subsurface scattering: Pink/red undertones, strong vein visibility, maximum light penetration.',
  'light': 'High subsurface scattering: Warm/neutral undertone, noticeable translucency on thin skin areas.',
  'medium': 'Moderate subsurface scattering: Golden undertones, subtle translucency, rich warm depth.',
  'olive': 'Reduced subsurface scattering: Green-yellow undertones, minimal translucency, natural matte appearance.',
  'tan': 'Low subsurface scattering: Warm caramel undertones, very minimal translucency, natural sheen.',
  'brown': 'Minimal subsurface scattering: Cool to neutral undertones, velvety rich appearance.',
  'dark': 'Near-zero subsurface scattering: Deep melanin absorption, spectacular highlight definition.',
};

const POSE_LIBRARY: Record<string, { name: string; camera: string; lighting: string; composition: string; direction: string }> = {
  portrait: {
    name: 'Editorial Portrait',
    camera: 'Focal: 85mm f/1.8. Aperture: f/2.8. Focus: Eyes. Framing: Head + shoulders. Angle: 10-15° above eye level. Distance: 1.2m.',
    lighting: 'PRIMARY: 45° camera-right, 30° elevated (modified Rembrandt). FILL: Large white v-flat. RIM: Hair light back-right. COLOR TEMP: 5500K.',
    composition: 'Face: 60-70% frame occupancy. Gaze: 2 or 10 o\'clock. Ears: Both visible. Neck/décolletage: Clear.',
    direction: 'Expression: Serene confidence. Neck: Extended. Jaw: Relaxed. Eyes: Soft focus, distant contemplation.',
  },
  'hand-close': {
    name: 'Hand Close-Up (Ring/Bracelet)',
    camera: 'Focal: 100mm f/2.8 macro. Aperture: f/5.6. Focus: Jewelry contact point. Framing: Hands 80%. Angle: 45° overhead.',
    lighting: 'PRIMARY: Large overhead softbox. FILL: White base bounce. ACCENT: Gridded spot for catchlights. COLOR TEMP: 5000-5500K.',
    composition: 'Hands: Natural elegance. Fingers: Gentle curves. Nails: Clean, neutral. Jewelry: Centered.',
    direction: 'Hand gesture: Organic grace. Positioning: Overlapping or single hand rest. Skin detail: Knuckle texture visible.',
  },
  'neck-focus': {
    name: 'Neck/Décolletage Focus',
    camera: 'Focal: 85mm f/1.8. Aperture: f/4. Focus: Collarbone/necklace drape. Framing: Chin to sternum.',
    lighting: 'PRIMARY: Beauty dish, 20° elevated. FILL: Clamshell reflector below. COLOR TEMP: 5500K.',
    composition: 'Neck: Extended. Collarbone: Prominent. Décolletage: Smooth. Necklace: Centered.',
    direction: 'Head: Tilted slightly back. Chin: Elevated. Expression: Serene. Shoulders: Open chest.',
  },
  'ear-profile': {
    name: 'Ear Profile (Earring)',
    camera: 'Focal: 100mm f/2.8. Aperture: f/4. Focus: Ear/earring. Framing: Ear to shoulder.',
    lighting: 'PRIMARY: 90° side light. FILL: Minimal reflector. RIM: Strong backlight. COLOR TEMP: 5000-5500K.',
    composition: 'Profile: Clean contour. Ear: Fully exposed. Earring: Natural hang. Hair: Styled away.',
    direction: 'Face: 90° profile. Ear: Complete exposure. Expression: Calm, distant. Neck: Extended.',
  },
  'full-portrait': {
    name: 'Full Portrait (Multi-Jewelry)',
    camera: 'Focal: 70mm f/2.8. Aperture: f/5.6. Focus: Face/upper chest. Framing: Head to mid-torso.',
    lighting: 'PRIMARY: Large octabox 45°. FILL: White bounce 3:1. RIM: Dual rim lights. COLOR TEMP: 5500K.',
    composition: 'Full jewelry display: Ears, neck, chest, hands. Posture: Elegant. Clothing: Simple neckline.',
    direction: 'Posture: Elongated spine. Expression: Serene confidence. Gaze: Slightly off-camera.',
  },
  'hand-elegant': {
    name: 'Elegant Hand/Wrist (Bracelet)',
    camera: 'Focal: 100mm f/2.8 macro. Aperture: f/4. Focus: Wrist area. Framing: Hand and wrist.',
    lighting: 'PRIMARY: Large diffused panel overhead. FILL: White reflector below. ACCENT: Spot for catchlights.',
    composition: 'Wrist: Elegantly turned. Hand: Graceful gesture. Jewelry: Clear, centered.',
    direction: 'Hand gesture: Flowing. Wrist: Slightly rotated for display. Fingers: Soft, not rigid.',
  },
};

const EDITORIAL_STYLE_MAP: Record<string, { aesthetic: string; colorScience: string; lighting: string }> = {
  'quiet-luxury': {
    aesthetic: 'Vogue Italia, quiet luxury campaign',
    colorScience: 'Muted tones, elegant desaturation, lifted blacks',
    lighting: 'Soft directional light, subtle shadows',
  },
  'avant-garde': {
    aesthetic: 'i-D Magazine, boundary-pushing editorial',
    colorScience: 'Bold contrast, saturated accents, deep blacks',
    lighting: 'Dramatic shadows, hard directional light',
  },
  'classic-elegance': {
    aesthetic: 'Harper\'s Bazaar, timeless luxury',
    colorScience: 'Warm golden tones, rich midtones',
    lighting: 'Rembrandt lighting, warm color temperature',
  },
  'modern-power': {
    aesthetic: 'Vogue US, power editorial',
    colorScience: 'High contrast, clean whites, strong blacks',
    lighting: 'Strong key light, minimal fill, defined shadows',
  },
  'mediterranean-warm': {
    aesthetic: 'Mediterranean lifestyle campaign, sun-kissed',
    colorScience: 'Warm amber, honey tones, soft highlights',
    lighting: 'Golden hour, warm diffused natural light',
  },
  'minimalist-edge': {
    aesthetic: 'Scandinavian minimal, clean editorial',
    colorScience: 'Cool neutral, near-monochrome, soft gradients',
    lighting: 'Even, flat light, subtle directional accent',
  },
};

function buildAdvancedPrompt(params: {
  name: string; skinTone: string; skinUndertone: string; ethnicity: string;
  hairColor: string; hairTexture: string; gender: string; ageRange: string;
  faceShape?: string; eyeColor?: string; expression?: string; hairStyle?: string;
  mood?: string; bodyType?: string; isPoseGeneration?: boolean;
  poseType?: string; poseDescription?: string;
  makeupStyle?: string; eyeMakeup?: string; lipColor?: string; skinFinish?: string;
  editorialReference?: string; jewelryAffinity?: string;
  bodyProportions?: string; distinctiveFeatures?: Record<string, string>;
}): string {
  const poseConfig = params.poseType && POSE_LIBRARY[params.poseType] ? POSE_LIBRARY[params.poseType] : POSE_LIBRARY.portrait;
  const sssProfile = SSS_PROFILES[params.skinTone] || SSS_PROFILES['medium'];
  const editorial = EDITORIAL_STYLE_MAP[params.editorialReference || 'quiet-luxury'] || EDITORIAL_STYLE_MAP['quiet-luxury'];

  const makeupDirective = params.makeupStyle && params.makeupStyle !== 'no-makeup'
    ? `Makeup applied: ${params.makeupStyle} style. Eye: ${params.eyeMakeup || 'natural'}. Lip: ${params.lipColor || 'nude'}. Finish: ${params.skinFinish || 'satin'}.`
    : 'No makeup or minimal natural';

  return `
═══════════════════════════════════════════════════════════════
MODEL AGENCY TEST SHOT / DIGITALS
═══════════════════════════════════════════════════════════════

SKIN - REAL BUT HEALTHY:
- Natural texture, visible pores on nose/cheeks
- Normal healthy skin - not perfect, not diseased
- ${makeupDirective}

${buildCharacterMasterData({
  name: params.name, gender: params.gender, ethnicity: params.ethnicity,
  ageRange: params.ageRange, skinTone: params.skinTone,
  skinUndertone: params.skinUndertone, faceShape: params.faceShape || 'balanced',
  eyeColor: params.eyeColor || 'natural', hairColor: params.hairColor,
  hairStyle: params.hairStyle || 'natural', hairTexture: params.hairTexture,
  expression: params.expression || 'serene', mood: params.mood, bodyType: params.bodyType,
  makeupStyle: params.makeupStyle, eyeMakeup: params.eyeMakeup,
  lipColor: params.lipColor, skinFinish: params.skinFinish,
  editorialReference: params.editorialReference, jewelryAffinity: params.jewelryAffinity,
  bodyProportions: params.bodyProportions, distinctiveFeatures: params.distinctiveFeatures,
})}

═══════════════════════════════════════════════════════════════
IDENTITY PERMANENCE PROTOCOL [HIGHEST PRIORITY]
═══════════════════════════════════════════════════════════════

BIOLOGICAL FINGERPRINT:
• Cranial structure, proportional ratios, skin signature, micro-features

${params.isPoseGeneration ? `⚠️ IDENTITY CONSISTENCY MODE - Same person as references. Face INSTANTLY recognizable.` : `🆕 IDENTITY FOUNDATION MODE - Establishing permanent identity.`}

SKIN BIOLOGY: ${params.skinTone} with ${params.skinUndertone} undertone
${sssProfile}

═══════════════════════════════════════════════════════════════
POSE: ${poseConfig.name}
═══════════════════════════════════════════════════════════════
CAMERA: ${poseConfig.camera}
LIGHTING: ${poseConfig.lighting}. ${editorial.lighting}
COMPOSITION: ${poseConfig.composition}
DIRECTION: ${poseConfig.direction}
${params.poseDescription ? `\nADDITIONAL: ${params.poseDescription}` : ''}

EDITORIAL AESTHETIC: ${editorial.aesthetic}.
COLOR SCIENCE: ${editorial.colorScience}.

STRICT AVOIDANCE:
✗ Smoothed/plastic skin ✗ 3D render look ✗ Extra/missing fingers
✗ Unrealistic color ✗ Waxy appearance ✗ Watermarks/text

OUTPUT: 4K+, publication-ready, indistinguishable from professional photography.
Ultra high resolution output.
`;
}

export default async function handler(req: Request, res: Response) {
  handleCors(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const authResult = await authenticateUser(req);
    if ('error' in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }

    const userId = authResult.userId;
    console.log('Authenticated user:', userId);

    const {
      name, skinTone, skinUndertone, ethnicity, hairColor, hairTexture,
      gender, ageRange, faceShape, eyeColor, expression, hairStyle,
      mood, bodyType, modelData, poseType, poseDescription,
      makeupStyle, eyeMakeup, lipColor, skinFinish,
      editorialReference, jewelryAffinity, bodyProportions, distinctiveFeatures,
    } = req.body;

    const isPoseGeneration = !!modelData && !!poseType;
    console.log('Request type:', isPoseGeneration ? 'Pose generation' : 'New model creation');

    if (!isPoseGeneration) {
      if (!name || !skinTone || !skinUndertone || !ethnicity || !hairColor || !hairTexture || !gender || !ageRange) {
        return sendCorsResponse(res, 400, { error: 'Missing required fields for new model' });
      }
    }

    const supabase = getServiceClient();

    const modelPrompt = buildAdvancedPrompt({
      name: isPoseGeneration ? modelData.name : name,
      skinTone: isPoseGeneration ? modelData.skinTone : skinTone,
      skinUndertone: isPoseGeneration ? modelData.skinUndertone : (skinUndertone || 'neutral'),
      ethnicity: isPoseGeneration ? modelData.ethnicity : ethnicity,
      hairColor: isPoseGeneration ? modelData.hairColor : hairColor,
      hairTexture: isPoseGeneration ? modelData.hairTexture : hairTexture,
      gender: isPoseGeneration ? modelData.gender : gender,
      ageRange: isPoseGeneration ? modelData.ageRange : ageRange,
      faceShape: isPoseGeneration ? modelData.faceShape : faceShape,
      eyeColor: isPoseGeneration ? modelData.eyeColor : eyeColor,
      expression: isPoseGeneration ? modelData.expression : expression,
      hairStyle: isPoseGeneration ? modelData.hairStyle : hairStyle,
      mood: isPoseGeneration ? modelData.mood : mood,
      bodyType: isPoseGeneration ? modelData.bodyType : bodyType,
      isPoseGeneration,
      poseType,
      poseDescription: poseDescription || undefined,
      makeupStyle: isPoseGeneration ? modelData.makeup_style : makeupStyle,
      eyeMakeup: isPoseGeneration ? modelData.eye_makeup : eyeMakeup,
      lipColor: isPoseGeneration ? modelData.lip_color : lipColor,
      skinFinish: isPoseGeneration ? modelData.skin_finish : skinFinish,
      editorialReference: isPoseGeneration ? modelData.editorial_reference : editorialReference,
      jewelryAffinity: isPoseGeneration ? modelData.jewelry_affinity : jewelryAffinity,
      bodyProportions: isPoseGeneration ? modelData.body_proportions : bodyProportions,
      distinctiveFeatures: isPoseGeneration ? modelData.distinctive_features : distinctiveFeatures,
    });

    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    if (!GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY not configured');
    }

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GOOGLE_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: modelPrompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI generation error:', response.status, errorText);

      if (response.status === 429) {
        return sendCorsResponse(res, 429, { error: 'Rate limit exceeded. Please try again later.' });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));

    if (!imagePart?.inlineData?.data) {
      throw new Error('No valid image generated');
    }

    const base64Image = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType || 'image/png';

    const imageBuffer = Uint8Array.from(atob(base64Image), (c) => c.charCodeAt(0));
    const fileExtension = mimeType.includes('png') ? 'png' : 'jpg';
    const filePath = `${userId}/models/${Date.now()}.${fileExtension}`;

    const { error: uploadError } = await supabase.storage
      .from('jewelry-images')
      .upload(filePath, imageBuffer, { contentType: mimeType });

    if (uploadError) throw new Error('Failed to upload image');

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('jewelry-images')
      .createSignedUrl(filePath, 7 * 24 * 60 * 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error('Failed to generate image URL');
    }

    const imageUrl = signedUrlData.signedUrl;

    if (isPoseGeneration) {
      return sendCorsResponse(res, 200, { success: true, imageUrl });
    }

    const { data: modelRecord, error: insertError } = await supabase
      .from('user_models')
      .insert({
        user_id: userId, name,
        skin_tone: skinTone, skin_undertone: skinUndertone || 'neutral',
        ethnicity, hair_color: hairColor, hair_texture: hairTexture,
        gender, age_range: ageRange, face_shape: faceShape,
        eye_color: eyeColor, expression, hair_style: hairStyle,
        preview_image_url: imageUrl,
        makeup_style: makeupStyle || null,
        eye_makeup: eyeMakeup || null,
        lip_color: lipColor || null,
        skin_finish: skinFinish || null,
        editorial_reference: editorialReference || null,
        jewelry_affinity: jewelryAffinity || null,
        body_proportions: bodyProportions || null,
        distinctive_features: distinctiveFeatures || {},
      })
      .select()
      .single();

    if (insertError) throw new Error('Failed to save model');

    return sendCorsResponse(res, 200, { success: true, model: modelRecord });

  } catch (error) {
    console.error('Error:', error);
    return sendCorsResponse(res, 500, { error: error instanceof Error ? error.message : 'Unexpected error' });
  }
}
