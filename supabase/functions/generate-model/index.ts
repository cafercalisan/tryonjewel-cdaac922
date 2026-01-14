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

// Editorial luxury photography style guide
const EDITORIAL_STYLE_PROMPT = `HIGH-END EDITORIAL JEWELRY PHOTOGRAPHY STYLE:

Overall color palette: cool-neutral, low saturation, soft contrast.
Mood: Silent confidence, intellectual luxury, fashion-editorial restraint.
Feels like a high-fashion lookbook or art-driven luxury campaign, NOT an e-commerce image.

LIGHTING:
- Natural overcast daylight, diffused and even
- No dramatic highlights, no harsh shadows, no added rim lights
- Jewelry reflections are controlled, soft, physically accurate, never sparkling excessively

BACKGROUND:
- Muted and calm: stone, water surface, matte fabric, soft architectural elements or minimal natural scenery
- Background tones stay slightly darker than the jewelry to create separation without contrast exaggeration

JEWELRY APPEARANCE:
- Confident, understated, and timeless
- No visual noise, no glamour lighting, no commercial shine

METAL TONES (REALISTIC):
- White gold / platinum: cool, matte-leaning reflections
- Yellow gold: desaturated, soft warmth
- Diamonds: clarity over sparkle, depth over flash

SKIN (when model is used):
- Natural texture visible
- No smoothing, no beauty blur
- Calm expression, distant gaze

CAMERA:
- Medium close-up or macro with restraint
- Shallow but natural depth of field
- Editorial framing, no aggressive angles

STRICT AVOIDANCE (NEGATIVE PROMPT):
- High saturation
- Glamour lighting
- Commercial sparkle
- Over-sharpening
- Beauty retouching
- HDR look
- Warm yellow lighting
- Excessive contrast
- Cinematic effects
- Glow, bloom, or stylized grading

Photorealism prioritized.`;

