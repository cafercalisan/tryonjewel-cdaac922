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
        temperature: 0.15,
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
    const { imagePath, additionalImagePaths, sceneId, packageType, colorId, productType, modelId, metalColorOverride, styleReferencePath } = await req.json();
    console.log('Generate request:', { imagePath, additionalImagePaths, sceneId, packageType, colorId, productType, modelId, metalColorOverride, styleReferencePath, userId });

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

    // Check if style reference is provided
    const hasStyleReference = styleReferencePath && typeof styleReferencePath === 'string' && styleReferencePath.startsWith(`${userId}/style-references/`);
    console.log(`Style reference mode: ${hasStyleReference ? 'ENABLED' : 'disabled'}`);

    // Validate sceneId (required for standard without style reference, optional for master, not needed for retouch)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isMasterPackage = packageType === 'master';
    const isRetouchPackage = packageType === 'retouch';
    
    // Scene is NOT required if style reference is provided OR if retouch mode
    if (!isMasterPackage && !hasStyleReference && !isRetouchPackage && (!sceneId || !uuidRegex.test(sceneId))) {
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

    // Get style reference image if provided
    let styleReferenceUrl: string | null = null;
    let styleReferenceBase64: string | null = null;
    
    if (hasStyleReference) {
      const { data: styleSignedData, error: styleSignedError } = await supabase.storage
        .from('jewelry-images')
        .createSignedUrl(styleReferencePath, 3600);
      
      if (!styleSignedError && styleSignedData?.signedUrl) {
        styleReferenceUrl = styleSignedData.signedUrl;
        console.log('Style reference URL obtained');
        
        // Fetch and convert style reference to base64
        try {
          const styleResponse = await fetch(styleReferenceUrl);
          const styleBuffer = await styleResponse.arrayBuffer();
          if (styleBuffer.byteLength <= MAX_IMAGE_SIZE) {
            styleReferenceBase64 = arrayBufferToBase64(styleBuffer);
            console.log('Style reference converted to base64');
          } else {
            console.warn('Style reference too large, skipping');
          }
        } catch (err) {
          console.error('Failed to fetch style reference:', err);
        }
      }
    }

    // Get scene if provided (and not using style reference)
    let scene = null;
    if (!hasStyleReference && sceneId && uuidRegex.test(sceneId)) {
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

    // Calculate credits needed: 10 credits per image output, 20 for master (2 outputs)
    const creditsNeeded = isMasterPackage ? 20 : 10;

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
              text: `You are an expert jewelry and luxury watch analyst. Analyze this piece with extreme precision.

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
      "type": "diamond|ruby|emerald|sapphire|pearl|amethyst|topaz|mother_of_pearl|other",
      "count": number,
      "cut": "round|princess|oval|cushion|emerald|pear|marquise|cabochon|baguette",
      "color": "description",
      "size_mm": "size",
      "setting": "prong|bezel|channel|pave|tension|cluster|halo"
    }
  ],
  "watch_details": {
    "dial_color": "white|black|blue|champagne|mother_of_pearl|other",
    "dial_finish": "sunburst|guilloché|enamel|textured|plain",
    "complications": ["date", "chronograph", "moon_phase", "tourbillon", "none"],
    "case_shape": "round|square|rectangular|tonneau|cushion",
    "strap_type": "metal_bracelet|leather|rubber|fabric|ceramic",
    "bezel_style": "smooth|fluted|diamond_set|ceramic",
    "crystal_type": "sapphire|mineral|acrylic"
  },
  "dimensions": {
    "estimated_width_mm": number,
    "estimated_height_mm": number
  },
  "design_elements": {
    "style": "modern|vintage|art_deco|minimalist|ornate|classic|bohemian|sports|dress",
    "patterns": ["filigree", "engraving", "milgrain", "rope", "cable", "guilloché", "none"],
    "symmetry": "symmetric|asymmetric",
    "complexity": "simple|moderate|intricate"
  },
  "unique_identifiers": "unique features including brand indicators, logo placement, signature design elements"
}

NOTE: If analyzing a WATCH, pay special attention to:
- Pearl/mother-of-pearl dial details
- Diamond-set bezel or indices
- Metal bracelet link patterns
- Crown and pusher designs
- Visible mechanical movement details

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

    // Build watch-specific details if applicable
    const watchDetails = analysisResult.watch_details || {};
    const watchDesc = analysisResult.type === 'watch' ? `
LUXURY WATCH SPECIFICATIONS:
- Dial: ${watchDetails.dial_color || 'classic'} ${watchDetails.dial_finish || ''} finish
- Case Shape: ${watchDetails.case_shape || 'round'}
- Bezel: ${watchDetails.bezel_style || 'smooth'}
- Strap/Bracelet: ${watchDetails.strap_type || 'metal_bracelet'}
- Crystal: ${watchDetails.crystal_type || 'sapphire'}
${watchDetails.complications?.length > 0 ? `- Complications: ${watchDetails.complications.join(', ')}` : ''}

WATCH CRAFTSMANSHIP PRESERVATION:
- Preserve exact dial details: indices, hands, sub-dials, date window
- Maintain precise bezel markings or diamond settings
- Keep crown and pusher positions and designs accurate
- Preserve metal bracelet link patterns or leather strap stitching
- Mother-of-pearl dial iridescence must be realistic (not painted glow)
- Diamond indices or bezel stones must follow the gemstone realism rules below
` : '';

    const fidelityBlock = `
JEWELRY SPECIFICATIONS (MUST BE PRESERVED EXACTLY):
- Type: ${analysisResult.type || 'jewelry piece'}
- Metal: ${metalDesc}
- Metal Color Category: ${metalColorCategory}
${metalColorHex ? `- Exact Metal Color Hex: ${metalColorHex}` : ''}
${stoneDesc ? `- Stones: ${stoneDesc}` : ''}
- Style: ${analysisResult.design_elements?.style || 'classic'}
${analysisResult.unique_identifiers ? `- Unique features: ${analysisResult.unique_identifiers}` : ''}
${watchDesc}
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

    // ═══════════════════════════════════════════════════════════════
    // RETOUCH PACKAGE: Professional photo retouching
    // ═══════════════════════════════════════════════════════════════
    if (isRetouchPackage) {
      console.log('Retouch Package: Professional photo enhancement...');
      
      const retouchPrompt = `
═══════════════════════════════════════════════════════════════
PROFESSIONAL JEWELRY PHOTO RETOUCH
═══════════════════════════════════════════════════════════════

You are operating as a professional high-end jewelry photo retoucher.
This is a PRECISION IMAGE ENHANCEMENT task, NOT creative generation.
The uploaded image is a real product photograph. Your task is to enhance it.

CORE RETOUCH PHILOSOPHY:
- Work like an experienced jewelry retoucher using Photoshop/Capture One workflows
- Goal: Clean, premium, realistic, commercially usable jewelry image
- Suitable for: luxury e-commerce, product catalogs, brand presentations

ABSOLUTE PRODUCT INTEGRITY RULES (CRITICAL):
- Do NOT change product geometry, proportions, or scale
- Do NOT add, remove, resize or reshape stones
- Do NOT modify stone count, cut, setting or prong structure
- Do NOT change metal structure, engravings or design language
- Do NOT invent or reconstruct missing parts
- Do NOT stylize, redesign or reinterpret the product
- The final output must be the EXACT SAME jewelry piece, only professionally retouched

BACKGROUND & MASKING:
- Isolate the jewelry using precision masking techniques
- Preserve all fine contours, curves and micro details
- Maintain inner cutouts (ring holes, chain gaps, openwork areas)
- Apply subtle anti-aliasing to avoid jagged edges or halos
- Apply a pure white background (RGB 255,255,255)
- Remove all shadows, reflections, stands, wires or supports
- The jewelry must appear fully isolated, clean and floating naturally

LIGHTING & COLOR CORRECTION:
- Correct white balance to reflect true material properties
  - Yellow gold: warm and natural, never orange or green
  - White gold/platinum: neutral to slightly cool
  - Rose gold: soft pink warmth without saturation excess
  - Silver: neutral and clean
- Simulate professional studio lighting from upper-left (10–11 o'clock)
- Soft, diffuse light with controlled highlights
- No harsh directional shadows
- Adjust tonal balance: subtle contrast increase, no blown highlights or crushed blacks
- Brightness slightly enhanced (+5–10%) while preserving detail

STONE ENHANCEMENT:
- Improve clarity while preserving natural inclusions
- Enhance facet definition and internal light paths
- Increase brilliance and fire subtly and realistically
- For colored stones: increase saturation by 20–30% within natural limits
- Maintain realistic refraction and depth
- Avoid artificial sparkle, glow or exaggerated refraction
- NEVER change stone shape, size, count or position

METAL SURFACE REFINEMENT:
- Remove dust, scratches, fingerprints and micro defects
- Preserve natural metal texture (polished, matte, brushed)
- Balance highlights and shadows to reveal form
- Enhance engravings or micro details without exaggeration
- Metal must look premium, clean and physically real
- Avoid mirror-like CGI reflections or plastic smoothness

EDGE & DETAIL CONTROL:
- Apply controlled sharpening exclusively to the jewelry
- Sharpening: Radius 0.5–1.0 px, Amount 120–150%
- Increase micro-contrast on fine details (+30–40)
- Prevent halos, ringing or oversharpening artifacts

TECHNICAL OUTPUT:
- Process in high-quality color depth
- Color profile: sRGB
- Maximum resolution from source
- No compression artifacts

FORBIDDEN:
- ❌ Redesign or artistic interpretation
- ❌ Cinematic or lifestyle styling
- ❌ Background scenes or environments
- ❌ Model hands/neck/ears
- ❌ CGI or 3D rendered look
- ❌ Changing any physical product attributes

FINAL QUALITY CHECK:
✓ Product identity fully preserved
✓ No geometry or design changes
✓ Clean white background
✓ Stones look premium but realistic
✓ Metal finish natural and detailed
✓ Suitable for e-commerce zoom
✓ No AI artifacts or plastic look

OUTPUT: Single professionally retouched jewelry image on pure white background.
`.trim();

      // Generate single retouched image
      const retouchUrl = await generateSingleImage(
        base64Images,
        retouchPrompt,
        userId,
        imageRecord.id,
        0,
        supabase
      );
      
      if (retouchUrl) {
        generatedUrls.push(retouchUrl);
        console.log('Retouch complete');
      } else {
        console.error('Retouch generation failed');
      }
    } else if (isMasterPackage) {
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

      // ═══════════════════════════════════════════════════════════════
      // CONSISTENCY OPTIMIZATION: Generate Editorial first (best consistency)
      // Then use Editorial as additional reference for E-commerce and Model Shot
      // ═══════════════════════════════════════════════════════════════

      // ═══════════════════════════════════════════════════════════════
      // DYNAMIC EDITORIAL BACKGROUNDS - Each generation gets a unique scene
      // ═══════════════════════════════════════════════════════════════
      const catalogBackgrounds = [
        {
          name: 'Carrara Marble Slab',
          prompt: 'jewelry resting on a luxurious Carrara white marble surface with subtle gray veining, soft shadows, natural stone texture, Italian marble countertop'
        },
        {
          name: 'Travertine Stone',
          prompt: 'jewelry placed on warm travertine stone surface, natural porous texture, beige-cream tones, Mediterranean luxury, natural daylight'
        },
        {
          name: 'Black Granite',
          prompt: 'jewelry on polished black granite surface with subtle golden or white flecks, dramatic contrast, luxury countertop, sophisticated backdrop'
        },
        {
          name: 'Raw Concrete',
          prompt: 'jewelry on raw concrete surface, minimalist industrial chic, subtle gray texture, soft shadows, architectural simplicity'
        },
        {
          name: 'Weathered Driftwood',
          prompt: 'jewelry arranged on weathered driftwood piece, natural wood grain texture, coastal luxury, organic forms, soft natural light'
        },
        {
          name: 'Cream Linen',
          prompt: 'jewelry draped on luxurious cream linen fabric with natural folds and texture, soft diffused light, editorial fabric styling'
        },
        {
          name: 'Slate Stone',
          prompt: 'jewelry on dark slate stone surface with natural layered texture, moody elegance, charcoal gray tones, subtle surface variation'
        },
        {
          name: 'Terracotta Tile',
          prompt: 'jewelry on aged terracotta tile surface, warm earthy tones, Mediterranean villa aesthetic, rustic luxury, natural patina'
        },
        {
          name: 'White Sand',
          prompt: 'jewelry resting on fine white sand surface, pristine beach aesthetic, soft granular texture, coastal luxury, natural shadows'
        },
        {
          name: 'Brushed Plaster Wall',
          prompt: 'jewelry against textured brushed plaster wall, soft cream or white, Mediterranean architecture, artisanal texture, gallery lighting'
        },
        {
          name: 'Onyx Surface',
          prompt: 'jewelry on translucent onyx stone surface, honey or white onyx with natural banding, backlit luxury, unique natural patterns'
        },
        {
          name: 'Velvet Cushion',
          prompt: 'jewelry on deep navy or burgundy velvet cushion, rich fabric texture, jeweler display aesthetic, soft shadows, luxury presentation'
        },
        {
          name: 'Aged Brass Tray',
          prompt: 'jewelry on aged brass decorative tray with patina, vintage luxury, warm metallic surface, editorial still life, antique charm'
        },
        {
          name: 'Seashell Arrangement',
          prompt: 'jewelry arranged among natural seashells and coral pieces, coastal editorial, ocean treasures, white and cream palette, organic composition'
        },
        {
          name: 'Rose Petals',
          prompt: 'jewelry scattered among fresh rose petals, romantic editorial, soft pink and cream tones, delicate floral backdrop, feminine luxury'
        },
        {
          name: 'Leather Surface',
          prompt: 'jewelry on premium tan or cognac leather surface, rich grain texture, luxury goods aesthetic, warm sophisticated backdrop'
        },
        {
          name: 'Eucalyptus Branch',
          prompt: 'jewelry placed near dried eucalyptus branches, organic minimalism, sage green and cream tones, botanical editorial, natural elegance'
        },
        {
          name: 'Water Droplets',
          prompt: 'jewelry on clear glass surface with water droplets, fresh morning dew aesthetic, crystal clarity, light refraction, pure luxury'
        },
        {
          name: 'Pebble Beach',
          prompt: 'jewelry on smooth river pebbles, natural stone collection, earth tones, zen minimalism, organic shapes and textures'
        },
        {
          name: 'Woven Rattan',
          prompt: 'jewelry on natural woven rattan or wicker surface, artisanal craft texture, warm organic material, bohemian luxury'
        },
        {
          name: 'Ice Block',
          prompt: 'jewelry on or near clear ice block, frozen luxury aesthetic, cool blues and whites, crystalline clarity, dramatic cold beauty'
        },
        {
          name: 'Raw Quartz Crystal',
          prompt: 'jewelry arranged with raw quartz crystal clusters, natural gemstone setting, prismatic light, mineral beauty, geological luxury'
        },
      ];

      // Randomly select one unique editorial background for this generation
      const randomCatalogBg = catalogBackgrounds[Math.floor(Math.random() * catalogBackgrounds.length)];
      console.log(`Selected random catalog background: ${randomCatalogBg.name}`);

      // Image 1 (PRIORITY): Editorial Luxury Scene - REFERENCE ANCHOR
      // This is generated first because it produces the most consistent results
      // and will be used as additional reference for subsequent generations
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

SCENE CONCEPT (UNIQUE EDITORIAL ENVIRONMENT):
- SELECTED SCENE: ${randomCatalogBg.name}
- SCENE DESCRIPTION: ${randomCatalogBg.prompt}
- The product must feel NATURALLY INTEGRATED into the scene — resting on, draped against, or nestled within the environment
- FORBIDDEN: Jewelry floating in air, staged/artificial placement, product hovering without physical contact, green fabric

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

      console.log('Step 1/3: Generating Editorial image (reference anchor)...');
      const catalogUrl = await generateSingleImage(base64Images, catalogPrompt, userId, imageRecord.id, 1, supabase);
      
      // Track editorial base64 for use as reference in subsequent generations
      let editorialReferenceBase64: string | null = null;
      
      if (catalogUrl) {
        generatedUrls.push(catalogUrl);
        await supabase.from('images').update({ generated_image_urls: [...generatedUrls] }).eq('id', imageRecord.id);
        console.log(`Progress: ${generatedUrls.length}/3 images completed`);
        
        // Fetch the editorial image to use as additional reference
        try {
          const editorialResponse = await fetch(catalogUrl);
          if (editorialResponse.ok) {
            const editorialBuffer = await editorialResponse.arrayBuffer();
            if (editorialBuffer.byteLength <= MAX_IMAGE_SIZE) {
              editorialReferenceBase64 = arrayBufferToBase64(editorialBuffer);
              console.log('Editorial image captured as reference for consistency');
            }
          }
        } catch (err) {
          console.warn('Could not fetch editorial as reference, continuing without:', err);
        }
      }

      // Build enhanced reference array: original + editorial (if available)
      const enhancedBase64Images = editorialReferenceBase64 
        ? [editorialReferenceBase64, ...base64Images] 
        : base64Images;
      
      console.log(`Using ${enhancedBase64Images.length} reference images for remaining generations`);

      // Image 2: E-commerce clean background (STRICT INPAINTING MODE)
      const ecommercePrompt = `[STRICT INPAINTING MODE - BACKGROUND REPLACEMENT ONLY]

This is NOT a regeneration task. This is a BACKGROUND REPLACEMENT task.
The jewelry object is FROZEN. Do NOT regenerate, reinterpret, or modify it in any way.

Professional e-commerce product photography. Ultra photorealistic. 4:5 portrait aspect ratio. 4K ultra-high resolution quality (3840x4800 pixels).

${productExtractionBlock}

${fidelityBlock}

═══════════════════════════════════════════════════════════════
⚠️⚠️⚠️ ABSOLUTE LOCK - PRODUCT FROZEN ⚠️⚠️⚠️
═══════════════════════════════════════════════════════════════

WHAT IS FROZEN (DO NOT TOUCH):
- ✔ Exact jewelry geometry and proportions
- ✔ Every stone position and count
- ✔ Every metal link/chain segment
- ✔ Pendant shape and drop angle
- ✔ Setting structure and prong positions
- ✔ Metal color, finish, and reflective properties
- ✔ All design elements exactly as reference

WHAT TO CHANGE (BACKGROUND ONLY):
- Background: ${selectedColor.prompt}
- Surface: matte, non-reflective
- Lighting: soft, diffused, neutral (no warm/cool bias affecting product)

⚠️ METAL COLOR IS LOCKED (ZERO TOLERANCE) ⚠️
- Original Metal: ${metalType.replace('_', ' ').toUpperCase()}
- Original Color Category: ${metalColorCategory.toUpperCase()}
${metalColorHex ? `- Original Metal Hex Reference: ${metalColorHex}` : ''}

STRICT INPAINTING RULES:
- Treat this as BACKGROUND INPAINTING, not image generation
- The jewelry pixels are SACRED - copy them exactly
- Only the background/environment pixels change
- NO metal recoloring (yellow↔white↔rose) under any circumstances
- NO whitewashing gold, NO gray neutralization, NO warm/cool shifting
- Background must be NON-METALLIC and MATTE to avoid color casts

SCENE: Clean, minimal e-commerce product shot
- The jewelry should be the absolute focal point
- Clean, uncluttered, listing-quality product photo
- Product centered, well-lit, commercially ready

OUTPUT QUALITY: Maximum resolution, ultra-sharp details, no compression artifacts.
Ultra high resolution output.`;

      console.log('Step 2/3: Generating E-commerce image...');
      const ecomUrl = await generateSingleImage(enhancedBase64Images, ecommercePrompt, userId, imageRecord.id, 2, supabase);
      if (ecomUrl) {
        generatedUrls.push(ecomUrl);
        await supabase.from('images').update({ generated_image_urls: [...generatedUrls] }).eq('id', imageRecord.id);
        console.log(`Progress: ${generatedUrls.length}/3 images completed`);
      }

      // Image 3: PRODUCT-FOCUSED LUXURY CLOSE-UP
      // Tight crop focused on jewelry worn on model, product occupies majority of frame
      
      // ═══════════════════════════════════════════════════════════════
      // DYNAMIC BACKGROUND VARIETY SYSTEM
      // Each generation selects a RANDOM editorial background to ensure uniqueness
      // ═══════════════════════════════════════════════════════════════
      // ═══════════════════════════════════════════════════════════════
      // REALISTIC EDITORIAL BACKGROUNDS - NO FANTASY/CGI/ARTIFICIAL SCENES
      // Only natural stone, luxury interiors, and simple elegant environments
      // ═══════════════════════════════════════════════════════════════
      const editorialBackgrounds = [
        // NATURAL STONE SURFACES (Primary - Most Realistic)
        {
          name: 'Carrara Marble',
          prompt: 'Polished Carrara marble surface with natural gray veining, soft neutral daylight, clean luxury backdrop, premium product photography'
        },
        {
          name: 'Travertine Stone',
          prompt: 'Warm travertine stone surface with natural cream and beige tones, soft shadows, Mediterranean elegance, refined understated backdrop'
        },
        {
          name: 'Black Volcanic Stone',
          prompt: 'Matte black volcanic stone surface, subtle natural texture, dramatic contrast backdrop for precious metals, bold editorial setting'
        },
        {
          name: 'White Onyx',
          prompt: 'Polished white onyx stone with subtle translucent veining, soft diffused light, minimal luxury aesthetic, premium product photography'
        },
        {
          name: 'Gray Slate',
          prompt: 'Natural gray slate surface with subtle layered texture, cool neutral tones, sophisticated minimal backdrop, editorial product photography'
        },
        {
          name: 'Concrete Smooth',
          prompt: 'Smooth polished concrete surface in soft gray, minimal industrial elegance, diffused natural light, modern luxury backdrop'
        },
        // LUXURY FABRIC SURFACES (Simple & Elegant)
        {
          name: 'Ivory Silk',
          prompt: 'Flowing ivory silk fabric with soft sculptural folds, warm studio lighting, timeless elegance, premium editorial photography'
        },
        {
          name: 'Deep Navy Velvet',
          prompt: 'Rich deep navy velvet fabric surface, subtle light play on texture, luxurious sophisticated backdrop, premium editorial setting'
        },
        {
          name: 'Natural Linen',
          prompt: 'Organic natural linen textile in warm beige tones, soft texture, diffused warm light, understated luxury aesthetic'
        },
        {
          name: 'Champagne Satin',
          prompt: 'Soft champagne satin fabric with gentle reflections, warm neutral tones, elegant sophisticated backdrop, luxury product photography'
        },
        // MINIMAL INTERIOR SETTINGS
        {
          name: 'White Gallery Wall',
          prompt: 'Clean white gallery wall with soft museum lighting, minimal architectural space, sophisticated art gallery aesthetic, premium backdrop'
        },
        {
          name: 'Warm Wood Surface',
          prompt: 'Polished warm walnut wood surface, natural grain visible, soft diffused light, understated organic luxury, product photography'
        },
        {
          name: 'Terrazzo Surface',
          prompt: 'Polished terrazzo surface with subtle stone chips in neutral tones, contemporary Italian design, minimal luxury backdrop'
        },
        // COASTAL STONE (Natural & Real)
        {
          name: 'Mediterranean Limestone',
          prompt: 'Natural Mediterranean limestone rock surface, warm cream and beige tones, soft coastal daylight, organic luxury setting, real stone texture'
        },
        {
          name: 'Coastal Pebbles',
          prompt: 'Smooth coastal pebbles in neutral gray and beige tones, natural beach setting, soft diffused daylight, organic minimal backdrop'
        },
        {
          name: 'Sea-worn Rock',
          prompt: 'Smooth sea-worn rock surface in warm neutral tones, natural coastal erosion texture, soft daylight, authentic Mediterranean setting'
        }
      ];
      
      // Randomly select a background for each generation
      const randomBackgroundIndex = Math.floor(Math.random() * editorialBackgrounds.length);
      const selectedBackground = editorialBackgrounds[randomBackgroundIndex];
      console.log(`Selected random editorial background: ${selectedBackground.name}`);
      
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
      } else if (productTypeUpper.includes('saat') || productTypeUpper.includes('watch')) {
        modelBodyPart = 'wrist and forearm';
        wearingDescription = 'elegantly worn on the wrist, watch face prominently displayed';
        framingDescription = 'TIGHT MACRO CROP on wrist showing watch face, dial details, and strap/bracelet craftsmanship - watch occupies 65% of frame';
        cameraLens = '100mm macro lens';
        scaleNote = 'Watch at natural wrist proportion, dial size matches reference exactly, strap/bracelet width accurate';
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

      const modelShotPrompt = `JEWELRY WORN BY A HUMAN MODEL - EDITORIAL CAMPAIGN PHOTOGRAPHY.
═══════════════════════════════════════════════════════════════
⚠️ MANDATORY: THIS IMAGE MUST SHOW A REAL HUMAN MODEL WEARING THE JEWELRY ⚠️
═══════════════════════════════════════════════════════════════

This is NOT a product-only shot. This is a MODEL SHOT where:
- A HUMAN MODEL must be VISIBLE and WEARING the jewelry
- The jewelry must be PHYSICALLY ON THE MODEL'S BODY (${modelBodyPart})
- The model's ${modelBodyPart} must be clearly visible in frame
- This simulates a luxury fashion campaign / lookbook photography

Commercial-grade luxury jewelry rendering engine.
Your primary objective is product fidelity first, aesthetics second, mood third.
Behave like a high-end jewelry photographer + retoucher, not an artist.

${productExtractionBlock}

${fidelityBlock}

═══════════════════════════════════════════════════════════════
PRIORITY ORDER (IMMUTABLE - HIGHER OVERRIDES LOWER):
1. PRODUCT ACCURACY (metal color, stone type, proportions)
2. REFERENCE IMAGE FIDELITY  
3. HUMAN MODEL PRESENCE (jewelry MUST be worn)
4. PHYSICAL REALISM
5. LIGHTING REALISM
6. EDITORIAL LUXURY MOOD
═══════════════════════════════════════════════════════════════

${earringConstraints}

═══════════════════════════════════════════════════════════════
⚠️ ABSOLUTE PRODUCT FIDELITY CONSTRAINTS (ZERO TOLERANCE) ⚠️
═══════════════════════════════════════════════════════════════

THE JEWELRY MUST REMAIN 100% IDENTICAL TO REFERENCE:

GEOMETRY LOCKED:
- ❌ NO stone enlargement or size changes
- ❌ NO stone cut modifications (round→princess, etc.)
- ❌ NO stone count changes (adding/removing stones)
- ❌ NO prong/setting structure alterations
- ❌ NO metal link/chain segment changes
- ❌ NO design element additions or removals
- ❌ NO proportion distortions

ANATOMY LOCKED:
- ❌ NO nail structure changes (shape, length, color)
- ❌ NO finger proportion distortions
- ❌ NO extra fingers or deformed anatomy
- Nails must be clean, neutral, non-distracting

ANY DEVIATION FROM REFERENCE PRODUCT = GENERATION FAILURE
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
- HUMAN MODEL'S ${modelBodyPart.toUpperCase()} MUST BE VISIBLE wearing the jewelry
- Product occupies majority of frame (60-80%) while model provides context
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

═══════════════════════════════════════════════════════════════
⚠️ UNIQUE EDITORIAL BACKGROUND (RANDOMLY SELECTED) ⚠️
═══════════════════════════════════════════════════════════════

BACKGROUND ENVIRONMENT: ${selectedBackground.name}
${selectedBackground.prompt}

BACKGROUND RULES:
- This background is UNIQUE to this generation
- Background must stay SECONDARY to the jewelry
- Background must be LOW-CONTRAST, not competing with product
- Background MUST NOT contaminate metal color through reflections
- Allowed elements: natural textures, architectural elements, organic materials, fabric
- Forbidden: busy patterns, high-saturation distracting colors, reflective metallic surfaces

DEPTH & SEPARATION:
- Background in natural soft bokeh (f/4-f/5.6 depth)
- Clear visual separation between product and background
- Background tones can complement but never overpower jewelry
- Product is ALWAYS the sharpest, most detailed element

═══════════════════════════════════════════════════════════════

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

      console.log('Step 3/3: Generating Model Shot image...');
      const modelUrl = await generateSingleImage(enhancedBase64Images, modelShotPrompt, userId, imageRecord.id, 3, supabase);
      if (modelUrl) {
        generatedUrls.push(modelUrl);
        await supabase.from('images').update({ generated_image_urls: [...generatedUrls] }).eq('id', imageRecord.id);
        console.log(`Progress: ${generatedUrls.length}/3 images completed`);
      }

    } else if (hasStyleReference && styleReferenceBase64) {
      // STYLE REFERENCE MODE: Transfer product to user's style reference
      console.log('Style reference generation mode...');
      
      // Build product type specific placement instructions
      const productTypePlacement: Record<string, { bodyPart: string; placement: string; removal: string }> = {
        'yuzuk': { 
          bodyPart: 'hand/finger', 
          placement: 'Place the ring on the finger in the exact position shown in the style reference. The ring must be worn naturally on the finger.',
          removal: 'Remove any existing rings, bands, or finger jewelry from the style reference model before placing the new ring.'
        },
        'bileklik': { 
          bodyPart: 'wrist', 
          placement: 'Place the bracelet on the wrist exactly as shown in the style reference. The bracelet must wrap naturally around the wrist.',
          removal: 'Remove any existing bracelets, bangles, watches, or wrist accessories from the style reference model before placing the new bracelet.'
        },
        'kupe': { 
          bodyPart: 'ear', 
          placement: 'Place the earring on the ear in the position shown in the style reference. If only one ear is visible, render only ONE earring (not a pair).',
          removal: 'Remove any existing earrings, ear cuffs, or ear piercings from the style reference model before placing the new earring.'
        },
        'kolye': { 
          bodyPart: 'neck/décolletage', 
          placement: 'Place the necklace around the neck/décolletage area as shown in the style reference. The necklace must drape naturally.',
          removal: 'Remove any existing necklaces, pendants, chains, or neck jewelry from the style reference model before placing the new necklace.'
        },
        'gerdanlik': { 
          bodyPart: 'neck/collar', 
          placement: 'Place the choker/statement necklace at the collar/neck area as shown in the style reference. It must sit naturally against the skin.',
          removal: 'Remove any existing chokers, collar necklaces, or neck accessories from the style reference model before placing the new piece.'
        },
        'piercing': { 
          bodyPart: 'ear/body', 
          placement: 'Place the piercing jewelry in the appropriate piercing location as shown in the style reference.',
          removal: 'Remove any existing piercings or piercing jewelry from the target location in the style reference before placing the new piercing.'
        },
        'saat': {
          bodyPart: 'wrist',
          placement: 'Place the luxury watch on the wrist exactly as shown in the style reference. The watch must wrap naturally around the wrist with the dial face clearly visible and readable. Show the craftsmanship of the strap or metal bracelet.',
          removal: 'Remove any existing watches, bracelets, bangles, or wrist accessories from the style reference model before placing the new watch.'
        },
      };

      const selectedPlacement = productTypePlacement[productType] || {
        bodyPart: 'appropriate body part',
        placement: 'Place the jewelry on the model in the natural position for this type of jewelry.',
        removal: 'Remove any existing jewelry or accessories from the target body part before placing the new jewelry.'
      };

      const styleTransferPrompt = `[STYLE REFERENCE TRANSFER - PRODUCT INJECTION MODE]

You are a commercial-grade luxury jewelry rendering engine.
Your task: TRANSFER the jewelry product from the PRODUCT REFERENCE image(s) INTO the STYLE REFERENCE scene.

═══════════════════════════════════════════════════════════════
⚠️ CRITICAL PRE-PROCESSING STEP: ACCESSORY REMOVAL ⚠️
═══════════════════════════════════════════════════════════════

BEFORE placing the new jewelry, you MUST:
1. IDENTIFY any existing jewelry, accessories, or adornments on the style reference model
2. REMOVE all existing jewelry from the target body part: ${selectedPlacement.bodyPart}
3. ${selectedPlacement.removal}
4. The model should appear "jewelry-free" on the target area BEFORE the new product is placed

REMOVAL CHECKLIST (execute before placement):
- ❌ Remove ALL existing rings, bracelets, necklaces, earrings, piercings
- ❌ Remove watches, bangles, chains, pendants
- ❌ Remove any decorative accessories on the target body part
- ❌ The model's ${selectedPlacement.bodyPart} must be CLEAN before new jewelry placement
- ✔ Preserve the model's natural skin, pose, and appearance
- ✔ Keep the lighting, scene, and atmosphere intact

═══════════════════════════════════════════════════════════════
⚠️ DUAL-IMAGE INPUT INTERPRETATION ⚠️
═══════════════════════════════════════════════════════════════

IMAGE 1 (STYLE REFERENCE - THE TARGET):
- This is the POSE, SCENE, LIGHTING, and ATMOSPHERE reference
- Copy the composition, camera angle, body position, environment
- If a model is present → output MUST have a model in similar pose
- FIRST: Remove any existing jewelry from the model (see removal step above)
- THEN: Place the new product from Image 2+
- The STYLE/MOOD of this image is the target

IMAGE 2+ (PRODUCT REFERENCE - THE SOURCE):
- This contains the JEWELRY PRODUCT to transfer
- Extract the jewelry with 100% fidelity
- Every stone, metal link, setting, and detail must be preserved
- This jewelry must appear in the final output EXACTLY as shown

═══════════════════════════════════════════════════════════════
⚠️ PRODUCT TYPE SPECIFIC PLACEMENT ⚠️
═══════════════════════════════════════════════════════════════

PRODUCT TYPE: ${productType?.toUpperCase() || 'JEWELRY'}
TARGET BODY PART: ${selectedPlacement.bodyPart.toUpperCase()}

PLACEMENT INSTRUCTION:
${selectedPlacement.placement}

CRITICAL PLACEMENT RULES:
- The product MUST be placed on the correct body part for its type
- Product placement must look NATURAL and physically accurate
- The jewelry must interact realistically with the model's body
- Proper shadows, occlusion, and contact points required
- Scale must be proportional to the body part

═══════════════════════════════════════════════════════════════
⚠️ STYLE TRANSFER RULES ⚠️
═══════════════════════════════════════════════════════════════

FROM STYLE REFERENCE (COPY):
✔ Pose and body position
✔ Camera angle and framing
✔ Lighting direction and quality
✔ Scene/environment atmosphere
✔ Color grading and mood
✔ Model characteristics (if present)
✔ Model's natural appearance (after removing existing jewelry)

FROM PRODUCT REFERENCE (PRESERVE 100%):
✔ Exact jewelry geometry and proportions
✔ Every stone position, count, and cut
✔ Metal color, finish, and texture
✔ All design elements and details
✔ Chain/link structure (if applicable)
✔ Setting and prong positions

${productExtractionBlock}

${fidelityBlock}

═══════════════════════════════════════════════════════════════
⚠️ ABSOLUTE PRODUCT FIDELITY (ZERO TOLERANCE) ⚠️
═══════════════════════════════════════════════════════════════

THE JEWELRY MUST REMAIN 100% IDENTICAL TO PRODUCT REFERENCE:

GEOMETRY LOCKED:
- ❌ NO stone enlargement or size changes
- ❌ NO stone cut modifications
- ❌ NO stone count changes
- ❌ NO prong/setting structure alterations
- ❌ NO metal link/chain segment changes
- ❌ NO design element additions or removals
- ❌ NO proportion distortions

ANATOMY LOCKED (if model present):
- ❌ NO nail structure changes
- ❌ NO finger proportion distortions
- ❌ NO extra fingers or deformed anatomy

EARRING SPECIAL RULE:
- If product type is EARRING and only ONE ear is visible → render only ONE earring
- NEVER render two earrings on the same ear
- One ear = One piercing = One earring (Absolute Constraint)

═══════════════════════════════════════════════════════════════

TECHNICAL REQUIREMENTS:
- 4:5 portrait aspect ratio (4K resolution: 3840x4800 pixels)
- Ultra photorealistic rendering
- Jewelry must be the sharpest element in frame
- Natural lighting matching the style reference
- Accurate metal reflections and gemstone refractions

PROCESS SUMMARY:
1. Analyze style reference for pose, lighting, scene
2. REMOVE existing jewelry from model's ${selectedPlacement.bodyPart}
3. Place the new product on the ${selectedPlacement.bodyPart}
4. Ensure natural integration with proper shadows and reflections
5. Output final image with new jewelry worn naturally

CINEMATIC RENDERING GLOBAL LOCKS:
- cinematic_soft_diffusion = subtle
- skin_texture = real (if model present)
- forbid = plastic skin, CGI glow, jewelry modifications, existing accessories
- jewelry_focus_priority = maximum

Ultra high resolution output.`;

      // Combine style reference with product images: style first, then products
      const styleTransferImages = [styleReferenceBase64, ...base64Images];
      
      console.log(`Generating with style transfer: ${styleTransferImages.length} images (1 style + ${base64Images.length} product)`);
      console.log(`Product type: ${productType}, Target body part: ${selectedPlacement.bodyPart}`);
      const url = await generateSingleImage(styleTransferImages, styleTransferPrompt, userId, imageRecord.id, 1, supabase);
      if (url) generatedUrls.push(url);
      
    } else {
    // STANDARD: Single image with scene
      console.log('Standard generation with scene...');
      
      // Check if this is a model (manken) category scene - requires human model in output
      const isModelScene = scene?.category === 'manken';
      
      // For model scenes, inject mandatory model presence instructions
      const modelSceneEnforcement = isModelScene ? `
═══════════════════════════════════════════════════════════════
⚠️⚠️⚠️ MANDATORY: THIS IMAGE MUST SHOW A REAL HUMAN MODEL WEARING THE JEWELRY ⚠️⚠️⚠️
═══════════════════════════════════════════════════════════════

This is NOT a product-only shot. This is a MODEL SHOT where:
- A HUMAN MODEL must be VISIBLE and WEARING the jewelry
- The jewelry must be PHYSICALLY ON THE MODEL'S BODY
- The model must be clearly visible in frame
- This simulates a luxury fashion campaign / lookbook photography

MODEL REQUIREMENTS:
- Real human model with natural skin texture (visible pores, micro-texture)
- Age range 23-35, editorial fashion model appearance
- Expression calm, confident, editorial - NOT commercial/posed
- Skin rendering: NO plastic, waxy, or beauty-filtered appearance
- FEMALE BODY HAIR: Ultra-fine, nearly invisible vellus hair only
- Natural imperfections allowed: subtle freckles, micro color variations

FORBIDDEN (MODEL SCENE):
- ❌ Product-only output without visible model
- ❌ Standalone jewelry on surface/background
- ❌ Floating product without human context
- ❌ Plastic/CGI skin appearance
- ❌ Beauty filter or over-retouching

THE OUTPUT MUST CONTAIN A HUMAN MODEL WEARING THE JEWELRY.
IF NO MODEL IS VISIBLE = GENERATION FAILURE.
═══════════════════════════════════════════════════════════════
` : '';

      // Product fidelity enforcement block - prevents alterations
      const productFidelityEnforcement = `
═══════════════════════════════════════════════════════════════
⚠️ ABSOLUTE PRODUCT FIDELITY CONSTRAINTS (ZERO TOLERANCE) ⚠️
═══════════════════════════════════════════════════════════════

THE JEWELRY MUST REMAIN 100% IDENTICAL TO REFERENCE:

GEOMETRY LOCKED:
- ❌ NO stone enlargement or size changes
- ❌ NO stone cut modifications (round→princess, etc.)
- ❌ NO stone count changes (adding/removing stones)
- ❌ NO prong/setting structure alterations
- ❌ NO metal link/chain segment changes
- ❌ NO design element additions or removals
- ❌ NO proportion distortions

ANATOMY LOCKED (if model present):
- ❌ NO nail structure changes (shape, length, color)
- ❌ NO finger proportion distortions
- ❌ NO extra fingers or deformed anatomy
- ❌ Nails must be clean, neutral, non-distracting

SCALE PRESERVATION:
- Jewelry must appear at NATURAL PROPORTIONS relative to body/environment
- If reference shows delicate/thin piece → output MUST be delicate/thin
- If reference shows substantial/bold piece → output MUST be substantial/bold
- NEVER scale up jewelry beyond reference dimensions

ANY DEVIATION FROM REFERENCE PRODUCT = GENERATION FAILURE
═══════════════════════════════════════════════════════════════
`;

      const standardPrompt = `Professional luxury jewelry photography. Ultra photorealistic. 4:5 portrait aspect ratio. 4K quality.

${productExtractionBlock}

${fidelityBlock}

${productFidelityEnforcement}

${modelSceneEnforcement}

SCENE PLACEMENT:
${scene?.prompt || 'Elegant luxury setting with soft studio lighting, premium background.'}

CINEMATIC RENDERING GLOBAL LOCKS:
- cinematic_soft_diffusion = subtle
- skin_texture = real (visible pores, micro-texture)
- forbid = plastic skin, CGI glow, fashion pose, jewelry modifications
- jewelry_focus_priority = maximum

TECHNICAL REQUIREMENTS:
- Ultra high resolution 4K output (3840x4800 pixels minimum)
- Macro photography quality with perfect focus
- Natural soft studio lighting with subtle highlights
- Accurate metal reflections and gemstone refractions
- The jewelry must look IDENTICAL to the reference
- NO stone enlargement, NO nail changes, NO stone cut modifications

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
