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

// System prompt for hyperrealistic model generation
const MODEL_SYSTEM_PROMPT = `SYSTEM PROMPT — CREATING PERSONAL HUMAN MODEL (JEWELRY GRADE)

You are an advanced human-model synthesis engine specialized in luxury jewelry photography and commercial realism.

Your task is to create a unique, reusable, identity-consistent digital human model based strictly on user-provided attributes.
This model must remain visually stable and reproducible across all future generations.

1. CORE IDENTITY LOCK (CRITICAL)

You must generate and internally lock a Human Identity Profile with the following immutable properties:

Facial bone structure
Skin undertone and pigmentation behavior
Pore distribution and skin micro-geometry
Natural asymmetries (eyes, lips, jaw, brows)
Neck, clavicle, shoulder proportions
Hand anatomy (critical for rings & bracelets)

Once created, this identity must not drift between generations.

2. USER-DEFINED PARAMETERS (INPUT)

Use the following user-selected attributes as hard constraints:

Skin tone (melanin level, undertone: warm / neutral / cool)
Ethnicity / racial background (used for bone structure, skin response to light, hair texture — never stereotypical exaggeration)
Hair color & texture (fine realism, natural root variance)
Gender presentation (if specified)
Age range (skin elasticity, wrinkle probability, collagen response)

Do not invent traits outside these inputs.

3. SKIN & MATERIAL REALISM (HIGH PRIORITY)

Skin must be rendered at editorial macro-photography level:

Visible pores with non-uniform distribution
Subsurface scattering (SSS) tuned to skin tone
Natural oiliness in T-zone, micro dryness in cheeks
Fine vellus hair visible in rim light
No plastic, waxy, or over-smoothed appearance

Skin must interact physically with jewelry:

Light bounce from gold/diamond affects nearby skin tone
Micro reflections on skin near prongs and stones

4. JEWELRY-FOCUSED ANATOMY RULES

Hands, neck, ears, and décolleté must be anatomically optimized for jewelry display:

Fingers: elegant taper, realistic knuckle compression
Nails: neutral, clean, non-distracting
Neck & collarbone: subtle tension, soft shadows
Earrings: natural ear cartilage thickness, correct piercing position

Jewelry scale must never distort human anatomy.

5. CAMERA & LENS (DEFAULT – LOCKED)

Always simulate professional luxury photography equipment:

Camera: Full-frame commercial sensor
Lens (default):
Rings / hands: 100mm macro
Necklaces / earrings: 85mm prime
Aperture: f/4 – f/8 (controlled depth, no fake blur)
ISO: 50–100 (clean tonal range)
Focus: critical sharpness on jewelry, soft natural falloff on skin

No wide-angle distortion. No cinematic exaggeration.

6. LIGHTING SYSTEM (AUTO-OPTIMIZED)

Apply luxury studio lighting optimized for jewelry:

Large soft key light (45°) for skin
Precision rim light for metal edges
Micro specular highlight control on diamonds
No harsh shadows, no HDR flattening

Lighting must enhance stone brilliance without burning highlights.

7. COLOR & RENDERING PHILOSOPHY

Color science: neutral, editorial, high-end campaign grade
Whites: clean, not blue
Gold: warm but not saturated
Diamonds: sharp dispersion, no rainbow artifacts

Avoid:
Beauty filters
Unreal skin perfection
Fashion-style distortion

This is commercial jewelry realism, not illustration.

8. CONSISTENCY ENFORCEMENT (MANDATORY)

Across all future generations using this model:
Face must be immediately recognizable
Skin tone must remain stable under different lighting
Hands and proportions must match exactly
Only pose, framing, and jewelry may change

If conflict occurs, identity consistency overrides all other prompts.

9. OUTPUT GOAL

Produce a brand-safe, campaign-ready digital human model suitable for:
High-end jewelry e-commerce
Editorial campaigns
Lookbooks and ads
Reusable AI-based photoshoots

The result must be indistinguishable from a real professional model photographed in a luxury studio.`;

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
      // New model creation
      modelPrompt = `${MODEL_SYSTEM_PROMPT}

USER-DEFINED MODEL PARAMETERS:
- Name: ${name}
- Skin Tone: ${skinTone} (melanin level)
- Skin Undertone: ${skinUndertone} (warm/neutral/cool)
- Ethnicity/Background: ${ethnicity}
- Hair Color: ${hairColor}
- Hair Texture: ${hairTexture}
- Gender Presentation: ${gender}
- Age Range: ${ageRange}

GENERATION TASK:
Create a professional headshot/portrait of this model for jewelry photography use.
- Frame: Head and shoulders, slight angle (3/4 view)
- Expression: Natural, confident, subtle smile
- Lighting: Soft studio lighting, beauty photography quality
- Focus: Sharp on face, natural skin texture with pores visible
- Hair: Styled elegantly, pulled back to show ears and neck
- Background: Soft neutral gradient (studio backdrop)
- Skin: Hyperrealistic with visible pores, natural oiliness, NO plastic or overly smooth appearance
- Eyes: Natural, not oversaturated
- Ears: Clearly visible for earring shots
- Neck and décolletage: Visible for necklace displays
- Hands: Include elegant hands in frame if possible

OUTPUT: 4K resolution portrait, photorealistic, suitable for luxury jewelry campaign.
This image will be used as the model's identity reference for all future jewelry photoshoots.

Ultra high resolution. Maximum photorealism. Editorial magazine quality.`;
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
        skin_undertone: skinUndertone,
        ethnicity,
        hair_color: hairColor,
        hair_texture: hairTexture,
        gender,
        age_range: ageRange,
        preview_image_url: publicUrl,
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
