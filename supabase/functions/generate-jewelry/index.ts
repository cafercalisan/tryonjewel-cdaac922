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
  base64Image,
  prompt,
}: {
  base64Image: string;
  prompt: string;
}) {
  const url = `https://generativelanguage.googleapis.com/v1alpha/models/${IMAGE_GEN_MODEL}:generateContent?key=${GOOGLE_IMAGE_API_KEY}`;
  return await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: base64Image } },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        temperature: 0.4,
      },
    }),
  });
}

async function callLovableImageGeneration({
  base64Image,
  prompt,
}: {
  base64Image: string;
  prompt: string;
}) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

  const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
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
async function generateSingleImage(base64Image: string, prompt: string, userId: string, imageRecordId: string, index: number, supabase: any): Promise<string | null> {
  try {
    if (!GOOGLE_IMAGE_API_KEY) {
      console.error('Missing GOOGLE_API_KEY');
      return null;
    }

    const genResponse = await callGeminiImageGeneration({ base64Image, prompt });

    if (!genResponse.ok) {
      const errText = await genResponse.text();
      console.error(`Generation ${index} API error (${genResponse.status}):`, errText);

      // Fallback to Lovable AI
      if (errText.includes('Image generation is not available') || errText.includes('FAILED_PRECONDITION')) {
        try {
          console.log('Falling back to Lovable AI...');
          const lovableBase64 = await callLovableImageGeneration({ base64Image, prompt });
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
    const { imagePath, sceneId, packageType, colorId, productType, modelId } = await req.json();
    console.log('Generate request:', { imagePath, sceneId, packageType, colorId, productType, modelId, userId });

    // Validate imagePath
    if (!imagePath || typeof imagePath !== 'string' || !imagePath.startsWith(`${userId}/originals/`)) {
      return new Response(
        JSON.stringify({ error: 'Invalid image path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Get signed URL for image
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('jewelry-images')
      .createSignedUrl(imagePath, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return new Response(
        JSON.stringify({ error: 'Failed to access image' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageUrl = signedUrlData.signedUrl;

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

    // Calculate credits needed
    const creditsNeeded = isMasterPackage ? 2 : 1;

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

    // Fetch and convert image to base64
    console.log('Step 1: Analyzing jewelry...');
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    
    if (imageBuffer.byteLength > MAX_IMAGE_SIZE) {
      await supabase
        .from('images')
        .update({ status: 'failed', error_message: 'Görsel boyutu çok büyük (max 1.5MB)' })
        .eq('id', imageRecord.id);
      
      return new Response(
        JSON.stringify({ error: 'Image too large. Max 1.5MB.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const base64Image = arrayBufferToBase64(imageBuffer);

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
    const metalType = analysisResult.metal?.type || 'gold';
    const metalFinish = analysisResult.metal?.finish || 'polished';
    const metalKarat = analysisResult.metal?.karat || '18k';
    const metalColorHex = analysisResult.metal?.color_hex || '';
    
    // Determine metal color category for strict enforcement
    let metalColorCategory = 'yellow gold';
    if (metalType === 'white_gold' || metalType === 'platinum' || metalType === 'silver') {
      metalColorCategory = 'white/silver metal';
    } else if (metalType === 'rose_gold') {
      metalColorCategory = 'rose gold';
    } else if (metalType === 'gold') {
      metalColorCategory = 'yellow gold';
    }
    
    const metalDesc = `${metalFinish} ${metalType.replace('_', ' ')} (${metalKarat})`;
    
    const stoneDesc = analysisResult.stones?.length > 0
      ? analysisResult.stones.map((s: any) => 
          `${s.count || 1} ${s.color || ''} ${s.type || 'gemstone'}(s) in ${s.cut || 'round'} cut with ${s.setting || 'prong'} setting`
        ).join(', ')
      : '';

    const fidelityBlock = `
JEWELRY SPECIFICATIONS (MUST BE PRESERVED EXACTLY):
- Type: ${analysisResult.type || 'jewelry piece'}
- Metal: ${metalDesc}
- Metal Color Category: ${metalColorCategory.toUpperCase()}
${metalColorHex ? `- Exact Metal Color Hex: ${metalColorHex}` : ''}
${stoneDesc ? `- Stones: ${stoneDesc}` : ''}
- Style: ${analysisResult.design_elements?.style || 'classic'}
${analysisResult.unique_identifiers ? `- Unique features: ${analysisResult.unique_identifiers}` : ''}

⚠️ ABSOLUTE METAL COLOR PRESERVATION (HIGHEST PRIORITY) ⚠️
THE METAL COLOR MUST REMAIN EXACTLY AS IN THE ORIGINAL IMAGE:
- Original metal type: ${metalType.replace('_', ' ').toUpperCase()}
- Original metal color: ${metalColorCategory.toUpperCase()}
${metalColorHex ? `- Original hex color: ${metalColorHex}` : ''}

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
      const ecomUrl = await generateSingleImage(base64Image, ecommercePrompt, userId, imageRecord.id, 1, supabase);
      if (ecomUrl) generatedUrls.push(ecomUrl);

      // Image 2: Luxury catalog shot (STILL color-locked; avoid dramatic lighting that shifts metal)
      const catalogPrompt = `High-end luxury catalog photography. Ultra photorealistic. 4:5 portrait aspect ratio. 4K ultra-high resolution quality (3840x4800 pixels).

${fidelityBlock}

TASK TYPE (CRITICAL): BACKGROUND/SCENE CHANGE WITHOUT ALTERING THE JEWELRY
- The jewelry (especially metal color) must remain exactly as reference.
- Lighting can add depth, but must NOT change metal hue, temperature, or undertone.

⚠️ METAL COLOR IS LOCKED (ZERO TOLERANCE) ⚠️
- Original Metal: ${metalType.replace('_', ' ').toUpperCase()}
- Original Color Category: ${metalColorCategory.toUpperCase()}
${metalColorHex ? `- Original Metal Hex Reference: ${metalColorHex}` : ''}

STRICT RULES:
- NO metal recoloring or grading on the metal
- No rim lights that introduce color casts
- Scene props/background must be neutral and non-metallic

SCENE: Premium catalog presentation
- Setting: premium matte textured surface (stone, matte ceramic, matte fabric) — NON-METALLIC
- Lighting: soft but directional studio light, controlled highlights, neutral balance
- Style: quiet luxury, premium catalog, product-first
- Macro-level detail visibility, jewelry perfectly sharp
- Subtle props only (if any), never reflective

OUTPUT QUALITY: Maximum resolution, ultra-sharp details, no compression artifacts.
Ultra high resolution output.`;

      console.log('Generating Catalog image...');
      const catalogUrl = await generateSingleImage(base64Image, catalogPrompt, userId, imageRecord.id, 2, supabase);
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
        wearingDescription = 'adorning the ear in natural position';
        framingDescription = 'TIGHT CROP on ear area, jawline to temple visible, earring dominates 60% of frame';
        cameraLens = '100mm macro lens';
        scaleNote = 'Earring at natural ear proportion - stud earrings remain small, drop earrings at realistic length';
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

      const modelShotPrompt = `PRODUCT-FOCUSED LUXURY JEWELRY CLOSE-UP. Commercial-grade luxury jewelry rendering with product fidelity first, aesthetics second.

${fidelityBlock}

═══════════════════════════════════════════════════════════════
PRIORITY ORDER (IMMUTABLE - HIGHER OVERRIDES LOWER):
1. PRODUCT ACCURACY (metal color, stone type, proportions)
2. REFERENCE IMAGE FIDELITY
3. PHYSICAL REALISM
4. LIGHTING REALISM
5. EDITORIAL LUXURY MOOD
═══════════════════════════════════════════════════════════════

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
- Camera: Full-frame sensor, ${cameraLens}
- Aperture: f/4 – f/5.6 (controlled depth, natural bokeh)
- ISO: 50–100 (clean tonal range)

MODEL (SUPPORTING ROLE - PRODUCT IS HERO):
- ${modelDescription}
- Skin: ${skinToneDesc}, ${skinUndertoneDesc}
- Skin rendering: editorial macro-photography level
  • Visible pores with non-uniform distribution
  • Subsurface scattering appropriate for skin tone
  • NO plastic, waxy, or beauty-filtered appearance
  • Fine vellus hair visible in appropriate lighting
- Body part featured: ${modelBodyPart}
- Jewelry placement: ${wearingDescription}

HAND / BODY POSE (IF APPLICABLE):
- Elegant, editorial, confident pose
- Natural anatomy - anatomically correct proportions
- Relaxed but refined gesture
- Jewelry FRAMED by the body, never competing with it
- Nails: clean, neutral, non-distracting

SKIN & PRODUCT BALANCE:
- Skin texture realistic and natural
- Jewelry SHARPER and more CONTRAST-RICH than skin
- Harmonized tones between skin and metal
- Jewelry is the visual anchor, skin is supporting context

LIGHTING (LOCKED):
- Soft, directional beauty-style lighting
- Large diffused key light (approximately 45°) for skin
- Precision fill to reveal jewelry facets
- Light FAVORS jewelry detail and facet visibility
- Controlled highlights, NO clipping on metal or stones
- Natural overcast daylight simulation
- NO dramatic rim lights that introduce color casts
- NO glamour lighting, NO commercial sparkle

METAL COLOR ENFORCEMENT (ABSOLUTE):
- Original Metal: ${metalType.replace('_', ' ').toUpperCase()}
- Lighting may affect reflection INTENSITY only
- Lighting MUST NOT affect: hue, temperature, undertone, saturation
- Any deviation from reference metal color = GENERATION FAILURE

DIAMOND & STONE BEHAVIOR:
- Diamonds reflect existing light ONLY
- NO artificial sparkle
- NO exaggerated scintillation  
- NO rainbow dispersion unless physically justified
- CLARITY over sparkle
- DEPTH over flash

BACKGROUND:
- Muted and calm
- Stays secondary
- Low-contrast
- NEVER contaminates metal color
- Allowed: stone, water, matte fabric, architectural minimalism
- Background tones slightly darker than jewelry for separation

MOOD:
- Luxury fashion advertising
- Calm, precise, premium
- Product-first visual hierarchy
- Quiet luxury, intellectual restraint
- Editorial, NOT commercial

COLOR GRADING:
- Low saturation
- Soft contrast
- Neutral–cool balance
- Grading applies to: background, skin, fabric
- Grading NEVER applies to: metal

STRICT AVOIDANCE:
- ❌ NO enlarging/scaling up jewelry beyond reference proportions
- ❌ NO metal color changes (yellow↔white↔rose)
- ❌ NO high saturation
- ❌ NO glamour or HDR lighting
- ❌ NO commercial sparkle or glow
- ❌ NO over-sharpening or beauty retouching
- ❌ NO warm yellow lighting bias
- ❌ NO cinematic effects or bloom
- ❌ NO plastic/CGI skin appearance
- ❌ NO jewelry that looks "repainted" or synthetic

OUTPUT: 4K ultra-high resolution (3840x4800px minimum). 
Product looks SELLABLE. Suitable for luxury brand campaign.
PHOTOREALISM prioritized. Ultra high resolution output.`;

      console.log('Generating Model Shot image...');
      const modelUrl = await generateSingleImage(base64Image, modelShotPrompt, userId, imageRecord.id, 3, supabase);
      if (modelUrl) generatedUrls.push(modelUrl);

    } else {
      // STANDARD: Single image with scene
      console.log('Standard generation with scene...');
      
      const standardPrompt = `Professional luxury jewelry photography. Ultra photorealistic. 4:5 portrait aspect ratio. 4K quality.

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

      const url = await generateSingleImage(base64Image, standardPrompt, userId, imageRecord.id, 1, supabase);
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
