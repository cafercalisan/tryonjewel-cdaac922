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

// Timeout for each image generation (4 minutes = 240000ms)
const IMAGE_GENERATION_TIMEOUT = 240000;

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

// Helper: Create timeout promise
function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
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
        maxOutputTokens: 8192,
        // CRITICAL: Request 4K resolution output from Gemini
        imageConfig: {
          imageSize: "4K"
        }
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

// ═══════════════════════════════════════════════════════════════
// GENERATE SINGLE IMAGE WITH TIMEOUT AND RETRY
// Wraps generateSingleImage with 4 minute timeout and 1 retry
// ═══════════════════════════════════════════════════════════════
async function generateSingleImageWithTimeout(
  base64Images: string[],
  prompt: string,
  userId: string,
  imageRecordId: string,
  index: number,
  supabase: any,
  imageName: string
): Promise<{ success: boolean; url: string | null; error?: string }> {
  const maxRetries = 1;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`${imageName}: Attempt ${attempt + 1}/${maxRetries + 1} starting...`);
      
      // Race between generation and timeout
      const result = await Promise.race([
        generateSingleImage(base64Images, prompt, userId, imageRecordId, index, supabase),
        timeout(IMAGE_GENERATION_TIMEOUT)
      ]);
      
      if (result) {
        console.log(`${imageName}: Success on attempt ${attempt + 1}`);
        return { success: true, url: result };
      } else {
        console.error(`${imageName}: No result on attempt ${attempt + 1}`);
        if (attempt < maxRetries) {
          console.log(`${imageName}: Retrying...`);
          continue;
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`${imageName}: Error on attempt ${attempt + 1}: ${errMsg}`);
      
      if (attempt < maxRetries) {
        console.log(`${imageName}: Retrying after error...`);
        continue;
      }
      
      return { success: false, url: null, error: errMsg };
    }
  }
  
  return { success: false, url: null, error: 'Max retries exceeded' };
}

