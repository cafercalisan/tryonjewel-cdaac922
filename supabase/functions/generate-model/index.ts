import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ===== ADVANCED PROMPT SYSTEM =====

const IDENTITY_CORE = `IDENTITY PERMANENCE PROTOCOL [HIGHEST PRIORITY]:

You are simulating a REAL biological human being with permanent, immutable characteristics.
This is NOT digital art, NOT illustration, NOT stylization - this is PHOTOGRAPHIC REALISM.

BIOLOGICAL FINGERPRINT - These create an unchangeable person:
{IDENTITY_BLOCK}

IMMUTABLE TRAITS:
• Cranial structure: Orbital ridge, cheekbone prominence, jaw angle, chin shape
• Proportional ratios: Face width-to-height, neck length, shoulder breadth
• Skin signature: Melanin density map, subsurface scattering depth, pore distribution pattern
• Micro-features: Specific freckle/mole placement, natural asymmetries, skin texture fingerprint

CONSISTENCY LAW: Every subsequent generation MUST be immediately recognizable as this EXACT person.
Identity drift = Generation failure.`;

const CAMERA_SYSTEM = `OPTICAL SIMULATION [Technical Specifications]:

{CAMERA_BLOCK}

LENS PHYSICS:
• Depth of field: Mathematically accurate bokeh based on aperture + distance
• Focus plane: Razor-sharp on target, smooth Gaussian falloff
• Bokeh shape: Natural circular rendering, soft edge transition
• Aberration: Minimal, professionally corrected
• Distortion: Zero (prime lens characteristic)

SENSOR EMULATION:
• Dynamic range: 14.5 stops (professional full-frame)
• Color depth: 14-bit RAW equivalent
• Base ISO: 100 (maximum tonal range, minimum noise)
• Resolution: 8K sensor, output 4K for optimal sharpness
• Processing: Natural color science, NO digital manipulation artifacts`;

const LIGHTING_ARCHITECTURE = `STUDIO LIGHTING DESIGN [Professional Setup]:

LIGHTING SCENARIO: "Nordic Editorial Soft Light"
Simulates: Large north-facing window + professional modifier system

{LIGHTING_BLOCK}

LIGHT CHARACTERISTICS:
• Quality: Extremely soft wrap-around, no hard shadow edges
• Color temp: 6200K (cool daylight, editorial standard)
• Intensity ratios: Key 100% → Fill 40% → Rim 30%
• Falloff: Natural inverse-square law
• Environment: Neutral gray studio (18% reflectance), no color contamination

SURFACE INTERACTIONS:
Skin response:
  - Highlights: Gentle rolloff, natural sheen on T-zone
  - Subsurface: {SSS_INTENSITY} (scaled to melanin density)
  - Shadows: Soft gradient with preserved detail
  - Specular: Minimal (natural skin oils only)
  
Jewelry response:
  - Diamonds: Controlled facet separation, NO over-sparkle
  - Metals: Soft environmental reflections, gradient quality
  - Gemstones: Internal color depth, transparent edges
  - NO artificial glow, NO lens flare effects`;

const SKIN_BIOLOGY = `DERMATOLOGICAL RENDERING [Medical-Grade Accuracy]:

Skin classification: {SKIN_TONE} with {SKIN_UNDERTONE} undertone

MICRO-TEXTURE LAYER:
• Pore visibility: High-density on nose/cheeks, medium forehead, minimal eyelids
• Pore size: Biologically accurate 0.05-0.2mm apparent diameter
• Distribution: Natural randomness, NOT uniform grid
• Fine lines: Age-appropriate, expression-based (NOT premature aging)
• Vellus hair: Visible in rim/backlight, natural density and direction

SUBSURFACE SCATTERING (Melanin-Specific):
{SSS_PROFILE}

COLOR VARIATION (Natural):
• Warmth concentration: Around eyes, nose bridge
• Cooler zones: Temples, sides of neck
• Micro-redness: Capillary show-through (lighter tones only)
• Pigmentation: Random freckles/beauty marks (ethnicity-appropriate)

SURFACE PROPERTIES:
• T-zone: Slight natural sheen (sebum)
• Cheeks/periphery: More matte finish
• NO plastic appearance, NO waxy buildup, NO porcelain smoothing
• Skin must look ALIVE: tangible, warm, textured`;

