import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient } from './_lib/supabase';
import { authenticateUser } from './_lib/auth';
import { corsHeaders, sendCorsResponse } from './_lib/cors';

export const config = {
  maxDuration: 300,
};

// ═══════════════════════════════════════════════════════════════
// CHARACTER DNA SYSTEM - Advanced Prompt Engineering
// ═══════════════════════════════════════════════════════════════

const buildCharacterMasterData = (params: {
  name: string; gender: string; ethnicity: string; ageRange: string;
  skinTone: string; skinUndertone: string; faceShape: string;
  eyeColor: string; hairColor: string; hairStyle: string;
  hairTexture: string; expression: string; mood?: string; bodyType?: string;
}) => `
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

function buildAdvancedPrompt(params: {
  name: string; skinTone: string; skinUndertone: string; ethnicity: string;
  hairColor: string; hairTexture: string; gender: string; ageRange: string;
  faceShape?: string; eyeColor?: string; expression?: string; hairStyle?: string;
  mood?: string; bodyType?: string; isPoseGeneration?: boolean;
  poseType?: string; poseDescription?: string;
}): string {
  const poseConfig = params.poseType && POSE_LIBRARY[params.poseType] ? POSE_LIBRARY[params.poseType] : POSE_LIBRARY.portrait;
  const sssProfile = SSS_PROFILES[params.skinTone] || SSS_PROFILES['medium'];

  return `
═══════════════════════════════════════════════════════════════
MODEL AGENCY TEST SHOT / DIGITALS
═══════════════════════════════════════════════════════════════

SKIN - REAL BUT HEALTHY:
- Natural texture, visible pores on nose/cheeks
- Normal healthy skin - not perfect, not diseased
- No makeup or minimal natural

${buildCharacterMasterData({
  name: params.name, gender: params.gender, ethnicity: params.ethnicity,
  ageRange: params.ageRange, skinTone: params.skinTone,
  skinUndertone: params.skinUndertone, faceShape: params.faceShape || 'balanced',
  eyeColor: params.eyeColor || 'natural', hairColor: params.hairColor,
  hairStyle: params.hairStyle || 'natural', hairTexture: params.hairTexture,
  expression: params.expression || 'serene', mood: params.mood, bodyType: params.bodyType,
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
LIGHTING: ${poseConfig.lighting}
COMPOSITION: ${poseConfig.composition}
DIRECTION: ${poseConfig.direction}
${params.poseDescription ? `\nADDITIONAL: ${params.poseDescription}` : ''}

EDITORIAL AESTHETIC: Vogue Italia, quiet luxury campaign.
COLOR SCIENCE: Cool-neutral, elegant desaturation, lifted blacks.

STRICT AVOIDANCE:
✗ Smoothed/plastic skin ✗ 3D render look ✗ Extra/missing fingers
✗ Unrealistic color ✗ Waxy appearance ✗ Watermarks/text

OUTPUT: 4K+, publication-ready, indistinguishable from professional photography.
Ultra high resolution output.
`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

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
    });

    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    if (!GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY not configured');
    }

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent', {
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
