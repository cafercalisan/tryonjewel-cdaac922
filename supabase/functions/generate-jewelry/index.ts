import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_ANALYSIS_API_KEY = Deno.env.get('GOOGLE_ANALYSIS_API_KEY');
const GOOGLE_IMAGE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ============ FIXED MODELS - DO NOT CHANGE ============
const ANALYSIS_MODEL = 'models/gemini-2.5-flash';
const IMAGE_GEN_MODEL = 'gemini-3-pro-image-preview';

// Max image size in bytes (1.5MB to avoid memory issues)
const MAX_IMAGE_SIZE = 1.5 * 1024 * 1024;

// Helper: Convert ArrayBuffer to base64 in chunks
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

async function callGeminiImageGeneration({
  base64Images,
  prompt,
}: {
  base64Images: string[];
  prompt: string;
}) {
  const url = `https://generativelanguage.googleapis.com/v1alpha/models/${IMAGE_GEN_MODEL}:generateContent?key=${GOOGLE_IMAGE_API_KEY}`;
  
  // Build parts array with prompt first, then all images
  const parts: any[] = [{ text: prompt }];
  for (const base64Image of base64Images) {
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64Image } });
  }
  
  return await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        temperature: 0.4,
      },
    }),
  });
}

async function callLovableImageGeneration({
  base64Images,
  prompt,
}: {
  base64Images: string[];
  prompt: string;
}) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

  // Build content array with text first, then all images
  const content: any[] = [{ type: 'text', text: prompt }];
  for (const base64Image of base64Images) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${base64Image}` }
    });
  }

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-pro-image-preview',
      messages: [{ role: 'user', content }],
      modalities: ['image', 'text'],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    const err = new Error(`Lovable AI gateway error (${resp.status}): ${t}`);
    (err as any).status = resp.status;
    throw err;
  }

  const data = await resp.json();
  const url = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined;
  if (!url || !url.startsWith('data:image/')) {
    throw new Error('Lovable AI gateway did not return an image');
  }

  const commaIndex = url.indexOf(',');
  if (commaIndex === -1) throw new Error('Invalid data URL from Lovable AI gateway');

  return url.slice(commaIndex + 1);
}

// Generate single image and return signed URL (since bucket is private)
// Now accepts multiple base64 images for better consistency
async function generateSingleImage(base64Images: string[], prompt: string, userId: string, imageRecordId: string, index: number, supabase: any): Promise<string | null> {
  try {
    if (!GOOGLE_IMAGE_API_KEY) {
      console.error('Missing GOOGLE_API_KEY');
      return null;
    }

    const genResponse = await callGeminiImageGeneration({ base64Images, prompt });

    if (!genResponse.ok) {
      const errText = await genResponse.text();
      console.error(`Generation ${index} API error (${genResponse.status}):`, errText);

      // Fallback to Lovable AI
      if (errText.includes('Image generation is not available') || errText.includes('FAILED_PRECONDITION')) {
        try {
          console.log('Falling back to Lovable AI...');
          const lovableBase64 = await callLovableImageGeneration({ base64Images, prompt });
          const imageBuffer = Uint8Array.from(atob(lovableBase64), (c) => c.charCodeAt(0));
          const filePath = `${userId}/generated/${imageRecordId}-${index}.png`;

          const { error: uploadError } = await supabase.storage
            .from('jewelry-images')
            .upload(filePath, imageBuffer, { contentType: 'image/png' });

          if (!uploadError) {
            // Use signed URL since bucket is private (7 days expiry for long-term access)
            const { data: signedUrlData, error: signedUrlError } = await supabase.storage
              .from('jewelry-images')
              .createSignedUrl(filePath, 7 * 24 * 60 * 60); // 7 days
            
            if (!signedUrlError && signedUrlData?.signedUrl) {
              return signedUrlData.signedUrl;
            }
          }
        } catch (fallbackErr) {
          console.error('Lovable AI fallback failed:', fallbackErr);
        }
      }
      return null;
    }

    const genData = await genResponse.json();
    const parts = genData.candidates?.[0]?.content?.parts || [];
    let generatedImage: string | null = null;

    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        generatedImage = part.inlineData.data;
        break;
      }
    }

    if (!generatedImage) {
      console.error('No image in generation response');
      return null;
    }

    const imageBuffer = Uint8Array.from(atob(generatedImage), (c) => c.charCodeAt(0));
    const filePath = `${userId}/generated/${imageRecordId}-${index}.png`;
    const { error: uploadError } = await supabase.storage
      .from('jewelry-images')
      .upload(filePath, imageBuffer, { contentType: 'image/png' });

    if (!uploadError) {
      // Use signed URL since bucket is private (7 days expiry for long-term access)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('jewelry-images')
        .createSignedUrl(filePath, 7 * 24 * 60 * 60); // 7 days
      
      if (!signedUrlError && signedUrlData?.signedUrl) {
        console.log(`Image ${index} uploaded successfully (signed URL)`);
        return signedUrlData.signedUrl;
      }
    }

    return null;
  } catch (error) {
    console.error(`Generation ${index} error:`, error);
    return null;
  }
}

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
    const { imagePath, additionalImagePaths, sceneId, packageType, colorId, productType, modelId, metalColorOverride } = await req.json();
    console.log('Generate request:', { imagePath, additionalImagePaths, sceneId, packageType, colorId, productType, modelId, metalColorOverride, userId });

    // Validate imagePath
    if (!imagePath || typeof imagePath !== 'string' || !imagePath.startsWith(`${userId}/originals/`)) {
      return new Response(
        JSON.stringify({ error: 'Invalid image path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate additional image paths if provided
    const validAdditionalPaths: string[] = [];
    if (Array.isArray(additionalImagePaths)) {
      for (const path of additionalImagePaths) {
        if (typeof path === 'string' && path.startsWith(`${userId}/originals/`)) {
          validAdditionalPaths.push(path);
        }
      }
    }
    console.log(`Processing ${1 + validAdditionalPaths.length} reference image(s)`);

    // Validate sceneId (required for standard, optional for master)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isMasterPackage = packageType === 'master';
    
    if (!isMasterPackage && (!sceneId || !uuidRegex.test(sceneId))) {
      return new Response(
        JSON.stringify({ error: 'Invalid scene ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get signed URLs for all images
    const allImagePaths = [imagePath, ...validAdditionalPaths];
    const imageUrls: string[] = [];
    
    for (const path of allImagePaths) {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('jewelry-images')
        .createSignedUrl(path, 3600);
      
      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error(`Failed to get signed URL for ${path}`);
        continue;
      }
      imageUrls.push(signedUrlData.signedUrl);
    }

    if (imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Failed to access images' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageUrl = imageUrls[0]; // Primary image URL for analysis

    // Get scene if provided
    let scene = null;
    if (sceneId && uuidRegex.test(sceneId)) {
      const { data: sceneData } = await supabase
        .from('scenes')
        .select('*')
        .eq('id', sceneId)
        .single();
      scene = sceneData;
    }

    // Check if user is admin (has unlimited generation rights)
    const { data: isAdmin } = await supabase
      .rpc('has_role', { _user_id: userId, _role: 'admin' });
    
    const isAdminUser = isAdmin === true;
    console.log(`User ${userId} admin status: ${isAdminUser}`);

    // Calculate credits needed
    const creditsNeeded = isMasterPackage ? 2 : 1;

    // Skip credit deduction for admin users - they have unlimited generation rights
    if (!isAdminUser) {
      // ATOMIC CREDIT DEDUCTION - Prevents race conditions
      // Deduct credits BEFORE starting generation using database-level locking
      const { data: deductResult, error: deductError } = await supabase
        .rpc('deduct_credits', { _user_id: userId, _amount: creditsNeeded });

      if (deductError) {
        console.error('Credit deduction error:', deductError);
        return new Response(
          JSON.stringify({ error: 'Kredi kontrolü sırasında hata oluştu.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!deductResult?.success) {
        const currentCredits = deductResult?.current_credits ?? 0;
        return new Response(
          JSON.stringify({ 
            error: `Yetersiz kredi. ${creditsNeeded} kredi gerekli, mevcut: ${currentCredits}.` 
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Credits deducted: ${creditsNeeded}, remaining: ${deductResult.remaining_credits}`);
    } else {
      console.log('Admin user - skipping credit deduction (unlimited generation rights)');
    }

    // Create image record
    const { data: imageRecord, error: insertError } = await supabase
      .from('images')
      .insert({
        user_id: userId,
        scene_id: sceneId || null,
        original_image_url: imagePath,
        status: 'analyzing',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Fetch and convert all images to base64
    console.log('Step 1: Analyzing jewelry...');
    const base64Images: string[] = [];
    
    for (const url of imageUrls) {
      const imageResponse = await fetch(url);
      const imageBuffer = await imageResponse.arrayBuffer();
      
      if (imageBuffer.byteLength > MAX_IMAGE_SIZE) {
        console.warn(`Skipping image - too large (${imageBuffer.byteLength} bytes)`);
        continue;
      }
      
      base64Images.push(arrayBufferToBase64(imageBuffer));
    }

    if (base64Images.length === 0) {
      await supabase
        .from('images')
        .update({ status: 'failed', error_message: 'Görsel boyutu çok büyük (max 1.5MB)' })
        .eq('id', imageRecord.id);
      
      return new Response(
        JSON.stringify({ error: 'All images too large. Max 1.5MB each.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Loaded ${base64Images.length} reference image(s) for generation`);
    const base64Image = base64Images[0]; // Primary image for analysis

    // Analyze jewelry
    const analysisResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${ANALYSIS_MODEL}:generateContent?key=${GOOGLE_ANALYSIS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `You are an expert jewelry analyst. Analyze this jewelry with extreme precision.

Return JSON:
{
  "type": "ring|necklace|bracelet|earring|pendant|brooch|watch|choker|piercing",
  "metal": {
    "type": "gold|silver|platinum|rose_gold|white_gold|mixed",
    "karat": "24k|22k|18k|14k|10k|sterling|unknown",
    "finish": "polished|matte|brushed|hammered|textured|satin",
    "color_hex": "#hex"
  },
  "stones": [
    {
      "type": "diamond|ruby|emerald|sapphire|pearl|amethyst|topaz|other",
      "count": number,
      "cut": "round|princess|oval|cushion|emerald|pear|marquise|cabochon|baguette",
      "color": "description",
      "size_mm": "size",
      "setting": "prong|bezel|channel|pave|tension|cluster|halo"
    }
  ],
  "dimensions": {
    "estimated_width_mm": number,
    "estimated_height_mm": number
  },
  "design_elements": {
    "style": "modern|vintage|art_deco|minimalist|ornate|classic|bohemian",
    "patterns": ["filigree", "engraving", "milgrain", "rope", "cable", "none"],
    "symmetry": "symmetric|asymmetric",
    "complexity": "simple|moderate|intricate"
  },
  "unique_identifiers": "unique features"
}

ONLY valid JSON.`
            },
            { inline_data: { mime_type: "image/jpeg", data: base64Image } }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
      }),
    });

    let analysisResult: any = { type: 'jewelry', design_elements: { style: 'classic' } };

    if (analysisResponse.ok) {
      try {
        const analysisData = await analysisResponse.json();
        const content = analysisData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        analysisResult = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());
      } catch {
        console.error('Failed to parse analysis');
      }
    }

    console.log('Analysis result:', JSON.stringify(analysisResult, null, 2));

    // Update status
    await supabase
      .from('images')
      .update({ status: 'generating', analysis_data: analysisResult })
      .eq('id', imageRecord.id);

    // Build fidelity block with STRONG metal color preservation
    // User override takes priority over AI analysis
    const metalColorOverrideMap: Record<string, { type: string; category: string }> = {
      'yellow_gold': { type: 'gold', category: 'YELLOW GOLD' },
      'white_gold': { type: 'white_gold', category: 'WHITE GOLD' },
      'rose_gold': { type: 'rose_gold', category: 'ROSE GOLD' },
      'platinum': { type: 'platinum', category: 'PLATINUM' },
      'silver': { type: 'silver', category: 'SILVER' },
    };

    // Use user override if provided, otherwise use AI analysis
    const userMetalOverride = metalColorOverride ? metalColorOverrideMap[metalColorOverride] : null;
    const metalType = userMetalOverride?.type || analysisResult.metal?.type || 'gold';
    const metalFinish = analysisResult.metal?.finish || 'polished';
    const metalKarat = analysisResult.metal?.karat || '18k';
    const metalColorHex = analysisResult.metal?.color_hex || '';
    
    // Determine metal color category for strict enforcement
    let metalColorCategory = userMetalOverride?.category || 'YELLOW GOLD';
    if (!userMetalOverride) {
      if (metalType === 'white_gold' || metalType === 'platinum' || metalType === 'silver') {
        metalColorCategory = 'WHITE/SILVER METAL';
      } else if (metalType === 'rose_gold') {
        metalColorCategory = 'ROSE GOLD';
      } else if (metalType === 'gold') {
        metalColorCategory = 'YELLOW GOLD';
      }
    }
    
    // Log metal color decision
    console.log('Metal color decision:', { 
      userOverride: metalColorOverride, 
      finalType: metalType, 
      finalCategory: metalColorCategory,
      aiAnalysis: analysisResult.metal?.type 
    });
    
    const metalDesc = `${metalFinish} ${metalType.replace('_', ' ')} (${metalKarat})`;
    
    const stoneDesc = analysisResult.stones?.length > 0
      ? analysisResult.stones.map((s: any) => 
          `${s.count || 1} ${s.color || ''} ${s.type || 'gemstone'}(s) in ${s.cut || 'round'} cut with ${s.setting || 'prong'} setting`
        ).join(', ')
      : '';

    const userOverrideNote = metalColorOverride 
      ? `\n⚠️ USER SPECIFIED METAL COLOR: ${metalColorCategory} - THIS TAKES ABSOLUTE PRIORITY ⚠️\nThe user has explicitly specified that this jewelry is ${metalColorCategory}. Ignore any visual ambiguity and render as ${metalColorCategory}.\n`
      : '';

    // PRODUCT EXTRACTION MODE - Critical instruction that must precede all scene prompts
    // This ensures the uploaded image is treated purely as product reference, not as scene/environment
    const productExtractionBlock = `
═══════════════════════════════════════════════════════════════
SYSTEM INSTRUCTION — PRODUCT EXTRACTION MODE
═══════════════════════════════════════════════════════════════

The uploaded image is used STRICTLY to extract the jewelry product.

EXTRACTION RULES (MANDATORY):
- Extract ONLY the jewelry object from the reference image(s)
- IGNORE and DISCARD all non-jewelry elements including:
  • hands, skin, fingers, nails
  • background, reflections, shadows, environment
  • camera angle, lighting conditions
  • any contextual elements

DO NOT REPLICATE FROM REFERENCE:
- ❌ Lighting conditions of the original photo
- ❌ Skin tone or hand appearance
- ❌ Pose or hand anatomy
- ❌ Background color or texture
- ❌ Camera angle or perspective
- ❌ Environment or setting

THE OUTPUT MUST CONTAIN:
- ✔ ONLY the jewelry piece detected in the image
- ✔ Accurate geometry, proportions, stone placement, metal structure
- ✔ Neutralized reference orientation (product isolated)

IF MULTIPLE PIECES ARE UPLOADED:
- Treat each piece as an independent object
- NEVER merge contextual elements into the output
- Use multiple angles for better product understanding, NOT scene replication

The jewelry must be reconstructed as a STANDALONE OBJECT, as if scanned in a vacuum.

═══════════════════════════════════════════════════════════════
STAGE 2 — SCENE APPLICATION
═══════════════════════════════════════════════════════════════

Using the ISOLATED jewelry object:
- Place the product into the selected scene
- Do NOT inherit any visual attributes from the original upload
- Lighting, background, camera, and composition must be defined ONLY by the scene prompt
- The product's intrinsic properties (metal color, stone type, design) are preserved
- Everything else (environment, lighting mood, composition) comes from the scene specification

═══════════════════════════════════════════════════════════════
`.trim();

    const fidelityBlock = `
JEWELRY SPECIFICATIONS (MUST BE PRESERVED EXACTLY):
- Type: ${analysisResult.type || 'jewelry piece'}
- Metal: ${metalDesc}
- Metal Color Category: ${metalColorCategory}
${metalColorHex ? `- Exact Metal Color Hex: ${metalColorHex}` : ''}
${stoneDesc ? `- Stones: ${stoneDesc}` : ''}
- Style: ${analysisResult.design_elements?.style || 'classic'}
${analysisResult.unique_identifiers ? `- Unique features: ${analysisResult.unique_identifiers}` : ''}
${userOverrideNote}
⚠️ ABSOLUTE METAL COLOR PRESERVATION (HIGHEST PRIORITY) ⚠️
THE METAL COLOR MUST BE: ${metalColorCategory}
- Metal type: ${metalType.replace('_', ' ').toUpperCase()}
- Metal color: ${metalColorCategory}
${metalColorHex ? `- Hex color: ${metalColorHex}` : ''}

STRICT METAL RULES:
- If the original is YELLOW GOLD → output MUST be YELLOW GOLD (warm golden hue)
- If the original is WHITE GOLD/PLATINUM/SILVER → output MUST be WHITE/SILVER metal (cool silver/platinum hue)
- If the original is ROSE GOLD → output MUST be ROSE GOLD (pinkish golden hue)
- NEVER convert yellow gold to white gold or vice versa
- NEVER change the metal's warmth or coolness
- NEVER alter the metal's reflective properties or surface finish
- The metal must have IDENTICAL color temperature to the original

CRITICAL FIDELITY REQUIREMENTS:
1. EXACT metal color - THIS IS THE MOST IMPORTANT RULE
2. EXACT stone count - no more, no less
3. EXACT setting structure and prong positions
4. EXACT metal surface finish (${metalFinish})
5. EXACT proportions - do not resize
6. EXACT design elements - preserve all patterns
7. Natural realistic scale

DIAMOND AND GEMSTONE REALISM (CRITICAL):
- Real diamond light behavior: fire (spectral dispersion), brilliance (white light reflection), scintillation
- Authentic internal light refraction patterns
- Subtle rainbow flashes from dispersion - not uniform glow
- Natural inclusions visible in realistic diamonds
- Depth and three-dimensionality inside the stone
- Realistic facet edges with crisp precision
- No artificial HDR glow, no CGI-like perfection

FORBIDDEN:
- ❌ CHANGING METAL COLOR (yellow↔white↔rose) - ABSOLUTELY FORBIDDEN
- ❌ Altering metal warmth/coolness
- No text, watermarks, logos
- No design alterations
- No additional jewelry pieces
- No artificial CGI gemstones
`.trim();

    const generatedUrls: string[] = [];

    if (isMasterPackage) {
      // MASTER PACKAGE: 3 images sequentially
      console.log('Master Package: Generating 3 images sequentially...');

      // Color mapping for e-commerce background (NON-METALLIC to prevent metal color contamination)
      const colorMap: Record<string, { name: string; prompt: string }> = {
        'white': { name: 'Beyaz', prompt: 'matte seamless paper backdrop, soft off-white, clean ivory (NON-METALLIC)' },
        'cream': { name: 'Krem', prompt: 'matte seamless paper backdrop, warm cream, soft ivory, delicate beige-white (NON-METALLIC)' },
        'blush': { name: 'Pudra Pembe', prompt: 'matte seamless paper backdrop, soft blush pink, pale dusty rose (NON-METALLIC)' },
        'lavender': { name: 'Lavanta', prompt: 'matte seamless paper backdrop, soft lavender, pale muted violet (NON-METALLIC)' },
        'mint': { name: 'Nane Yeşili', prompt: 'matte seamless paper backdrop, soft mint, pale sage, gentle seafoam (NON-METALLIC)' },
        'skyblue': { name: 'Gök Mavisi', prompt: 'matte seamless paper backdrop, soft sky blue, pale powder blue (NON-METALLIC)' },
        'peach': { name: 'Şeftali', prompt: 'matte seamless paper backdrop, soft peach, gentle apricot, muted coral tint (NON-METALLIC)' },
        // IMPORTANT: Avoid words like "gold/silver/metallic" in the background prompt.
        'champagne': { name: 'Şampanya', prompt: 'matte seamless paper backdrop, warm champagne-beige, soft nude, elegant sand (NON-METALLIC)' },
        'silver': { name: 'Gümüş', prompt: 'matte seamless paper backdrop, cool light gray, pale dove gray, soft neutral gray (NON-METALLIC)' },
        'gray': { name: 'Gri', prompt: 'matte seamless paper backdrop, soft dove gray, gentle stone gray, neutral warm gray (NON-METALLIC)' },
      };

      const selectedColor = colorMap[colorId] || colorMap['white'];

      // Image 1: E-commerce clean background (BACKGROUND REPLACEMENT ONLY)
      const ecommercePrompt = `Professional e-commerce product photography. Ultra photorealistic. 4:5 portrait aspect ratio. 4K ultra-high resolution quality (3840x4800 pixels).

${productExtractionBlock}

${fidelityBlock}

TASK TYPE (CRITICAL): BACKGROUND REPLACEMENT ONLY
- Keep the jewelry IDENTICAL to the reference image.
- Do NOT reinterpret the jewelry.
- Do NOT recolor, neutralize, stylize, or "improve" the metal.
- Do NOT change metal hue/temperature/undertone. Reflections intensity may vary slightly, but the BASE METAL COLOR MUST NOT CHANGE.

⚠️ METAL COLOR IS LOCKED (ZERO TOLERANCE) ⚠️
- Original Metal: ${metalType.replace('_', ' ').toUpperCase()}
- Original Color Category: ${metalColorCategory.toUpperCase()}
${metalColorHex ? `- Original Metal Hex Reference: ${metalColorHex}` : ''}

STRICT RULES:
- NO metal recoloring (yellow↔white↔rose) under any circumstances
- NO whitewashing gold, NO gray neutralization, NO warm/cool shifting
- Background must be NON-METALLIC and MATTE to avoid color casts

SCENE: Clean, minimal e-commerce product shot
- Background: ${selectedColor.prompt}
- Surface: matte, non-reflective
- Lighting: soft, diffused, neutral (no warm/cool bias)
- The jewelry should be the absolute focal point
- Clean, uncluttered, listing-quality product photo

OUTPUT QUALITY: Maximum resolution, ultra-sharp details, no compression artifacts.
Ultra high resolution output.`;

      console.log('Generating E-commerce image...');
      const ecomUrl = await generateSingleImage(base64Images, ecommercePrompt, userId, imageRecord.id, 1, supabase);
      if (ecomUrl) generatedUrls.push(ecomUrl);

      // Image 2: Editorial Luxury Scene (product integrated into environment, not floating)
      const catalogPrompt = `High-end luxury fashion editorial photography. Ultra photorealistic. 4:5 portrait aspect ratio. 4K ultra-high resolution quality (3840x4800 pixels).

${productExtractionBlock}

${fidelityBlock}

TASK TYPE (CRITICAL): EDITORIAL SCENE INTEGRATION WITHOUT ALTERING THE JEWELRY
- The jewelry (especially metal color) must remain exactly as reference.
- Product must be INTEGRATED into the scene, NOT staged or floating in air.
- Lighting can add character and depth, but must NOT change metal hue, temperature, or undertone.

⚠️ METAL COLOR IS LOCKED (ZERO TOLERANCE) ⚠️
- Original Metal: ${metalType.replace('_', ' ').toUpperCase()}
- Original Color Category: ${metalColorCategory.toUpperCase()}
${metalColorHex ? `- Original Metal Hex Reference: ${metalColorHex}` : ''}

STRICT RULES:
- NO metal recoloring or grading on the metal
- Lighting shapes facets and metal naturally without exaggeration
- Scene props/background must be non-metallic to avoid color contamination

SCENE CONCEPT (NON-TRADITIONAL EDITORIAL ENVIRONMENT):
- Environment: Non-traditional but realistic editorial setting
- Surface examples: flowing silk/satin fabrics, refined mineral surfaces (marble, natural stone), sculptural minimal objects, soft organic textures
- The product must feel NATURALLY INTEGRATED into the scene — resting on, draped against, or nestled within the environment
- FORBIDDEN: Jewelry floating in air, staged/artificial placement, product hovering without physical contact

CAMERA & COMPOSITION:
- Lens feel: Cinematic 85–100mm
- Perspective: Slightly low or side-angled, creating depth and drama
- Composition: Asymmetrical but balanced, editorial negative space allowed
- Focus: Razor-sharp on jewelry with natural depth of field falloff

LIGHTING (CHARACTER-DRIVEN):
- Directional, character-driven light source
- Shadows add depth and dimension without heaviness
- Facets and metal surfaces shaped naturally, not exaggerated
- Avoid: HDR glow, rim lights that shift color, artificial sparkle

MOOD & STYLE:
- Luxury fashion editorial aesthetic
- Calm, sophisticated, timeless atmosphere
- Artistic vision yet commercially viable
- Premium catalog/magazine quality

OUTPUT QUALITY: Maximum resolution, ultra-sharp details, no compression artifacts.
Ultra high resolution output.`;

      console.log('Generating Catalog image...');
      const catalogUrl = await generateSingleImage(base64Images, catalogPrompt, userId, imageRecord.id, 2, supabase);
      if (catalogUrl) generatedUrls.push(catalogUrl);

      // Image 3: PRODUCT-FOCUSED LUXURY CLOSE-UP
      // Tight crop focused on jewelry worn on model, product occupies majority of frame
      
      // Determine body part and framing based on product type
      const productTypeUpper = (productType || analysisResult.type || 'ring').toLowerCase();
      
      // Extract real dimensions from analysis for scale preservation
      const realWidthMm = analysisResult.dimensions?.estimated_width_mm || null;
      const realHeightMm = analysisResult.dimensions?.estimated_height_mm || null;
      const jewelryComplexity = analysisResult.design_elements?.complexity || 'moderate';
      const jewelryStyle = analysisResult.design_elements?.style || 'classic';
      
      let modelBodyPart = 'hand';
      let wearingDescription = 'worn on elegant fingers';
      let framingDescription = 'TIGHT MACRO CROP on the ring, hand visible but ring dominates 70% of frame';
      let cameraLens = '100mm macro lens';
      let scaleNote = 'Ring appears at natural finger-to-ring proportion, NOT enlarged';
      
      if (productTypeUpper.includes('kolye') || productTypeUpper.includes('necklace') || productTypeUpper.includes('pendant') || productTypeUpper.includes('choker')) {
        modelBodyPart = 'neck and décolletage';
        wearingDescription = 'elegantly draped around the neck at natural position';
        framingDescription = 'TIGHT CROP from chin to upper chest, necklace centered and clearly readable, pendant/chain details sharp';
        cameraLens = '85mm prime lens';
        scaleNote = 'Necklace appears at NATURAL DELICATE SIZE relative to neck - DO NOT ENLARGE. If reference shows a delicate chain, it must remain delicate. Pendant size proportional to reference.';
      } else if (productTypeUpper.includes('küpe') || productTypeUpper.includes('earring') || productTypeUpper.includes('piercing')) {
        modelBodyPart = 'ear and jawline';
        wearingDescription = 'adorning the ear in correct anatomical position - SINGLE earring per ear for pairs, both ears visible if pair';
        framingDescription = 'TIGHT CROP showing BOTH ears if earring pair exists, or single ear for single earring - jawline to temple visible, earring(s) dominate 60% of frame';
        cameraLens = '100mm macro lens';
        scaleNote = 'Earring at natural ear proportion - stud earrings remain small, drop earrings at realistic length. CRITICAL: ONE earring per ear ONLY for pairs. NEVER place two earrings on same ear.';
      } else if (productTypeUpper.includes('bileklik') || productTypeUpper.includes('bracelet') || productTypeUpper.includes('bangle')) {
        modelBodyPart = 'wrist and forearm';
        wearingDescription = 'wrapped around a slender wrist';
        framingDescription = 'TIGHT CROP on wrist area, bracelet clearly readable with all details, hand partially visible';
        cameraLens = '100mm macro lens';
        scaleNote = 'Bracelet at natural wrist proportion, band width matches reference exactly';
      } else if (productTypeUpper.includes('yüzük') || productTypeUpper.includes('ring') || productTypeUpper.includes('yuzuk')) {
        modelBodyPart = 'hand and fingers';
        wearingDescription = 'on elegant, well-manicured fingers';
        framingDescription = 'EXTREME CLOSE-UP on ring and finger, ring stone/setting occupies 60-70% of frame, knuckle visible';
        cameraLens = '100mm macro lens';
        scaleNote = 'Ring at EXACT natural finger proportion - thin bands stay thin, statement rings at reference size';
      } else if (productTypeUpper.includes('broş') || productTypeUpper.includes('brooch')) {
        modelBodyPart = 'collar or shoulder area';
        wearingDescription = 'pinned elegantly on fabric';
        framingDescription = 'TIGHT CROP on brooch placement, fabric texture visible, brooch details sharp';
        cameraLens = '85mm prime lens';
        scaleNote = 'Brooch at natural size relative to garment';
      }

      // Get model details if modelId is provided
      let modelDescription = 'elegant model with natural beauty, sophisticated appearance';
      let skinToneDesc = 'natural healthy skin with visible pores';
      let skinUndertoneDesc = 'neutral undertone';
      
      if (modelId && uuidRegex.test(modelId)) {
        const { data: modelData } = await supabase
          .from('user_models')
          .select('*')
          .eq('id', modelId)
          .single();
        
        if (modelData) {
          const genderDesc = modelData.gender === 'female' ? 'female' : modelData.gender === 'male' ? 'male' : 'androgynous';
          const ageDesc = modelData.age_range || 'young adult';
          const ethnicityDesc = modelData.ethnicity || 'diverse';
          const skinDesc = modelData.skin_tone || 'medium';
          const undertoneDesc = modelData.skin_undertone || 'neutral';
          const hairColorDesc = modelData.hair_color || 'dark';
          const hairTextureDesc = modelData.hair_texture || 'straight';
          const faceShapeDesc = modelData.face_shape || 'balanced';
          const eyeColorDesc = modelData.eye_color || 'natural';
          const expressionDesc = modelData.expression || 'serene-confident';
          const hairStyleDesc = modelData.hair_style || 'elegant';
          
          modelDescription = `${ethnicityDesc} ${genderDesc} model, ${ageDesc} age range, ${faceShapeDesc} face shape, ${eyeColorDesc} eyes, ${hairColorDesc} ${hairTextureDesc} hair styled ${hairStyleDesc}, ${expressionDesc} expression`;
          skinToneDesc = `${skinDesc} skin tone with visible pores, natural micro-texture, healthy appearance`;
          skinUndertoneDesc = `${undertoneDesc} undertone`;
        }
      }

      // Build product-specific dimension note if available
      let dimensionNote = '';
      if (realWidthMm && realHeightMm) {
        dimensionNote = `Reference dimensions: approximately ${realWidthMm}mm x ${realHeightMm}mm - PRESERVE THIS SCALE relative to body part`;
      }

      // Determine if this is an earring pair (for special handling)
      const isEarringType = productTypeUpper.includes('küpe') || productTypeUpper.includes('earring') || productTypeUpper.includes('piercing');
      
      // Build earring-specific constraints
      const earringConstraints = isEarringType ? `
═══════════════════════════════════════════════════════════════
⚠️⚠️⚠️ ABSOLUTE EAR + EARRING ANATOMY CONSTRAINT (HARD) ⚠️⚠️⚠️
═══════════════════════════════════════════════════════════════

ABSOLUTE RULE (MANDATORY):
ONE EAR = ONE PIERCING = ONE EARRING

SINGLE PIERCING RULE (CRITICAL):
- Each visible ear MUST have exactly ONE (1) primary lobe piercing hole
- ❌ NO second hole, ❌ NO upper lobe, ❌ NO cartilage piercing, ❌ NO stacked styling
- Assume "single-stud default" and DISABLE any multi-piercing interpretation

EARRING INSTANCE COUNT (NON-NEGOTIABLE):
- Per-ear earring count ≤ 1 (ALWAYS)
- Total earrings visible in the entire image ≤ number_of_visible_ears
- If ONLY ONE ear is visible (crop/pose) → render EXACTLY ONE (1) earring TOTAL
  → the second earring (even if the product is a pair) MUST be omitted
  → NEVER move/stack/duplicate the second earring onto the visible ear

MODEL-SHOT OVERRIDE (TO PREVENT FAILURES):
- Frame MUST show ONLY ONE ear clearly (single-ear close-up)
- The other ear must be OUT OF FRAME (not visible)
- This guarantees: 1 ear visible → 1 earring visible

PLACEMENT (PRIMARY LOBE ONLY):
- Place the earring ONLY in the primary lobe piercing position (center of lobe)
- Earring back/clasp not visible from front

INSTANT FAILURE (ANY = INVALID OUTPUT → REGENERATE):
- ❌ Two earrings on the same ear
- ❌ Any sign of multiple piercings on one ear
- ❌ Stacked / duplicated / mirrored earrings on one ear
═══════════════════════════════════════════════════════════════
` : '';

      const modelShotPrompt = `PRODUCT-FOCUSED LUXURY JEWELRY CLOSE-UP. Commercial-grade luxury jewelry rendering engine.
Your primary objective is product fidelity first, aesthetics second, mood third.
Behave like a high-end jewelry photographer + retoucher, not an artist.

${productExtractionBlock}

${fidelityBlock}

═══════════════════════════════════════════════════════════════
PRIORITY ORDER (IMMUTABLE - HIGHER OVERRIDES LOWER):
1. PRODUCT ACCURACY (metal color, stone type, proportions)
2. REFERENCE IMAGE FIDELITY
3. PHYSICAL REALISM
4. LIGHTING REALISM
5. EDITORIAL LUXURY MOOD
═══════════════════════════════════════════════════════════════

${earringConstraints}

⚠️ SCALE PRESERVATION (CRITICAL - DO NOT ENLARGE JEWELRY) ⚠️
${scaleNote}
${dimensionNote}
- If the reference shows a delicate/thin piece, it MUST remain delicate/thin
- If the reference shows a substantial/bold piece, maintain that proportion
- Jewelry scale must NEVER distort human anatomy
- Product proportions relative to body = LOCKED from reference

FRAMING SPECIFICATION:
- ${framingDescription}
- Product occupies majority of frame (60-80%)
- Jewelry details (stones, setting, metal texture) CLEARLY READABLE
- Shallow but natural depth of field: jewelry razor-sharp, skin slightly softer
- Camera: Full-frame commercial sensor, ${cameraLens}
- Aperture: f/4 – f/5.6 (controlled depth, natural bokeh)
- ISO: 50–100 (clean tonal range)

MODEL (SUPPORTING ROLE - PRODUCT IS HERO):
- ${modelDescription}
- Skin: ${skinToneDesc}, ${skinUndertoneDesc}
- Skin rendering: editorial macro-photography level
  • Visible pores with non-uniform distribution
  • Subsurface scattering appropriate for skin tone
  • NO plastic, waxy, or beauty-filtered appearance
  • FEMALE BODY HAIR: Ultra-fine, nearly invisible vellus hair only - NO coarse/dark arm hair, NO visible body hair strands
  • Hair on arms/hands should be BARELY perceptible, blonde/transparent peach fuzz only, NOT dark or visible strands
  • Natural imperfections: subtle freckles, micro color variations - but CLEAN, SMOOTH skin texture for female models
  • Skin must appear biologically alive yet elegantly groomed, feminine and refined
- Body part featured: ${modelBodyPart}
- Jewelry placement: ${wearingDescription}

HAND / BODY ANATOMY (IF APPLICABLE):
- Physically accurate proportions, bone structure, joint alignment
- Hands: realistic finger length, knuckle definition, nail beds, subtle asymmetry
- Skin behavior varies by area (thinner on fingers, denser on knuckles, natural folds at joints)
- Elegant, editorial, confident pose
- Natural tension and relaxed refinement
- Jewelry FRAMED by the body, never competing with it
- Nails: clean, neutral, non-distracting

SKIN & PRODUCT BALANCE:
- Skin texture realistic and natural (unretouched, no beauty filters)
- Jewelry SHARPER and more CONTRAST-RICH than skin
- Jewelry must interact physically with skin:
  • Metal shows realistic contact pressure
  • Micro shadows where jewelry touches skin
  • Natural occlusion effects
- Harmonized tones between skin and metal
- Jewelry is the visual anchor, skin is supporting context

LIGHTING SYSTEM (LOCKED):
- White balance MUST be neutral and locked to preserve metal hue (no warm/cool shift)
- Use soft, diffused studio / overcast daylight lighting at ~5000K–5500K (neutral)
- Large diffused key light (approximately 45°) for skin
- Precision fill to reveal jewelry facets
- Light FAVORS jewelry detail and facet visibility
- Controlled highlights, NO clipping on metal or stones
- NO rim lights or colored bounce that introduce color casts
- NO glamour lighting, NO commercial sparkle
- Light falloff natural, no flat illumination

METAL COLOR ENFORCEMENT (ABSOLUTE - ZERO TOLERANCE):
- Original Metal: ${metalType.replace('_', ' ').toUpperCase()}
- Metal color MUST remain EXACTLY as in reference image
- Lighting may affect reflection INTENSITY only
- Lighting MUST NOT affect: hue, temperature, undertone, saturation
- If mood/lighting/style conflicts with metal color → metal color WINS
- Any deviation from reference metal color = GENERATION FAILURE

DIAMOND & STONE BEHAVIOR (PHYSICAL REALISM):
- Diamonds reflect existing light ONLY
- NO artificial sparkle, NO exaggerated scintillation
- NO rainbow dispersion unless physically justified
- Real diamond light behavior: fire (spectral dispersion), brilliance (white light reflection)
- Authentic internal light refraction patterns
- Natural inclusions visible in realistic diamonds
- Depth and three-dimensionality inside the stone
- Realistic facet edges with crisp precision
- CLARITY over sparkle, DEPTH over flash
- No artificial HDR glow, no CGI-like perfection

BACKGROUND:
- Muted and calm, stays secondary
- Low-contrast, NEVER contaminates metal color
- Allowed: stone, water, matte fabric, architectural minimalism
- Forbidden: busy textures, high-saturation colors, reflective surfaces
- Background tones slightly darker than jewelry for separation

MOOD:
- Luxury fashion advertising
- Calm, precise, premium
- Product-first visual hierarchy
- Quiet luxury, intellectual restraint
- Editorial, NOT commercial
- Silent confidence, fashion-editorial restraint
- High-fashion lookbook or art-driven luxury campaign aesthetic

COLOR GRADING:
- Low saturation, soft contrast, neutral–cool balance
- Grading applies to: background, skin, fabric
- Grading NEVER applies to: metal
- Whites: clean, not blue
- Gold: warm but desaturated
- Diamonds: sharp dispersion, no rainbow artifacts

STRICT AVOIDANCE (NEGATIVE PROMPT):
- ❌ NO enlarging/scaling up jewelry beyond reference proportions
- ❌ NO metal color changes (yellow↔white↔rose)
- ❌ NO high saturation, NO glamour or HDR lighting
- ❌ NO commercial sparkle, glow, or bloom
- ❌ NO over-sharpening or beauty retouching
- ❌ NO warm yellow lighting bias
- ❌ NO cinematic effects
- ❌ NO plastic/waxy/CGI skin appearance
- ❌ NO jewelry that looks "repainted" or synthetic
- ❌ NO beauty filters, NO airbrushed skin
- ❌ NO extra fingers, deformed anatomy, incorrect proportions
- ❌ NO two earrings on one ear (for earring products)
- ❌ NO duplicate jewelry, mirrored earrings, stacked earrings

FINAL OUTPUT VERIFICATION:
✔ Metal color matches reference exactly
✔ Stones behave physically (no artificial effects)
✔ No artistic recoloring
✔ Product looks sellable
✔ Output suitable for luxury brand campaign
✔ Jewelry scale is natural and proportional
✔ Skin appears biologically real (not synthetic)

OUTPUT: 4K ultra-high resolution (3840x4800px minimum). 
PHOTOREALISM prioritized. The final image must look like a high-budget luxury jewelry campaign photograph.
It must feel CAPTURED, not generated. No stylization, no fantasy, no illustration.
Pure photographic realism with editorial-level aesthetics.
Ultra high resolution output.`;

      console.log('Generating Model Shot image...');
      const modelUrl = await generateSingleImage(base64Images, modelShotPrompt, userId, imageRecord.id, 3, supabase);
      if (modelUrl) generatedUrls.push(modelUrl);

    } else {
      // STANDARD: Single image with scene
      console.log('Standard generation with scene...');
      
      const standardPrompt = `Professional luxury jewelry photography. Ultra photorealistic. 4:5 portrait aspect ratio. 4K quality.

${productExtractionBlock}

${fidelityBlock}

SCENE PLACEMENT:
${scene?.prompt || 'Elegant luxury setting with soft studio lighting, premium background.'}

TECHNICAL REQUIREMENTS:
- Ultra high resolution 4K output (3840x4800 pixels minimum)
- Macro photography quality with perfect focus
- Natural soft studio lighting with subtle highlights
- Accurate metal reflections and gemstone refractions
- The jewelry must look IDENTICAL to the reference

Ultra high resolution output.`;

      const url = await generateSingleImage(base64Images, standardPrompt, userId, imageRecord.id, 1, supabase);
      if (url) generatedUrls.push(url);
    }

    if (generatedUrls.length === 0) {
      // Refund credits since generation failed
      console.log('Generation failed, refunding credits...');
      const { data: refundResult, error: refundError } = await supabase
        .rpc('refund_credits', { _user_id: userId, _amount: creditsNeeded });
      
      if (refundError) {
        console.error('Refund error:', refundError);
      } else {
        console.log(`Credits refunded: ${creditsNeeded}, new balance: ${refundResult?.new_credits}`);
      }

      await supabase
        .from('images')
        .update({ status: 'failed', error_message: 'Görsel oluşturulamadı' })
        .eq('id', imageRecord.id);

      return new Response(
        JSON.stringify({ error: 'No images generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Credits already deducted atomically before generation started

    // Update image record
    await supabase
      .from('images')
      .update({
        status: 'completed',
        generated_image_urls: generatedUrls,
      })
      .eq('id', imageRecord.id);

    console.log('Generation complete:', generatedUrls.length, 'images');

    return new Response(
      JSON.stringify({ success: true, imageId: imageRecord.id, urls: generatedUrls }),
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