const EDITORIAL_AESTHETIC = `VISUAL LANGUAGE [Luxury Editorial Standard]:

MOOD REFERENCE: Vogue Italia, high-fashion lookbook, quiet luxury campaign
NOT: E-commerce, commercial catalog, Instagram beauty

COLOR SCIENCE:
• Palette: Cool-neutral bias, elegant desaturation
• Contrast: Soft and refined (NOT punchy/HDR)
• Black point: Lifted to charcoal (NOT crushed)
• White point: Clean cream (NOT blown/stark)
• Midtones: Rich detail retention

TONAL REPRODUCTION:
Skin: Natural but slightly desaturated for editorial feel
Gold: Warm but muted, NOT brassy
White metals: Cool silver, NOT blue-tinted
Diamonds: Clear with subtle cool flash
Background: 15-20% darker than subject for natural separation

COMPOSITIONAL RESTRAINT:
• Negative space: Intentional, balanced
• Framing: Editorial precision, NOT snapshot
• Energy: Calm contemplation, NOT excitement
• Timelessness: Could be today or 20 years ago`;

const POSE_LIBRARY = {
  portrait: {
    camera: `• Focal length: 85mm f/1.8 portrait prime
• Aperture: f/2.8 (subject sharp, background soft)
• Focus: Eyes (critical sharpness), smooth falloff to ears
• Framing: Head + shoulders, rule of thirds
• Angle: 10-15° above eye level (editorial flattering)
• Distance: 1.2m (natural perspective)`,
    
    lighting: `PRIMARY: 45° camera-right, 30° elevated (modified Rembrandt)
FILL: Large white v-flat camera-left (2:1 ratio)
RIM: Hair light back-right, 45° (subtle separation)
BACKGROUND: Gradient from key side`,
    
    composition: `• Face: 60-70% frame occupancy
• Gaze: 2 o'clock or 10 o'clock (NOT direct)
• Ears: Both visible (earring context)
• Neck/décolletage: Clear (necklace context)
• Shoulders: Relaxed, slight angle for dimension
• Hair: Styled to reveal jewelry zones`,
    
    direction: `Expression: {EXPRESSION} - understated, editorial restraint
Neck: Gently extended, elegant posture
Jaw: Relaxed, natural position
Eyes: Soft focus, distant contemplation
NO commercial smile, NO forced emotion`
  },

  'hand-close': {
    camera: `• Focal length: 100mm f/2.8 macro
• Aperture: f/5.6 (hands + ring sharp)
• Focus: Jewelry contact point (knuckle/finger)
• Framing: Tight crop, hands fill 80% of frame
• Angle: 45° overhead, slight side angle
• Distance: 30cm (macro working distance)`,
    
    lighting: `PRIMARY: Large overhead softbox (90x60cm) - even, flat illumination
FILL: White acrylic base under hands (upward bounce)
ACCENT: Small gridded strobe to jewelry (controlled sparkle)
AMBIENT: Minimal, absorbed by black v-flats on sides`,
    
    composition: `• Hands: Natural elegance, relaxed positioning
• Fingers: Gentle curves, NOT stiff extension
• Nails: Clean, neutral, short (non-distracting)
• Knuckles: Natural compression, visible texture
• Jewelry: Centered, properly oriented to camera
• Background: Ultra-soft, 2-3 stops underexposed`,
    
    direction: `Hand gesture: Organic grace, zero tension
Positioning: Overlapping or single hand rest
Skin detail: Knuckle texture, finger-side pores visible
Jewelry contact: Realistic pressure/fit indication`
  },

  'neck-focus': {
    camera: `• Focal length: 85mm f/1.8
• Aperture: f/4 (neck sharp, face/chest soft)
• Focus: Collarbone/necklace drape point
• Framing: Chin to sternum, vertical orientation
• Angle: Straight-on or 10° upward tilt
• Distance: 1m`,
    
    lighting: `PRIMARY: Beauty dish directly in front, 20° elevated
FILL: Large clamshell reflector below (under-chin fill)
RIM: Minimal or none (maintains soft aesthetic)
BACKGROUND: Soft gradient, slightly darker than skin`,
    
    composition: `• Neck: Extended elegantly, clear muscle definition
• Collarbone: Prominent, casting delicate shadow
• Décolletage: Smooth, even tone, detailed texture
• Jawline: Visible but soft focus
• Face: Partial (chin/lower), background element
• Necklace: Centered on sternum line`,
    
    direction: `Head: Tilted slightly back (natural neck extension)
Chin: Elevated, graceful angle
Expression: Serene, eyes may be closed
Shoulders: Rolled back slightly, open chest
Breathing: Visible collar definition`
  },

  'ear-profile': {
    camera: `• Focal length: 100mm f/2.8
• Aperture: f/4 (ear sharp, hair soft)
• Focus: Ear cartilage/earring
• Framing: Ear to shoulder, side profile
• Angle: Perpendicular to profile plane
• Distance: 80cm`,
    
    lighting: `PRIMARY: 90° side light (profile/edge lighting)
FILL: Minimal reflector opposite (just to lift shadows)
RIM: Strong backlight to separate hair from background
BACKGROUND: Darker gradient for silhouette contrast`,
    
    composition: `• Profile: Clean contour line, defined jawline
• Ear: Fully exposed, separated from hair
• Earring: Natural hang or lobe position
• Hair: Pulled back/tucked, or styled away
• Jawline: Sharp definition
• Background: 30% darker than skin for separation`,
    
    direction: `Face: Perfect 90° profile or slight 3/4 turn
Ear: Complete exposure, clear earring visibility
Expression: Distant, calm, eyes closed or horizon gaze
Neck: Extended, elegant line
Hair: Styled away from ear completely`
  },

  'full-portrait': {
    camera: `• Focal length: 70mm f/2.8
• Aperture: f/5.6 (more depth coverage)
• Focus: Face/upper chest (split focus)
• Framing: Head to mid-torso, vertical
• Angle: Eye level or slightly elevated
• Distance: 1.8m`,
    
    lighting: `PRIMARY: Large octabox 45° camera-right
FILL: White bounce opposite (3:1 ratio)
RIM: Dual rim lights (hair + shoulder separation)
BACKGROUND: Graduated sweep, professional studio`,
    
    composition: `• Full jewelry display: Ears, neck, chest, hands
• Posture: Elegant, editorial stance
• Clothing: Simple neckline (jewelry focus)
• Hands: Visible, naturally positioned
• Expression: Confident, editorial presence
• Frame balance: 60% subject, 40% negative space`,
    
    direction: `Posture: Elongated spine, open shoulders
Expression: {EXPRESSION} with editorial confidence
Hands: Graceful positioning near body
Gaze: Slightly off-camera, contemplative
Overall: Quiet power, understated luxury`
  },

  'hand-elegant': {
    camera: `• Focal length: 100mm f/2.8 macro
• Aperture: f/4 (wrist + hand sharp)
• Focus: Wrist area for bracelet display
• Framing: Hand and wrist centered
• Angle: 30° from horizontal
• Distance: 40cm`,
    
    lighting: `PRIMARY: Large diffused panel overhead
FILL: White reflector from below
ACCENT: Spot for bracelet catchlights
AMBIENT: Minimal, controlled`,
    
    composition: `• Wrist: Elegantly turned, bracelet visible
• Hand: Graceful gesture, relaxed fingers
• Fingers: Natural curves, feminine elegance
• Background: Soft, out of focus
• Jewelry: Clear, centered, hero element`,
    
    direction: `Hand gesture: Flowing, organic movement
Wrist: Slightly rotated for bracelet display
Fingers: Soft, not rigid
Skin: Natural texture, visible detail`
  }
};