// Comprehensive hyper-realistic jewelry photography system prompt
const MODEL_SYSTEM_PROMPT = `You are a commercial-grade visual rendering system specialized in hyper-realistic jewelry photography.

Your primary objective is to simulate real-world optical physics, biological skin behavior, and professional studio photography practices.

Avoid any form of digital beautification, artificial smoothness, or stylized rendering.

Every output must be indistinguishable from a real editorial or advertising photo captured with a professional camera.

${EDITORIAL_STYLE_PROMPT}

1. CORE IDENTITY LOCK (CRITICAL)

You must generate and internally lock a Human Identity Profile with the following immutable properties:

- Facial bone structure
- Skin undertone and pigmentation behavior
- Pore distribution and skin micro-geometry
- Natural asymmetries (eyes, lips, jaw, brows)
- Neck, clavicle, shoulder proportions
- Hand anatomy (critical for rings & bracelets)

Once created, this identity must not drift between generations.

2. USER-DEFINED PARAMETERS (INPUT)

Use the following user-selected attributes as hard constraints:

- Skin tone (melanin level, undertone: warm / neutral / cool)
- Ethnicity / racial background (used for bone structure, skin response to light, hair texture — never stereotypical exaggeration)
- Hair color & texture (fine realism, natural root variance)
- Gender presentation (if specified)
- Age range (skin elasticity, wrinkle probability, collagen response)

Do not invent traits outside these inputs.

3. SKIN & MATERIAL REALISM (HIGH PRIORITY)

Skin must be rendered at editorial macro-photography level:

- Visible pores with non-uniform distribution
- Subsurface scattering (SSS) tuned to skin tone
- Natural oiliness in T-zone, micro dryness in cheeks
- Fine vellus hair (peach fuzz) visible in rim light
- No plastic, waxy, or over-smoothed appearance
- Natural imperfections: freckles, micro color variations, slight redness in thin-skin areas
- Skin must appear unretouched and free of beauty filters
- Skin must appear biologically alive, never synthetic

Skin must interact physically with jewelry:

- Light bounce from gold/diamond affects nearby skin tone
- Micro reflections on skin near prongs and stones

4. JEWELRY-FOCUSED ANATOMY RULES

Hands, neck, ears, and décolleté must be anatomically optimized for jewelry display:

- Fingers: elegant taper, realistic knuckle compression
- Nails: neutral, clean, non-distracting
- Neck & collarbone: subtle tension, soft shadows
- Earrings: natural ear cartilage thickness, correct piercing position

Jewelry scale must never distort human anatomy.

5. CAMERA & LENS (DEFAULT – LOCKED)

Always simulate professional luxury photography equipment:

- Camera: Full-frame commercial sensor
- Lens (default):
  - Rings / hands: 100mm macro
  - Necklaces / earrings: 85mm prime
- Aperture: f/4 – f/8 (controlled depth, no fake blur)
- ISO: 50–100 (clean tonal range)
- Focus: critical sharpness on jewelry, soft natural falloff on skin

No wide-angle distortion. No cinematic exaggeration.

6. LIGHTING SYSTEM (AUTO-OPTIMIZED)

Apply natural overcast daylight for editorial feel:

- Diffused, even lighting
- No dramatic highlights or harsh shadows
- Controlled, soft reflections on jewelry
- No glamour lighting or commercial sparkle
- Light temperature: 3000K warm luxury tone, preserving gemstone color accuracy

Professional multi-light setup:
- Key light to define form and gemstone brilliance
- Butterfly lighting configuration when facial or upper-body elements are present
- Rim light from behind to create clear subject-background separation and highlight skin micro-details

Light falloff must be natural, with no flat illumination.
Avoid overexposure on skin highlights and gemstone facets.

7. COLOR & RENDERING PHILOSOPHY

- Color science: neutral, editorial, high-end campaign grade
- Cool-neutral palette, low saturation, soft contrast
- Whites: clean, not blue
- Gold: warm but desaturated
- Diamonds: sharp dispersion, no rainbow artifacts

Avoid:
- Beauty filters
- Unreal skin perfection
- Fashion-style distortion
- HDR look or over-processing

This is editorial jewelry realism, not commercial illustration.

8. CONSISTENCY ENFORCEMENT (MANDATORY)

Across all future generations using this model:
- Face must be immediately recognizable
- Skin tone must remain stable under different lighting
- Hands and proportions must match exactly
- Only pose, framing, and jewelry may change

If conflict occurs, identity consistency overrides all other prompts.

9. OUTPUT GOAL

Produce a brand-safe, campaign-ready digital human model suitable for:
- High-end jewelry editorial campaigns
- Fashion lookbooks and art-driven luxury campaigns
- Quiet luxury, minimalist fashion tone
- Reusable AI-based photoshoots

The result must be indistinguishable from a real professional model photographed in a quiet luxury editorial setting.

The final image must look like a high-budget luxury jewelry campaign photograph.
It must feel CAPTURED, not generated.
No stylization, no fantasy, no illustration.
Pure photographic realism with editorial-level aesthetics.

NEGATIVE CONSTRAINTS (EXCLUDE):
- plastic skin, waxy texture, smooth face
- airbrushed, beauty filter, cartoonish
- 3D render, digital art, CGI look
- extra fingers, deformed anatomy, incorrect proportions
- blurred details, watermark, low quality
- two earrings on one ear, duplicate jewelry
- mirrored earrings, stacked earrings
- deformed ear, incorrect anatomy`;


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
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

    // Parse request body
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
      // New enhanced model parameters
      faceShape,
      eyeColor,
      expression,
      hairStyle,
      // For pose generation (existing model)
      modelData,
      poseType,
      poseDescription,
    } = requestBody;

    // Check if this is a pose generation request
    const isPoseGeneration = !!modelData && !!poseType;
    
    console.log('Request type:', isPoseGeneration ? 'Pose generation' : 'New model creation');
    
    if (!isPoseGeneration) {
      console.log('Model generation request:', { name, skinTone, skinUndertone, ethnicity, hairColor, hairTexture, gender, ageRange });

      // Validate required fields for new model
      if (!name || !skinTone || !skinUndertone || !ethnicity || !hairColor || !hairTexture || !gender || !ageRange) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      console.log('Pose generation request:', { poseType, poseDescription });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Build the appropriate prompt based on request type
    let modelPrompt: string;
    
    if (isPoseGeneration) {
      // Pose generation for existing model
      const posePrompts: Record<string, string> = {
        'portrait': `Create a professional portrait shot:
- Frame: Head and shoulders, elegant 3/4 view angle
- Focus: Face and upper neck area, perfect for necklace display
- Expression: Natural, confident, subtle elegance
- Hair: Elegantly styled, showing ears
- Neck and décolletage: Clearly visible for jewelry display`,
        'hand-close': `Create a close-up hand shot:
- Frame: Elegant hands in focus, fingers gracefully positioned
- Focus: Fingers and knuckles, perfect for ring display
- Position: Hands gently overlapping or one hand resting elegantly
- Nails: Clean, natural manicure
- Background: Soft neutral, shallow depth of field`,
        'hand-elegant': `Create an elegant hand and wrist shot:
- Frame: Hands and wrists in elegant pose
- Focus: Wrist area, perfect for bracelet display
- Position: Graceful hand gesture, relaxed but refined
- Nails: Clean, neutral
- Background: Luxury studio setting`,
        'ear-profile': `Create a profile/side view shot:
- Frame: Side profile of face, showing ear clearly
- Focus: Ear and jawline, perfect for earring display
- Hair: Pulled back or styled to fully expose ear
- Expression: Serene, looking slightly away
- Background: Soft gradient studio backdrop`,
        'full-portrait': `Create a full upper body portrait:
- Frame: Head to waist, elegant posture
- Focus: Full jewelry display area (ears, neck, chest, hands)
- Expression: Confident, editorial pose
- Clothing: Simple, elegant neckline
- Background: Professional studio setting`,
        'neck-focus': `Create a neck and décolletage focused shot:
- Frame: From chin to chest, elegant angle
- Focus: Neck, collarbone, and upper chest, perfect for necklaces
- Expression: Chin slightly raised, elegant neck extension
- Skin: Perfect detail, natural texture
- Background: Soft, luxurious studio lighting`,
      };

      const poseInstructions = posePrompts[poseType] || posePrompts['portrait'];

      modelPrompt = `${MODEL_SYSTEM_PROMPT}

EXISTING MODEL PARAMETERS (MUST MATCH EXACTLY):
- Skin Tone: ${modelData.skinTone} (melanin level)
- Skin Undertone: ${modelData.skinUndertone} (warm/neutral/cool)
- Ethnicity/Background: ${modelData.ethnicity}
- Hair Color: ${modelData.hairColor}
- Hair Texture: ${modelData.hairTexture}
- Gender Presentation: ${modelData.gender}
- Age Range: ${modelData.ageRange}

CRITICAL: This is the SAME person as before. Face, bone structure, skin characteristics MUST be identical.
Only the pose and framing changes.

POSE GENERATION TASK:
${poseInstructions}

ADDITIONAL REQUIREMENTS:
- ${poseDescription}
- Lighting: Professional studio lighting optimized for jewelry photography
- Skin: Hyperrealistic with visible pores, natural texture, NO plastic appearance
- Resolution: 4K ultra-high quality
- Style: Editorial, luxury campaign grade

Ultra high resolution. Maximum photorealism. Consistent identity. Editorial magazine quality.`;
    } else {
      // New model creation with enhanced parameters
      
      // Build face shape description
      const faceShapeDescriptions: Record<string, string> = {
        'oval': 'oval-shaped, balanced proportions, soft jawline',
        'angular': 'angular, high cheekbones, defined jawline, striking bone structure',
        'heart': 'heart-shaped, wider forehead, delicate chin',
        'square': 'square-shaped, strong jaw, defined angles',
        'round': 'round, soft features, gentle curves',
        'diamond': 'diamond-shaped, prominent cheekbones, narrow forehead and chin',
      };
      
      // Build eye color description
      const eyeColorDescriptions: Record<string, string> = {
        'dark-brown': 'deep dark brown, almost black, intense depth',
        'brown': 'warm brown, rich amber undertones',
        'hazel': 'hazel with golden-green flecks, multi-tonal',
        'green': 'striking green, emerald depth',
        'blue': 'clear blue, cool and captivating',
        'gray': 'sophisticated gray, steel-like intensity',
      };
      
      // Build expression description  
      const expressionDescriptions: Record<string, string> = {
        'serene-confident': 'serene yet confident, calm inner strength, subtle knowing gaze',
        'mysterious': 'mysterious and enigmatic, distant gaze with depth, intriguing',
        'warm-approachable': 'warm and approachable, gentle softness in eyes, inviting',
        'intense-focused': 'intense and focused, powerful direct gaze, commanding presence',
        'elegant-distant': 'elegantly distant, high-fashion aloofness, editorial detachment',
      };
      
      // Build hair style description
      const hairStyleDescriptions: Record<string, string> = {
        'slicked-back': 'slicked back, exposing ears and forehead, sleek and refined',
        'loose-elegant': 'loose but elegantly styled, soft movement, sophisticated',
        'updo': 'elegant updo, exposing neck and ears fully, refined',
        'side-part': 'side-parted, classic styling, one ear visible',
        'natural-waves': 'natural waves, effortless elegance, soft texture',
        'straight-sleek': 'straight and sleek, polished, glossy finish',
      };
      
      const faceDesc = faceShapeDescriptions[faceShape] || 'balanced, elegant features';
      const eyeDesc = eyeColorDescriptions[eyeColor] || 'natural eye color';
      const expressionDesc = expressionDescriptions[expression] || 'confident and natural';
      const hairStyleDesc = hairStyleDescriptions[hairStyle] || 'elegantly styled';
      
      modelPrompt = `${MODEL_SYSTEM_PROMPT}

USER-DEFINED MODEL PARAMETERS:
- Name: ${name}
- Gender Presentation: ${gender}
- Ethnicity/Background: ${ethnicity}
- Age Range: ${ageRange}

FACE & SKIN:
- Skin Tone: ${skinTone} melanin level
- Skin Undertone: ${skinUndertone || 'neutral'} (warm/neutral/cool balance)
- Face Structure: ${faceDesc}
- Eyes: ${eyeDesc}
- Expression: ${expressionDesc}

HAIR:
- Hair Color: ${hairColor}
- Hair Style: ${hairStyleDesc}

GENERATION TASK:
Create a high-end editorial portrait of this model for luxury jewelry campaign.

CRITICAL REQUIREMENTS:
- Frame: Head and shoulders, elegant 3/4 view angle
- Expression: ${expressionDesc} - this is NOT a commercial smile, it's editorial restraint
- Face: ${faceDesc} - bone structure clearly defined with soft lighting
- Eyes: ${eyeDesc} - natural catchlights, NO excessive enhancement
- Skin: Hyperrealistic with visible pores, natural micro-texture, ${skinTone} tone with ${skinUndertone || 'neutral'} undertone
  - Visible pores and natural skin imperfections
  - Subsurface scattering appropriate for skin tone
  - NO plastic, waxy, or beauty-filtered appearance
  - Natural oiliness in T-zone, slight matte elsewhere
- Hair: ${hairStyleDesc}, ${hairColor} color, natural texture visible
  - Hair MUST be styled to show ears clearly for earring display
  - Neck and décolletage visible for necklace display
- Background: Soft neutral gradient, slightly darker than subject (studio backdrop)
- Lighting: Natural overcast simulation, soft and diffused
  - No dramatic highlights or harsh shadows
  - Controlled, even illumination
  - Editorial, not glamour

STRICT AVOIDANCE:
- NO beauty retouching or skin smoothing
- NO glamour lighting or commercial sparkle  
- NO high saturation or HDR look
- NO warm yellow lighting
- NO excessive contrast
- NO cinematic effects, glow, or bloom

OUTPUT: 4K resolution editorial portrait, photorealistic, quiet luxury aesthetic.
This image will be used as the model's identity reference for all future jewelry photoshoots.
The result must look like a real professional model photographed for a high-fashion lookbook.

Ultra high resolution. Maximum photorealism. Editorial magazine quality. Quiet luxury aesthetic.`;
    }

    console.log('Generating model with Lovable AI...');

    // Generate model image using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
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
      console.error('Lovable AI error:', response.status, errorText);
      
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
      throw new Error('No image generated from AI');
    }

    // Extract base64 from data URL
    const commaIndex = imageDataUrl.indexOf(',');
    if (commaIndex === -1) throw new Error('Invalid data URL');
    const base64Image = imageDataUrl.slice(commaIndex + 1);

    // Upload to storage
    const imageBuffer = Uint8Array.from(atob(base64Image), (c) => c.charCodeAt(0));
    const filePath = `${userId}/models/${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from('jewelry-images')
      .upload(filePath, imageBuffer, { contentType: 'image/png' });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Failed to upload model image');
    }

    const { data: { publicUrl } } = supabase.storage
      .from('jewelry-images')
      .getPublicUrl(filePath);

    console.log('Image uploaded:', publicUrl);

    if (isPoseGeneration) {
      // For pose generation, just return the image URL
      console.log('Pose generated successfully');
      return new Response(
        JSON.stringify({ success: true, imageUrl: publicUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save new model to database
    const { data: modelRecord, error: insertError } = await supabase
      .from('user_models')
      .insert({
        user_id: userId,
        name,
        skin_tone: skinTone,
        skin_undertone: skinUndertone || 'neutral',
        ethnicity,
        hair_color: hairColor,
        hair_texture: hairTexture || 'natural',
        gender,
        age_range: ageRange,
        preview_image_url: publicUrl,
        // New enhanced fields
        face_shape: faceShape,
        eye_color: eyeColor,
        expression,
        hair_style: hairStyle,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error('Failed to save model');
    }

    console.log('Model created successfully:', modelRecord.id);

    return new Response(
      JSON.stringify({ success: true, model: modelRecord }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