// ═══════════════════════════════════════════════════════════════
// BACKGROUND PROCESSING WORKER
// This function runs asynchronously after the main response is sent
// ═══════════════════════════════════════════════════════════════
async function processJobInBackground(params: {
  jobId: string;
  imageRecordId: string;
  userId: string;
  imagePaths: string[];
  packageType: string;
  sceneId: string | null;
  colorId: string | null;
  productType: string | null;
  modelId: string | null;
  metalColorOverride: string | null;
  styleReferencePath: string | null;
  retouchAngle: number | null;
  retouchSurface: string | null;
  creditsNeeded: number;
  isAdminUser: boolean;
}) {
  const {
    jobId,
    imageRecordId,
    userId,
    imagePaths,
    packageType,
    sceneId,
    colorId,
    productType,
    modelId,
    metalColorOverride,
    styleReferencePath,
    retouchAngle,
    retouchSurface,
    creditsNeeded,
    isAdminUser,
  } = params;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Track failed images for partial refund
  const failedImageIndices: number[] = [];
  
  const updateJobProgress = async (updates: {
    status?: string;
    progress?: number;
    current_step?: string;
    completed_images?: number;
    result_urls?: string[];
    error_message?: string;
    refunded?: boolean;
    partial_refund_amount?: number;
    failed_image_indices?: number[];
  }) => {
    await supabase
      .from('processing_jobs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', jobId);
  };

  try {
    // Update status to analyzing
    await updateJobProgress({
      status: 'analyzing',
      progress: 5,
      current_step: 'Ürün analiz ediliyor...',
    });

    // Get signed URLs for all images
    const imageUrls: string[] = [];
    for (const path of imagePaths) {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('jewelry-images')
        .createSignedUrl(path, 3600);
      
      if (!signedUrlError && signedUrlData?.signedUrl) {
        imageUrls.push(signedUrlData.signedUrl);
      }
    }

    if (imageUrls.length === 0) {
      throw new Error('Failed to access images');
    }

    // Fetch and convert all images to base64
    const base64Images: string[] = [];
    for (const url of imageUrls) {
      const imageResponse = await fetch(url);
      const imageBuffer = await imageResponse.arrayBuffer();
      
      if (imageBuffer.byteLength <= MAX_IMAGE_SIZE) {
        base64Images.push(arrayBufferToBase64(imageBuffer));
      }
    }

    if (base64Images.length === 0) {
      throw new Error('All images too large. Max 1.5MB each.');
    }

    const base64Image = base64Images[0];

    // Get style reference if provided
    let styleReferenceBase64: string | null = null;
    if (styleReferencePath) {
      const { data: styleSignedData } = await supabase.storage
        .from('jewelry-images')
        .createSignedUrl(styleReferencePath, 3600);
      
      if (styleSignedData?.signedUrl) {
        try {
          const styleResponse = await fetch(styleSignedData.signedUrl);
          const styleBuffer = await styleResponse.arrayBuffer();
          if (styleBuffer.byteLength <= MAX_IMAGE_SIZE) {
            styleReferenceBase64 = arrayBufferToBase64(styleBuffer);
          }
        } catch (err) {
          console.error('Failed to fetch style reference:', err);
        }
      }
    }

    // Get scene if provided
    let scene = null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (sceneId && uuidRegex.test(sceneId)) {
      const { data: sceneData } = await supabase
        .from('scenes')
        .select('*')
        .eq('id', sceneId)
        .single();
      scene = sceneData;
    }

    // Analyze jewelry
    await updateJobProgress({
      progress: 10,
      current_step: 'AI mücevheri analiz ediyor...',
    });

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

    // Update image record with analysis
    await supabase
      .from('images')
      .update({ status: 'generating', analysis_data: analysisResult })
      .eq('id', imageRecordId);

    await updateJobProgress({
      status: 'generating',
      progress: 15,
      current_step: 'Görseller oluşturuluyor...',
    });

    // Build fidelity block with STRONG metal color preservation
    const metalColorOverrideMap: Record<string, { type: string; category: string }> = {
      'yellow_gold': { type: 'gold', category: 'YELLOW GOLD' },
      'white_gold': { type: 'white_gold', category: 'WHITE GOLD' },
      'rose_gold': { type: 'rose_gold', category: 'ROSE GOLD' },
      'platinum': { type: 'platinum', category: 'PLATINUM' },
      'silver': { type: 'silver', category: 'SILVER' },
    };

    const userMetalOverride = metalColorOverride ? metalColorOverrideMap[metalColorOverride] : null;
    const metalType = userMetalOverride?.type || analysisResult.metal?.type || 'gold';
    const metalFinish = analysisResult.metal?.finish || 'polished';
    const metalKarat = analysisResult.metal?.karat || '18k';
    const metalColorHex = analysisResult.metal?.color_hex || '';
    
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
    
    console.log('Metal color decision:', { 
      userOverride: metalColorOverride, 
      finalType: metalType, 
      finalCategory: metalColorCategory,
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

    // PRODUCT EXTRACTION MODE
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
    const isMasterPackage = packageType === 'master';
    const isRetouchPackage = packageType === 'retouch';
    const totalImages = isMasterPackage ? 3 : (isRetouchPackage ? 2 : 1);

    // ═══════════════════════════════════════════════════════════════
    // RETOUCH PACKAGE
    // ═══════════════════════════════════════════════════════════════
    if (isRetouchPackage) {
      console.log('Retouch Package: Professional photo enhancement with dual output...');
      
      const surfaceMap: Record<string, { name: string; promptBg: string }> = {
        'reflective-black': {
          name: 'Lüks Siyah',
          promptBg: 'pure black background (#000000), luxurious highly reflective black glass surface with realistic jewelry reflections, dramatic product photography, premium e-commerce'
        },
        'reflective-white': {
          name: 'Standart Beyaz',
          promptBg: 'pure white background (RGB 255,255,255), seamless studio backdrop, clean isolated product, professional e-commerce standard'
        },
        'marble': {
          name: 'Mermer',
          promptBg: 'luxurious white Carrara marble surface with subtle gray veining, polished reflective marble with product reflection, Italian marble countertop, premium product photography'
        },
        'velvet': {
          name: 'Kadife',
          promptBg: 'deep dark purple velvet fabric surface, luxurious jewelry presentation, soft fabric texture with subtle folds, premium jewelry display'
        }
      };

      const selectedSurface = surfaceMap[retouchSurface || 'reflective-white'] || surfaceMap['reflective-white'];
      const cameraAngle = retouchAngle || 15;
      
      const buildRetouchPrompt = (bgType: 'black' | 'white') => {
        const bgPrompt = bgType === 'black' 
          ? surfaceMap['reflective-black'].promptBg
          : selectedSurface.promptBg;
          
        return `
═══════════════════════════════════════════════════════════════
PROFESSIONAL JEWELRY PHOTO RETOUCH - ${bgType.toUpperCase()} BACKGROUND VERSION
═══════════════════════════════════════════════════════════════

You are operating as a professional high-end jewelry photo retoucher.
This is a PRECISION IMAGE ENHANCEMENT task, NOT creative generation.
The uploaded image is a real product photograph. Your task is to enhance it.

CAMERA ANGLE SPECIFICATION:
- Apply a ${cameraAngle}° camera angle view
- 0° = directly from above (bird's eye view)
- 45° = diagonal side view
- 90° = straight front view
- Maintain product proportions while adjusting perspective

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

BACKGROUND & SURFACE:
${bgPrompt}
- Isolate the jewelry using precision masking techniques
- Preserve all fine contours, curves and micro details
- Maintain inner cutouts (ring holes, chain gaps, openwork areas)
- Apply subtle anti-aliasing to avoid jagged edges or halos
${bgType === 'black' ? '- The jewelry should have realistic reflections on the glossy black surface' : '- Remove all shadows, reflections, stands, wires or supports'}
- The jewelry must appear clean and presented professionally

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

FORBIDDEN:
- ❌ Redesign or artistic interpretation
- ❌ Cinematic or lifestyle styling
- ❌ Model hands/neck/ears
- ❌ CGI or 3D rendered look
- ❌ Changing any physical product attributes

FINAL QUALITY CHECK:
✓ Product identity fully preserved
✓ No geometry or design changes
✓ ${bgType === 'black' ? 'Luxurious black reflective background' : 'Clean professional background'}
✓ Stones look premium but realistic
✓ Metal finish natural and detailed
✓ Suitable for e-commerce zoom
✓ No AI artifacts or plastic look

OUTPUT: Single professionally retouched jewelry image on ${bgType} background.
`.trim();
      };

      // Generate BLACK background version first
      await updateJobProgress({
        progress: 25,
        current_step: 'Siyah arka plan versiyonu oluşturuluyor (1/2)...',
        completed_images: 0,
      });
      
      const blackResult = await generateSingleImageWithTimeout(
        base64Images,
        buildRetouchPrompt('black'),
        userId,
        imageRecordId,
        0,
        supabase,
        'Retouch Black BG'
      );
      
      if (blackResult.success && blackResult.url) {
        generatedUrls.push(blackResult.url);
        await supabase
          .from('images')
          .update({ generated_image_urls: [...generatedUrls] })
          .eq('id', imageRecordId);
          
        await updateJobProgress({
          progress: 55,
          current_step: 'Beyaz arka plan versiyonu oluşturuluyor (2/2)...',
          completed_images: 1,
          result_urls: [...generatedUrls],
        });
      } else {
        failedImageIndices.push(0);
        await updateJobProgress({
          progress: 55,
          current_step: 'Siyah versiyon başarısız, beyaz versiyona geçiliyor (2/2)...',
          completed_images: 0,
        });
      }
      
      // Generate WHITE/CUSTOM background version
      const whiteResult = await generateSingleImageWithTimeout(
        base64Images,
        buildRetouchPrompt('white'),
        userId,
        imageRecordId,
        1,
        supabase,
        'Retouch White BG'
      );
      
      if (whiteResult.success && whiteResult.url) {
        generatedUrls.push(whiteResult.url);
      } else {
        failedImageIndices.push(1);
      }
    } 
    // ═══════════════════════════════════════════════════════════════
    // MASTER PACKAGE
    // ═══════════════════════════════════════════════════════════════
    else if (isMasterPackage) {
      console.log('Master Package: Generating 3 images with timeout protection...');

      const colorMap: Record<string, { name: string; prompt: string }> = {
        'white': { name: 'Beyaz', prompt: 'matte seamless paper backdrop, soft off-white, clean ivory (NON-METALLIC)' },
        'cream': { name: 'Krem', prompt: 'matte seamless paper backdrop, warm cream, soft ivory, delicate beige-white (NON-METALLIC)' },
        'blush': { name: 'Pudra Pembe', prompt: 'matte seamless paper backdrop, soft blush pink, pale dusty rose (NON-METALLIC)' },
        'lavender': { name: 'Lavanta', prompt: 'matte seamless paper backdrop, soft lavender, pale muted violet (NON-METALLIC)' },
        'mint': { name: 'Nane Yeşili', prompt: 'matte seamless paper backdrop, soft mint, pale sage, gentle seafoam (NON-METALLIC)' },
        'skyblue': { name: 'Gök Mavisi', prompt: 'matte seamless paper backdrop, soft sky blue, pale powder blue (NON-METALLIC)' },
        'peach': { name: 'Şeftali', prompt: 'matte seamless paper backdrop, soft peach, gentle apricot, muted coral tint (NON-METALLIC)' },
        'champagne': { name: 'Şampanya', prompt: 'matte seamless paper backdrop, warm champagne-beige, soft nude, elegant sand (NON-METALLIC)' },
        'silver': { name: 'Gümüş', prompt: 'matte seamless paper backdrop, cool light gray, pale dove gray, soft neutral gray (NON-METALLIC)' },
        'gray': { name: 'Gri', prompt: 'matte seamless paper backdrop, soft dove gray, gentle stone gray, neutral warm gray (NON-METALLIC)' },
      };

      const selectedColor = colorMap[colorId || 'white'] || colorMap['white'];

      // Dynamic editorial backgrounds
      const catalogBackgrounds = [
        { name: 'Carrara Marble Slab', prompt: 'jewelry resting on a luxurious Carrara white marble surface with subtle gray veining, soft shadows, natural stone texture, Italian marble countertop' },
        { name: 'Travertine Stone', prompt: 'jewelry placed on warm travertine stone surface, natural porous texture, beige-cream tones, Mediterranean luxury, natural daylight' },
        { name: 'Black Granite', prompt: 'jewelry on polished black granite surface with subtle golden or white flecks, dramatic contrast, luxury countertop, sophisticated backdrop' },
        { name: 'Raw Concrete', prompt: 'jewelry on raw concrete surface, minimalist industrial chic, subtle gray texture, soft shadows, architectural simplicity' },
        { name: 'Cream Linen', prompt: 'jewelry draped on luxurious cream linen fabric with natural folds and texture, soft diffused light, editorial fabric styling' },
        { name: 'Slate Stone', prompt: 'jewelry on dark slate stone surface with natural layered texture, moody elegance, charcoal gray tones, subtle surface variation' },
        { name: 'White Sand', prompt: 'jewelry resting on fine white sand surface, pristine beach aesthetic, soft granular texture, coastal luxury, natural shadows' },
        { name: 'Velvet Cushion', prompt: 'jewelry on deep navy or burgundy velvet cushion, rich fabric texture, jeweler display aesthetic, soft shadows, luxury presentation' },
        { name: 'Rose Petals', prompt: 'jewelry scattered among fresh rose petals, romantic editorial, soft pink and cream tones, delicate floral backdrop, feminine luxury' },
        { name: 'Water Droplets', prompt: 'jewelry on clear glass surface with water droplets, fresh morning dew aesthetic, crystal clarity, light refraction, pure luxury' },
      ];

      const randomCatalogBg = catalogBackgrounds[Math.floor(Math.random() * catalogBackgrounds.length)];
      console.log(`Selected random catalog background: ${randomCatalogBg.name}`);

      // ─── IMAGE 1: Editorial Luxury Scene ───
      await updateJobProgress({
        progress: 20,
        current_step: 'Lüks katalog görseli oluşturuluyor (1/3)...',
        completed_images: 0,
      });

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
- ENVIRONMENT: ${randomCatalogBg.prompt}
- Editorial luxury photography style
- Soft directional lighting from upper-left
- Natural shadows and depth
- Premium catalog quality

COMPOSITION:
- Product dominant in frame (70-80%)
- Elegant negative space
- Natural integration with surface
- Premium e-commerce aesthetic

OUTPUT QUALITY: Maximum resolution, ultra-sharp details, no compression artifacts.
Ultra high resolution output.`;

      const catalogResult = await generateSingleImageWithTimeout(
        base64Images,
        catalogPrompt,
        userId,
        imageRecordId,
        1,
        supabase,
        'Master Catalog'
      );

      if (catalogResult.success && catalogResult.url) {
        generatedUrls.push(catalogResult.url);
        await supabase
          .from('images')
          .update({ generated_image_urls: [...generatedUrls] })
          .eq('id', imageRecordId);
        
        await updateJobProgress({
          progress: 40,
          current_step: 'E-ticaret görseli oluşturuluyor (2/3)...',
          completed_images: 1,
          result_urls: [...generatedUrls],
        });
      } else {
        failedImageIndices.push(0);
        await updateJobProgress({
          progress: 40,
          current_step: 'Katalog görseli başarısız, e-ticaret görseline geçiliyor (2/3)...',
          completed_images: 0,
        });
      }

      // ─── IMAGE 2: Clean E-Commerce ───
      const ecomPrompt = `Professional e-commerce product photography. Ultra photorealistic. 4:5 portrait aspect ratio. 4K ultra-high resolution quality (3840x4800 pixels).

${productExtractionBlock}

${fidelityBlock}

TASK TYPE (CRITICAL): CLEAN E-COMMERCE PRODUCT SHOT
- This is a PURE PRODUCT IMAGE for online retail
- Background: ${selectedColor.prompt}
- NO lifestyle elements, NO props, NO contextual styling

⚠️ METAL COLOR IS LOCKED (ZERO TOLERANCE) ⚠️
- Original Metal: ${metalType.replace('_', ' ').toUpperCase()}
- Original Color Category: ${metalColorCategory.toUpperCase()}
${metalColorHex ? `- Original Metal Hex Reference: ${metalColorHex}` : ''}

[STRICT INPAINTING] PRODUCT ISOLATION PROTOCOL:
1. Extract ONLY the jewelry from reference
2. FREEZE all jewelry pixels - no modification allowed
3. Place on clean, solid-color paper backdrop
4. Soft diffused studio lighting
5. Minimal natural shadow for depth

BACKGROUND REQUIREMENTS:
- Color: ${selectedColor.name} (${selectedColor.prompt})
- MATTE paper texture - NO metallic or reflective surfaces
- Seamless, even lighting
- NO gradients, patterns or textures that could contaminate metal color

COMPOSITION:
- Product centered, hero framing
- Clean negative space
- Professional e-commerce standard
- Ready for web/catalog use

OUTPUT QUALITY: Maximum resolution, ultra-sharp details, no compression artifacts.
Ultra high resolution output.`;

      const ecomResult = await generateSingleImageWithTimeout(
        base64Images,
        ecomPrompt,
        userId,
        imageRecordId,
        2,
        supabase,
        'Master E-commerce'
      );

      if (ecomResult.success && ecomResult.url) {
        generatedUrls.push(ecomResult.url);
        await supabase
          .from('images')
          .update({ generated_image_urls: [...generatedUrls] })
          .eq('id', imageRecordId);
        
        await updateJobProgress({
          progress: 65,
          current_step: 'Model çekimi oluşturuluyor (3/3)...',
          completed_images: generatedUrls.length,
          result_urls: [...generatedUrls],
        });
      } else {
        failedImageIndices.push(1);
        await updateJobProgress({
          progress: 65,
          current_step: 'E-ticaret görseli başarısız, model çekimine geçiliyor (3/3)...',
          completed_images: generatedUrls.length,
        });
      }

      // ─── IMAGE 3: Model Shot ───
      // Get model if selected
      let modelPromptAddition = '';
      if (modelId) {
        const { data: modelData } = await supabase
          .from('user_models')
          .select('*')
          .eq('id', modelId)
          .single();
        
        if (modelData) {
          modelPromptAddition = `
CHARACTER DNA (MUST MATCH EXACTLY):
- Gender: ${modelData.gender}
- Ethnicity: ${modelData.ethnicity}
- Age Range: ${modelData.age_range}
- Skin Tone: ${modelData.skin_tone}
- Skin Undertone: ${modelData.skin_undertone}
- Hair Color: ${modelData.hair_color}
- Hair Texture: ${modelData.hair_texture}
${modelData.face_shape ? `- Face Shape: ${modelData.face_shape}` : ''}
${modelData.eye_color ? `- Eye Color: ${modelData.eye_color}` : ''}
${modelData.expression ? `- Expression: ${modelData.expression}` : ''}
${modelData.hair_style ? `- Hair Style: ${modelData.hair_style}` : ''}

This model must appear EXACTLY as described above. Match all physical attributes precisely.`;
        }
      }

      // Use previous successful images as reference for consistency
      const enhancedBase64Images = [...base64Images];
      
      const editorialBackgrounds = [
        { name: 'Minimal Studio', prompt: 'clean minimal photography studio, soft gray gradient backdrop, professional fashion lighting, editorial simplicity' },
        { name: 'Natural Light Window', prompt: 'soft natural window light, bright airy interior, subtle warm tones, organic editorial mood' },
        { name: 'Architectural Detail', prompt: 'modern architectural interior, concrete or marble elements, sophisticated neutral tones, high-end editorial' },
        { name: 'Soft Focus Garden', prompt: 'blurred garden background, soft bokeh greenery, natural daylight, romantic editorial outdoor' },
        { name: 'Urban Chic', prompt: 'urban setting with soft focus cityscape, sophisticated metropolitan mood, editorial fashion context' },
      ];

      const randomEditorialBg = editorialBackgrounds[Math.floor(Math.random() * editorialBackgrounds.length)];

      const modelPrompt = `PRODUCT-FOCUSED LUXURY CLOSE-UP WITH MODEL. Ultra photorealistic. 4:5 portrait aspect ratio. 4K ultra-high resolution quality (3840x4800 pixels).

${productExtractionBlock}

${fidelityBlock}

═══════════════════════════════════════════════════════════════
COMPOSITION: PRODUCT-DOMINATED TIGHT CROP
═══════════════════════════════════════════════════════════════

FRAMING PRIORITY:
- JEWELRY = 70-80% of frame area (DOMINANT)
- MODEL = 20-30% of frame (supporting context only)
- This is a PRODUCT SHOT with model, NOT a fashion portrait

CROP GUIDELINES:
- Macro/close-up distance to jewelry
- Model's face may be partially cropped or out of focus
- Only show relevant body part (hand, neck, ear, wrist depending on jewelry type)
- Background: ${randomEditorialBg.prompt}

${modelPromptAddition || `MODEL (if visible):
- Female, age 25-35, editorial beauty
- Natural skin with visible texture (pores, micro-details)
- Neutral or soft expression
- Hair and makeup minimal, sophisticated
- NO heavy makeup, NO glossy skin, NO beauty filter look`}

SKIN & ANATOMY REQUIREMENTS:
- Real human skin texture (visible pores, subtle imperfections)
- NO plastic, waxy, or CGI skin
- Natural body proportions
- Anatomically correct hands (5 fingers, natural proportions)
- NO distorted or extra limbs

⚠️ METAL COLOR IS LOCKED (ZERO TOLERANCE) ⚠️
- Original Metal: ${metalType.replace('_', ' ').toUpperCase()}
- Original Color Category: ${metalColorCategory.toUpperCase()}
${metalColorHex ? `- Original Metal Hex Reference: ${metalColorHex}` : ''}

LIGHTING:
- Soft directional light emphasizing jewelry details
- Model skin lit naturally but not the focus
- Jewelry facets catch light realistically
- No harsh shadows on product

OUTPUT QUALITY: Maximum resolution, ultra-sharp details, no compression artifacts.
Ultra high resolution output.`;

      const modelResult = await generateSingleImageWithTimeout(
        enhancedBase64Images,
        modelPrompt,
        userId,
        imageRecordId,
        3,
        supabase,
        'Master Model Shot'
      );

      if (modelResult.success && modelResult.url) {
        generatedUrls.push(modelResult.url);
      } else {
        failedImageIndices.push(2);
      }
    }
    // ═══════════════════════════════════════════════════════════════
    // STANDARD PACKAGE (Single Image with Scene)
    // ═══════════════════════════════════════════════════════════════
    else {
      await updateJobProgress({
        progress: 30,
        current_step: 'Görsel oluşturuluyor...',
        completed_images: 0,
      });

      // Check if this is a model scene
      const isModelScene = scene?.category === 'manken';
      
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

SCALE PRESERVATION:
- Jewelry must appear at NATURAL PROPORTIONS relative to body/environment
- If reference shows delicate/thin piece → output MUST be delicate/thin
- If reference shows substantial/bold piece → output MUST be substantial/bold
- NEVER scale up jewelry beyond reference dimensions

ANY DEVIATION FROM REFERENCE PRODUCT = GENERATION FAILURE
═══════════════════════════════════════════════════════════════
`;

      // If style reference is used, build custom prompt
      let standardPrompt: string;
      
      if (styleReferenceBase64) {
        standardPrompt = `Professional luxury jewelry photography using style reference. Ultra photorealistic. 4:5 portrait aspect ratio. 4K quality.

${productExtractionBlock}

${fidelityBlock}

${productFidelityEnforcement}

STYLE REFERENCE MODE:
- A style reference image is provided
- Match the LIGHTING, MOOD, COMPOSITION, and ATMOSPHERE of the style reference
- The JEWELRY from the product image must be placed in the STYLE of the reference
- DO NOT copy the jewelry from the style reference
- ONLY use the style reference for environmental and lighting guidance

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

Ultra high resolution output.`;

        // Add style reference to images array
        base64Images.unshift(styleReferenceBase64);
      } else {
        standardPrompt = `Professional luxury jewelry photography. Ultra photorealistic. 4:5 portrait aspect ratio. 4K quality.

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
      }

      const result = await generateSingleImageWithTimeout(
        base64Images,
        standardPrompt,
        userId,
        imageRecordId,
        1,
        supabase,
        'Standard Image'
      );
      
      if (result.success && result.url) {
        generatedUrls.push(result.url);
      } else {
        failedImageIndices.push(0);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // RESULT EVALUATION & PARTIAL REFUND
    // ═══════════════════════════════════════════════════════════════
    const successCount = generatedUrls.length;
    const failCount = failedImageIndices.length;
    
    console.log(`Generation complete: ${successCount}/${totalImages} successful, ${failCount} failed`);

    // Calculate partial refund
    let partialRefundAmount = 0;
    if (!isAdminUser && failCount > 0 && successCount > 0) {
      // Partial success - refund proportionally
      const creditPerImage = Math.floor(creditsNeeded / totalImages);
      partialRefundAmount = creditPerImage * failCount;
      
      console.log(`Partial refund: ${partialRefundAmount} credits for ${failCount} failed images`);
      await supabase.rpc('refund_credits', { _user_id: userId, _amount: partialRefundAmount });
    }

    // Check results
    if (generatedUrls.length === 0) {
      // Total failure - refund all credits
      if (!isAdminUser) {
        console.log('Generation failed, refunding all credits...');
        await supabase.rpc('refund_credits', { _user_id: userId, _amount: creditsNeeded });
      }

      await supabase
        .from('images')
        .update({ status: 'failed', error_message: 'Görsel oluşturulamadı' })
        .eq('id', imageRecordId);

      await updateJobProgress({
        status: 'failed',
        progress: 100,
        current_step: 'Görsel oluşturulamadı',
        error_message: 'Görsel oluşturma başarısız oldu. Kredileriniz iade edildi.',
        refunded: !isAdminUser,
        failed_image_indices: failedImageIndices,
      });
      return;
    }

    // Update image record with success (partial or full)
    await supabase
      .from('images')
      .update({
        status: 'completed',
        generated_image_urls: generatedUrls,
      })
      .eq('id', imageRecordId);

    // Build completion message
    let completionMessage = 'Tamamlandı!';
    if (failCount > 0) {
      completionMessage = `${successCount}/${totalImages} görsel oluşturuldu. ${partialRefundAmount} kredi iade edildi.`;
    }

    // Update job as completed
    await updateJobProgress({
      status: 'completed',
      progress: 100,
      current_step: completionMessage,
      completed_images: generatedUrls.length,
      result_urls: generatedUrls,
      partial_refund_amount: partialRefundAmount,
      failed_image_indices: failedImageIndices,
      refunded: partialRefundAmount > 0,
    });

    console.log('Background processing complete:', generatedUrls.length, 'images, refund:', partialRefundAmount);

  } catch (error) {
    console.error('Background processing error:', error);
    
    // Refund credits on error
    if (!isAdminUser) {
      await supabase.rpc('refund_credits', { _user_id: userId, _amount: creditsNeeded });
    }

    await supabase
      .from('images')
      .update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Unknown error' })
      .eq('id', imageRecordId);

    await updateJobProgress({
      status: 'failed',
      progress: 100,
      current_step: 'Hata oluştu',
      error_message: error instanceof Error ? error.message : 'Beklenmeyen bir hata oluştu',
      refunded: !isAdminUser,
      failed_image_indices: failedImageIndices,
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN REQUEST HANDLER - Fast Response + Background Processing
// ═══════════════════════════════════════════════════════════════
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
    const { imagePath, additionalImagePaths, sceneId, packageType, colorId, productType, modelId, metalColorOverride, styleReferencePath, retouchAngle, retouchSurface } = await req.json();
    console.log('Generate request:', { imagePath, sceneId, packageType, userId });

    // Validate imagePath
    if (!imagePath || typeof imagePath !== 'string' || !imagePath.startsWith(`${userId}/originals/`)) {
      return new Response(
        JSON.stringify({ error: 'Invalid image path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate additional image paths
    const validAdditionalPaths: string[] = [];
    if (Array.isArray(additionalImagePaths)) {
      for (const path of additionalImagePaths) {
        if (typeof path === 'string' && path.startsWith(`${userId}/originals/`)) {
          validAdditionalPaths.push(path);
        }
      }
    }

    const hasStyleReference = styleReferencePath && typeof styleReferencePath === 'string' && styleReferencePath.startsWith(`${userId}/style-references/`);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isMasterPackage = packageType === 'master';
    const isRetouchPackage = packageType === 'retouch';
    
    if (!isMasterPackage && !hasStyleReference && !isRetouchPackage && (!sceneId || !uuidRegex.test(sceneId))) {
      return new Response(
        JSON.stringify({ error: 'Invalid scene ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check admin status
    const { data: isAdmin } = await supabase
      .rpc('has_role', { _user_id: userId, _role: 'admin' });
    
    const isAdminUser = isAdmin === true;
    console.log(`User ${userId} admin status: ${isAdminUser}`);

    // Calculate credits needed
    const creditsNeeded = isMasterPackage ? 20 : (isRetouchPackage ? 20 : 10);
    const totalImages = isMasterPackage ? 3 : (isRetouchPackage ? 2 : 1);

    // Deduct credits (skip for admin)
    if (!isAdminUser) {
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
      console.log('Admin user - skipping credit deduction');
    }

    // Create image record
    const { data: imageRecord, error: insertError } = await supabase
      .from('images')
      .insert({
        user_id: userId,
        scene_id: sceneId || null,
        original_image_url: imagePath,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Create processing job
    const { data: jobRecord, error: jobError } = await supabase
      .from('processing_jobs')
      .insert({
        user_id: userId,
        status: 'pending',
        progress: 0,
        current_step: 'İşlem kuyruğuna alındı...',
        total_images: totalImages,
        completed_images: 0,
        image_record_id: imageRecord.id,
        result_urls: [],
        credits_used: creditsNeeded,
      })
      .select()
      .single();

    if (jobError) throw jobError;

    console.log('Created job:', jobRecord.id, 'for image:', imageRecord.id);

    // Start background processing using EdgeRuntime.waitUntil
    const backgroundTask = processJobInBackground({
      jobId: jobRecord.id,
      imageRecordId: imageRecord.id,
      userId,
      imagePaths: [imagePath, ...validAdditionalPaths],
      packageType,
      sceneId,
      colorId,
      productType,
      modelId,
      metalColorOverride,
      styleReferencePath: hasStyleReference ? styleReferencePath : null,
      retouchAngle,
      retouchSurface,
      creditsNeeded,
      isAdminUser,
    });

    // Use EdgeRuntime.waitUntil to run in background after response
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(backgroundTask);
    } else {
      // Fallback: run without waitUntil (may timeout for long operations)
      backgroundTask.catch(err => console.error('Background task error:', err));
    }

    // Return immediately with job info
    return new Response(
      JSON.stringify({ 
        success: true, 
        jobId: jobRecord.id,
        imageId: imageRecord.id,
        message: 'İşlem başlatıldı. Görseller arka planda oluşturuluyor...'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Handler error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Beklenmeyen bir hata oluştu' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