const NEGATIVE_CONSTRAINTS = `STRICT AVOIDANCE [AI Artifact Elimination]:

DIGITAL ARTIFACTS (CRITICAL):
× Smoothed/plastic skin (beauty filter appearance)
× Airbrush effect (Instagram/FaceTune style)
× Over-sharpening halos around edges
× 3D render look (CGI, game-engine quality)
× Digital painting/illustration aesthetic
× Fake bokeh with perfect geometric circles
× HDR over-processing (halos, local contrast abuse)
× Unrealistic color saturation
× Porcelain/doll-like skin uniformity
× Luminescent glow effects

ANATOMICAL ERRORS (ZERO TOLERANCE):
× Extra/missing fingers (must be exactly 5 per hand)
× Merged or fused digits
× Distorted hand proportions
× Incorrect ear anatomy or placement
× Unnatural asymmetry (beyond biological normal)
× Neck length/thickness distortion
× Shoulder/clavicle misalignment
× Impossible joint angles

JEWELRY ISSUES:
× Floating or disconnected pieces
× Duplicate items (e.g., two earrings on one ear)
× Perfect mirror symmetry (unnatural)
× Scale errors (jewelry too large/small)
× Blurred jewelry at focus point
× Excessive sparkle/rainbow effects
× Incorrect material rendering

LIGHTING FAILURES:
× Blown highlights (no detail in whites)
× Blocked shadows (pure black, no detail)
× Unnatural skin glow/luminescence
× Multiple conflicting shadows
× Visible artificial light sources in reflections
× Warm yellow contamination (unless specified)

POST-PROCESSING RED FLAGS:
× Over-saturation (especially skin tones)
× Excessive contrast/posterization
× Color banding in gradients
× Digital noise artifacts
× Sharpening halos (edge ringing)
× Compression artifacts/pixelation
× Watermarks, text, logos`;

// SSS profiles based on skin tone
const SSS_PROFILES: Record<string, string> = {
  'very-light': `Deep subsurface scattering:
  - Pink/red undertones highly visible
  - Thin skin translucency on ears, nose tip
  - Strong light penetration
  - Cool-pink glow in shadows`,
  
  'light': `Moderate-high subsurface scattering:
  - Warm/neutral undertone visibility
  - Noticeable translucency on thin skin areas
  - Balanced light penetration
  - Warm glow in indirect light`,
  
  'medium': `Moderate subsurface scattering:
  - Golden undertones visible but controlled
  - Subtle translucency on ears, fingers
  - Medium light penetration
  - Rich warm depth`,
  
  'medium-dark': `Reduced subsurface scattering:
  - Warm undertones present but deeper
  - Minimal translucency
  - Less light penetration
  - Dense, rich color depth`,
  
  'dark': `Minimal subsurface scattering:
  - Cool undertones, deep saturation
  - Very minimal translucency
  - Strong light absorption
  - Velvety, dense appearance`,
  
  'very-deep': `Almost no subsurface scattering:
  - Intense melanin absorption
  - No translucency
  - Maximum light absorption
  - Matte, ultra-rich density`
};

// Prompt builder function
function buildAdvancedPrompt(params: {
  // Core identity
  skinTone: string;
  skinUndertone: string;
  ethnicity: string;
  hairColor: string;
  hairTexture: string;
  gender: string;
  ageRange: string;
  
  // Enhanced features
  faceShape?: string;
  eyeColor?: string;
  expression?: string;
  hairStyle?: string;
  
  // Generation type
  isPoseGeneration?: boolean;
  poseType?: keyof typeof POSE_LIBRARY;
  poseDescription?: string;
}): string {
  
  const identityBlock = `
• Gender presentation: ${params.gender}
• Ethnic background: ${params.ethnicity}
• Age range: ${params.ageRange} years
• Face structure: ${params.faceShape || 'balanced, naturally proportioned'}
• Eye color: ${params.eyeColor || 'natural to ethnicity'}
• Skin tone: ${params.skinTone} (melanin classification)
• Skin undertone: ${params.skinUndertone}
• Hair color: ${params.hairColor}
• Hair texture: ${params.hairTexture}
• Hair styling: ${params.hairStyle || 'elegantly groomed'}
• Expression baseline: ${params.expression || 'serene confidence'}`;

  const poseConfig = params.poseType ? POSE_LIBRARY[params.poseType] : POSE_LIBRARY.portrait;
  
  const sssProfile = SSS_PROFILES[params.skinTone] || SSS_PROFILES['medium'];
  const sssIntensity = ['very-light', 'light'].includes(params.skinTone) ? 'High' : 
                       ['medium', 'medium-dark'].includes(params.skinTone) ? 'Moderate' : 'Minimal';

  const prompt = `
${IDENTITY_CORE.replace('{IDENTITY_BLOCK}', identityBlock)}

${CAMERA_SYSTEM.replace('{CAMERA_BLOCK}', poseConfig.camera)}

${LIGHTING_ARCHITECTURE
  .replace('{LIGHTING_BLOCK}', poseConfig.lighting)
  .replace('{SSS_INTENSITY}', sssIntensity)}

${SKIN_BIOLOGY
  .replace('{SKIN_TONE}', params.skinTone)
  .replace('{SKIN_UNDERTONE}', params.skinUndertone)
  .replace('{SSS_PROFILE}', sssProfile)}

${EDITORIAL_AESTHETIC}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENERATION DIRECTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${params.isPoseGeneration ? `
⚠️ IDENTITY CONSISTENCY MODE ACTIVE ⚠️

This is a SUBSEQUENT generation of an EXISTING person.
The biological identity established in the first generation is IMMUTABLE.

REQUIREMENTS:
• Face must be INSTANTLY recognizable as the same person
• Bone structure EXACTLY matches previous
• Skin tone and texture PRECISELY consistent
• Proportions PERFECTLY aligned
• ONLY pose, angle, and framing may change

If the person is not immediately recognizable → GENERATION FAILED
` : `
🆕 IDENTITY FOUNDATION MODE ACTIVE 🆕

This is the FIRST generation - establishing permanent identity.
This image will serve as the reference for ALL future poses.

REQUIREMENTS:
• Create a complete, detailed biological person
• Establish clear, memorable facial features
• Lock in skin characteristics and proportions
• This becomes the immutable identity template
`}

POSE SPECIFICATION: ${params.poseType ? params.poseType.toUpperCase() : 'PORTRAIT'}

${poseConfig.composition}

${poseConfig.direction.replace('{EXPRESSION}', params.expression || 'serene confidence')}

${params.poseDescription ? `\n📋 ADDITIONAL DIRECTION:\n${params.poseDescription}\n` : ''}

${NEGATIVE_CONSTRAINTS}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT SPECIFICATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Resolution: Minimum 4K (3840×2160 or higher)
• Quality: Publication-ready, magazine cover standard
• Realism: Indistinguishable from professional photography
• Consistency: ${params.isPoseGeneration ? 'Perfect identity match' : 'Establish permanent identity'}
• Aesthetic: Quiet luxury editorial, NOT commercial catalog
• File quality: RAW-equivalent tonal range, NO compression artifacts

FINAL VALIDATION:
✓ Does this look CAPTURED by a photographer? (NOT generated)
✓ Could this be in Vogue or a luxury brand campaign?
✓ Is the skin ALIVE and textured? (NOT smoothed)
✓ Are jewelry areas clearly visible and sharp?
✓ Is the identity ${params.isPoseGeneration ? 'perfectly consistent' : 'clearly established'}?

This must be PHOTOGRAPHIC PERFECTION with EDITORIAL RESTRAINT.
`;

  return prompt;
}

// ===== MAIN HANDLER =====

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log('Authenticated user:', userId);

    // Parse request
    const requestBody = await req.json();
    const { 
      name,
      skinTone, 
      skinUndertone, 
      ethnicity, 
      hairColor, 
      hairTexture, 
      gender, 
      ageRange,
      faceShape,
      eyeColor,
      expression,
      hairStyle,
      modelData,
      poseType,
      poseDescription,
    } = requestBody;

    const isPoseGeneration = !!modelData && !!poseType;
    
    console.log('Request type:', isPoseGeneration ? 'Pose generation' : 'New model creation');

    if (!isPoseGeneration) {
      if (!name || !skinTone || !skinUndertone || !ethnicity || !hairColor || !hairTexture || !gender || !ageRange) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields for new model' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Build prompt using advanced system
    const modelPrompt = buildAdvancedPrompt({
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
      isPoseGeneration,
      poseType: poseType as keyof typeof POSE_LIBRARY,
      poseDescription: poseDescription || undefined,
    });

    console.log('Generating with advanced prompt system...');
    console.log('Prompt length:', modelPrompt.length, 'characters');

    // Generate image with Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
        messages: [
          {
            role: 'user',
            content: modelPrompt,
          },
        ],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI generation error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const imageDataUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined;

    if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
      throw new Error('No valid image generated');
    }

    // Process and upload image
    const commaIndex = imageDataUrl.indexOf(',');
    if (commaIndex === -1) throw new Error('Invalid data URL format');
    const base64Image = imageDataUrl.slice(commaIndex + 1);
    const imageBuffer = Uint8Array.from(atob(base64Image), (c) => c.charCodeAt(0));
    const filePath = `${userId}/models/${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from('jewelry-images')
      .upload(filePath, imageBuffer, { contentType: 'image/png' });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Failed to upload image');
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('jewelry-images')
      .createSignedUrl(filePath, 7 * 24 * 60 * 60);
    
    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Signed URL error:', signedUrlError);
      throw new Error('Failed to generate image URL');
    }

    const imageUrl = signedUrlData.signedUrl;

    if (isPoseGeneration) {
      console.log('Pose generated successfully');
      return new Response(
        JSON.stringify({ success: true, imageUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save new model
    const { data: modelRecord, error: insertError } = await supabase
      .from('user_models')
      .insert({
        user_id: userId,
        name,
        skin_tone: skinTone,
        skin_undertone: skinUndertone || 'neutral',
        ethnicity,
        hair_color: hairColor,
        hair_texture: hairTexture,
        gender,
        age_range: ageRange,
        face_shape: faceShape,
        eye_color: eyeColor,
        expression,
        hair_style: hairStyle,
        preview_image_url: imageUrl,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database error:', insertError);
      throw new Error('Failed to save model');
    }

    console.log('Model created successfully:', modelRecord.id);

    return new Response(
      JSON.stringify({ success: true, model: modelRecord }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unexpected error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
