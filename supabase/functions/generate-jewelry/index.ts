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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_GEN_MODEL}:generateContent?key=${GOOGLE_IMAGE_API_KEY}`;
  
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
        imageConfig: {
          aspectRatio: '3:4',
          imageSize: '4K',
        },
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

// ═══════════════════════════════════════════════════════════════
// SEEDREAM 4.5 (V2 BETA) - BytePlus ModelArk Image Generation
// ═══════════════════════════════════════════════════════════════
const BYTEPLUS_ARK_BASE_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3';
const SEEDREAM_MODEL = 'seedream-4-5-251128';

async function callSeedreamImageGeneration({
  imageUrls,
  prompt,
  size = '2K',
}: {
  imageUrls?: string[];
  prompt: string;
  size?: string;
}): Promise<string | null> {
  const BYTEPLUS_ARK_API_KEY = Deno.env.get('BYTEPLUS_ARK_API_KEY');
  if (!BYTEPLUS_ARK_API_KEY) {
    console.error('Missing BYTEPLUS_ARK_API_KEY');
    return null;
  }

  const body: any = {
    model: SEEDREAM_MODEL,
    prompt,
    size,
    response_format: 'url',
    watermark: false,
  };

  // Add image reference(s) for image-to-image
  if (imageUrls && imageUrls.length > 0) {
    body.image = imageUrls.length === 1 ? imageUrls[0] : imageUrls;
    body.sequential_image_generation = 'disabled';
  }

  const resp = await fetch(`${BYTEPLUS_ARK_BASE_URL}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BYTEPLUS_ARK_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`Seedream API error (${resp.status}):`, errText);
    return null;
  }

  const data = await resp.json();
  const resultUrl = data?.data?.[0]?.url;
  if (!resultUrl) {
    console.error('Seedream API returned no image URL');
    return null;
  }

  return resultUrl;
}

// Generate single image using Seedream and upload to storage
async function generateSingleImageSeedream(
  imageUrls: string[],
  prompt: string,
  userId: string,
  imageRecordId: string,
  index: number,
  supabase: any
): Promise<string | null> {
  try {
    const resultUrl = await callSeedreamImageGeneration({ imageUrls, prompt });
    if (!resultUrl) return null;

    // Download the generated image from Seedream's URL
    const imgResp = await fetch(resultUrl);
    if (!imgResp.ok) {
      console.error(`Failed to download Seedream result: ${imgResp.status}`);
      return null;
    }

    const imageBuffer = new Uint8Array(await imgResp.arrayBuffer());
    const filePath = `${userId}/generated/${imageRecordId}-v2-${index}.png`;

    const { error: uploadError } = await supabase.storage
      .from('jewelry-images')
      .upload(filePath, imageBuffer, { contentType: 'image/png' });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('jewelry-images')
      .createSignedUrl(filePath, 7 * 24 * 60 * 60);

    if (!signedUrlError && signedUrlData?.signedUrl) {
      console.log(`Seedream image ${index} uploaded successfully`);
      return signedUrlData.signedUrl;
    }

    return null;
  } catch (error) {
    console.error(`Seedream generation ${index} error:`, error);
    return null;
  }
}

// Generate single image and return signed URL
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
            const { data: signedUrlData, error: signedUrlError } = await supabase.storage
              .from('jewelry-images')
              .createSignedUrl(filePath, 7 * 24 * 60 * 60);
            
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
        // Clear part data to free memory
        part.inlineData.data = null;
        break;
      }
    }

    if (!generatedImage) {
      console.error('No image in generation response');
      return null;
    }

    // Convert and upload, then immediately free the base64 string
    const imageBuffer = Uint8Array.from(atob(generatedImage), (c) => c.charCodeAt(0));
    generatedImage = null; // Free ~20MB+ of base64 string memory
    
    const filePath = `${userId}/generated/${imageRecordId}-${index}.png`;
    const { error: uploadError } = await supabase.storage
      .from('jewelry-images')
      .upload(filePath, imageBuffer, { contentType: 'image/png' });

    if (!uploadError) {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('jewelry-images')
        .createSignedUrl(filePath, 7 * 24 * 60 * 60);
      
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
// BACKGROUND PROCESSING FUNCTION
// This runs inside EdgeRuntime.waitUntil() after the response is sent
// ═══════════════════════════════════════════════════════════════
async function processGenerationInBackground(params: {
  userId: string;
  imageRecordId: string;
  jobId: string;
  imagePaths: string[];
  validAdditionalPaths: string[];
  sceneId: string | null;
  packageType: string;
  colorId: string | null;
  productType: string | null;
  modelId: string | null;
  metalColorOverride: string | null;
  styleReferencePath: string | null;
  creditsNeeded: number;
  isAdminUser: boolean;
  modelVersion: string;
  stepIndex: number;
}) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const {
    userId, imageRecordId, jobId, imagePaths, validAdditionalPaths,
    sceneId, packageType, colorId, productType, modelId,
    metalColorOverride, styleReferencePath, creditsNeeded, isAdminUser,
    modelVersion, stepIndex
  } = params;
  
  const isMasterPackage = packageType === 'master';
  // Use the model version selected by the user: V1=Gemini, V2=Seedream
  const useV2ForGeneration = modelVersion === 'v2';
  console.log(`Using model: Analysis=Gemini, Generation=${useV2ForGeneration ? 'Seedream 4.5' : 'Gemini 3 Pro'}, Package=${packageType}`);

  const isRetouchPackage = packageType === 'retouch';
  const totalImages = isMasterPackage ? 3 : 1;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Helper: generate image using the appropriate model
  // Master always uses Seedream (URL-based, memory efficient)
  // Standard/Retouch respects user's V1/V2 choice
  async function generateImage(
    base64Imgs: string[],
    signedUrls: string[],
    prompt: string,
    idx: number
  ): Promise<string | null> {
    if (useV2ForGeneration) {
      return generateSingleImageSeedream(signedUrls, prompt, userId, imageRecordId, idx, supabase);
    } else {
      return generateSingleImage(base64Imgs, prompt, userId, imageRecordId, idx, supabase);
    }
  }

  try {
    // Update job: started
    await supabase.from('processing_jobs').update({
      status: 'generating',
      current_step: 'downloading',
      started_at: new Date().toISOString(),
      progress: 5,
    }).eq('id', jobId);

    // Get signed URLs for all images
    const allImagePaths = [imagePaths[0], ...validAdditionalPaths];
    const imageUrls: string[] = [];
    
    for (const path of allImagePaths) {
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

    // Check if style reference is provided
    const hasStyleReference = styleReferencePath && typeof styleReferencePath === 'string' && styleReferencePath.startsWith(`${userId}/style-references/`);
    let styleReferenceBase64: string | null = null;
    
    if (hasStyleReference) {
      const { data: styleSignedData, error: styleSignedError } = await supabase.storage
        .from('jewelry-images')
        .createSignedUrl(styleReferencePath!, 3600);
      
      if (!styleSignedError && styleSignedData?.signedUrl) {
        try {
          const styleResponse = await fetch(styleSignedData.signedUrl);
          const styleBuffer = await styleResponse.arrayBuffer();
          if (styleBuffer.byteLength <= MAX_IMAGE_SIZE) {
            styleReferenceBase64 = arrayBufferToBase64(styleBuffer);
            console.log('Style reference converted to base64');
          }
        } catch (err) {
          console.error('Failed to fetch style reference:', err);
        }
      }
    }

    // Get scene if needed
    let scene: any = null;
    if (!hasStyleReference && sceneId && uuidRegex.test(sceneId)) {
      const { data: sceneData } = await supabase
        .from('scenes')
        .select('*')
        .eq('id', sceneId)
        .single();
      scene = sceneData;
    }

    // Fetch and convert all images to base64
    await supabase.from('processing_jobs').update({
      current_step: 'analyzing',
      progress: 10,
    }).eq('id', jobId);

    const base64Images: string[] = [];
    // Only convert the FIRST image to base64 to minimize memory usage
    // Additional images are only used via signed URLs for V2
    const firstUrl = imageUrls[0];
    const imageResponse = await fetch(firstUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    if (imageBuffer.byteLength <= MAX_IMAGE_SIZE) {
      base64Images.push(arrayBufferToBase64(imageBuffer));
    }

    if (base64Images.length === 0) {
      throw new Error('Image too large. Max 1.5MB.');
    }

    const base64Image = base64Images[0];

    // ═══════════════════════════════════════════════════════════════
    // ANALYZE JEWELRY
    // ═══════════════════════════════════════════════════════════════
    console.log('Step 1: Analyzing jewelry...');
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

    // Update image record with analysis
    await supabase
      .from('images')
      .update({ status: 'generating', analysis_data: analysisResult })
      .eq('id', imageRecordId);

    await supabase.from('processing_jobs').update({
      current_step: 'generating',
      progress: 20,
    }).eq('id', jobId);

    // Free base64 input memory if using Seedream (URL-based generation doesn't need it)
    if (useV2ForGeneration) {
      base64Images.length = 0;
      console.log('Freed base64 input memory (Seedream uses URLs)');
    }

    // ═══════════════════════════════════════════════════════════════
    // BUILD FIDELITY BLOCK
    // ═══════════════════════════════════════════════════════════════
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

THE OUTPUT MUST CONTAIN:
- ✔ ONLY the jewelry piece detected in the image
- ✔ Accurate geometry, proportions, stone placement, metal structure
- ✔ Neutralized reference orientation (product isolated)

The jewelry must be reconstructed as a STANDALONE OBJECT, as if scanned in a vacuum.

═══════════════════════════════════════════════════════════════
STAGE 2 — SCENE APPLICATION
═══════════════════════════════════════════════════════════════

Using the ISOLATED jewelry object:
- Place the product into the selected scene
- Lighting, background, camera, and composition must be defined ONLY by the scene prompt
- The product's intrinsic properties (metal color, stone type, design) are preserved
═══════════════════════════════════════════════════════════════
`.trim();

    const watchDetails = analysisResult.watch_details || {};
    const watchDesc = analysisResult.type === 'watch' ? `
LUXURY WATCH SPECIFICATIONS:
- Dial: ${watchDetails.dial_color || 'classic'} ${watchDetails.dial_finish || ''} finish
- Case Shape: ${watchDetails.case_shape || 'round'}
- Bezel: ${watchDetails.bezel_style || 'smooth'}
- Strap/Bracelet: ${watchDetails.strap_type || 'metal_bracelet'}
- Crystal: ${watchDetails.crystal_type || 'sapphire'}
${watchDetails.complications?.length > 0 ? `- Complications: ${watchDetails.complications.join(', ')}` : ''}
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
- If the original is WHITE GOLD/PLATINUM/SILVER → output MUST be WHITE/SILVER metal
- If the original is ROSE GOLD → output MUST be ROSE GOLD (pinkish golden hue)
- NEVER convert yellow gold to white gold or vice versa

CRITICAL FIDELITY REQUIREMENTS:
1. EXACT metal color - THIS IS THE MOST IMPORTANT RULE
2. EXACT stone count - no more, no less
3. EXACT setting structure and prong positions
4. EXACT metal surface finish (${metalFinish})
5. EXACT proportions - do not resize
6. EXACT design elements - preserve all patterns
7. Natural realistic scale

DIAMOND AND GEMSTONE REALISM (CRITICAL):
- Real diamond light behavior: fire, brilliance, scintillation
- Authentic internal light refraction patterns
- Natural inclusions visible in realistic diamonds
- Depth and three-dimensionality inside the stone
- No artificial HDR glow, no CGI-like perfection

FORBIDDEN:
- ❌ CHANGING METAL COLOR - ABSOLUTELY FORBIDDEN
- ❌ No text, watermarks, logos
- ❌ No design alterations
- ❌ No additional jewelry pieces
- ❌ No artificial CGI gemstones
`.trim();

    const generatedUrls: string[] = [];

    // ═══════════════════════════════════════════════════════════════
    // GENERATION LOGIC (same as before but with job progress updates)
    // ═══════════════════════════════════════════════════════════════
    
    if (isRetouchPackage) {
      console.log('Retouch Package: Professional photo enhancement...');
      
      const retouchPrompt = `
═══════════════════════════════════════════════════════════════
PROFESSIONAL JEWELRY PHOTO RETOUCH
═══════════════════════════════════════════════════════════════

You are operating as a professional high-end jewelry photo retoucher.
This is a PRECISION IMAGE ENHANCEMENT task, NOT creative generation.

CORE RETOUCH PHILOSOPHY:
- Work like an experienced jewelry retoucher using Photoshop/Capture One workflows
- Goal: Clean, premium, realistic, commercially usable jewelry image

ABSOLUTE PRODUCT INTEGRITY RULES (CRITICAL):
- Do NOT change product geometry, proportions, or scale
- Do NOT add, remove, resize or reshape stones
- Do NOT modify stone count, cut, setting or prong structure
- Do NOT change metal structure, engravings or design language

BACKGROUND & MASKING:
- Isolate the jewelry using precision masking techniques
- Apply a pure white background (RGB 255,255,255)
- Remove all shadows, reflections, stands, wires or supports

LIGHTING & COLOR CORRECTION:
- Correct white balance to reflect true material properties
- Simulate professional studio lighting from upper-left (10–11 o'clock)
- Soft, diffuse light with controlled highlights

STONE ENHANCEMENT:
- Improve clarity while preserving natural inclusions
- Enhance facet definition and internal light paths
- Avoid artificial sparkle, glow or exaggerated refraction
- NEVER change stone shape, size, count or position

METAL SURFACE REFINEMENT:
- Remove dust, scratches, fingerprints and micro defects
- Preserve natural metal texture (polished, matte, brushed)
- Metal must look premium, clean and physically real

OUTPUT: Single professionally retouched jewelry image on pure white background.
Ultra high resolution output.`.trim();

      const retouchUrl = await generateImage(base64Images, imageUrls, retouchPrompt, 0);
      
      if (retouchUrl) {
        generatedUrls.push(retouchUrl);
        console.log('Retouch complete');
      }

      await supabase.from('processing_jobs').update({
        completed_images: generatedUrls.length,
        progress: 90,
      }).eq('id', jobId);

    } else if (isMasterPackage) {
      console.log(`Master Package step ${stepIndex}/2: Generating image...`);

      // Read existing URLs for continuation steps
      let existingUrls: string[] = [];
      if (stepIndex > 0) {
        const { data: jd } = await supabase.from('processing_jobs').select('result_urls').eq('id', jobId).single();
        existingUrls = Array.isArray(jd?.result_urls) ? jd.result_urls as string[] : [];
      }

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

      // Catalog backgrounds for editorial shot
      const catalogBackgrounds = [
        { name: 'Carrara Marble Slab', prompt: 'jewelry resting on a luxurious Carrara white marble surface with subtle gray veining, soft shadows, natural stone texture' },
        { name: 'Travertine Stone', prompt: 'jewelry placed on warm travertine stone surface, natural porous texture, beige-cream tones, Mediterranean luxury' },
        { name: 'Black Granite', prompt: 'jewelry on polished black granite surface with subtle golden or white flecks, dramatic contrast' },
        { name: 'Raw Concrete', prompt: 'jewelry on raw concrete surface, minimalist industrial chic, subtle gray texture' },
        { name: 'Cream Linen', prompt: 'jewelry draped on luxurious cream linen fabric with natural folds and texture, soft diffused light' },
        { name: 'Slate Stone', prompt: 'jewelry on dark slate stone surface with natural layered texture, moody elegance' },
        { name: 'White Sand', prompt: 'jewelry resting on fine white sand surface, pristine beach aesthetic, soft granular texture' },
        { name: 'Velvet Cushion', prompt: 'jewelry on deep navy or burgundy velvet cushion, rich fabric texture, jeweler display aesthetic' },
        { name: 'Rose Petals', prompt: 'jewelry scattered among fresh rose petals, romantic editorial, soft pink and cream tones' },
        { name: 'Water Droplets', prompt: 'jewelry on clear glass surface with water droplets, fresh morning dew aesthetic, crystal clarity' },
        { name: 'Raw Quartz Crystal', prompt: 'jewelry arranged with raw quartz crystal clusters, natural gemstone setting, prismatic light' },
      ];

      const randomCatalogBg = catalogBackgrounds[Math.floor(Math.random() * catalogBackgrounds.length)];
      console.log(`Selected catalog background: ${randomCatalogBg.name}`);

      // ═══════════════════════════════════════════════════════════
      // IMAGE 1: Editorial Luxury Scene (reference anchor)
      // ═══════════════════════════════════════════════════════════
      const catalogPrompt = `High-end luxury fashion editorial photography. Ultra photorealistic. 4:5 portrait aspect ratio. 4K ultra-high resolution quality.

${productExtractionBlock}

${fidelityBlock}

TASK TYPE: EDITORIAL SCENE INTEGRATION WITHOUT ALTERING THE JEWELRY
- The jewelry (especially metal color) must remain exactly as reference.
- Product must be INTEGRATED into the scene, NOT staged or floating in air.

⚠️ METAL COLOR IS LOCKED (ZERO TOLERANCE) ⚠️
- Original Metal: ${metalType.replace('_', ' ').toUpperCase()}
- Original Color Category: ${metalColorCategory.toUpperCase()}
${metalColorHex ? `- Original Metal Hex Reference: ${metalColorHex}` : ''}

SCENE CONCEPT:
- SELECTED SCENE: ${randomCatalogBg.name}
- SCENE DESCRIPTION: ${randomCatalogBg.prompt}
- Product must feel NATURALLY INTEGRATED into the scene

CAMERA & COMPOSITION:
- Lens: 85–100mm, slightly low or side-angled
- Composition: Asymmetrical but balanced, editorial negative space
- Focus: Razor-sharp on jewelry with natural depth of field

OUTPUT QUALITY: Maximum resolution, ultra-sharp details.
Ultra high resolution output.`;

      if (stepIndex === 0) {
        console.log('Step 0: Generating Editorial image...');
        const catalogUrl = await generateImage(base64Images, imageUrls, catalogPrompt, 1);
        
        if (catalogUrl) {
          generatedUrls.push(catalogUrl);
          existingUrls.push(catalogUrl);
          await supabase.from('images').update({ generated_image_urls: existingUrls }).eq('id', imageRecordId);
        }
        await supabase.from('processing_jobs').update({
          status: generatedUrls.length > 0 ? 'step_0_done' : 'failed',
          completed_images: existingUrls.length,
          progress: 90,
          result_urls: existingUrls,
          current_step: generatedUrls.length > 0 ? 'step_0_done' : 'failed',
          ...(generatedUrls.length === 0 ? { error_message: 'Editorial görsel oluşturulamadı' } : {}),
        }).eq('id', jobId);
      }

      // ═══════════════════════════════════════════════════════════
      // IMAGE 2: E-commerce clean background
      // ═══════════════════════════════════════════════════════════
      const ecommercePrompt = `[STRICT INPAINTING MODE - BACKGROUND REPLACEMENT ONLY]
Professional e-commerce product photography. Ultra photorealistic. 4:5 portrait aspect ratio.

${productExtractionBlock}

${fidelityBlock}

WHAT IS FROZEN (DO NOT TOUCH):
- ✔ Exact jewelry geometry and proportions
- ✔ Every stone position and count
- ✔ Metal color, finish, and reflective properties
- ✔ All design elements exactly as reference

WHAT TO CHANGE (BACKGROUND ONLY):
- Background: ${selectedColor.prompt}
- Surface: matte, non-reflective
- Lighting: soft, diffused, neutral

⚠️ METAL COLOR IS LOCKED (ZERO TOLERANCE) ⚠️
- Original Metal: ${metalType.replace('_', ' ').toUpperCase()}
- Original Color Category: ${metalColorCategory.toUpperCase()}

SCENE: Clean, minimal e-commerce product shot.
OUTPUT QUALITY: Maximum resolution, ultra-sharp details.
Ultra high resolution output.`;

      if (stepIndex === 1) {
        console.log('Step 1: Generating E-commerce image...');
        const ecomUrl = await generateImage(base64Images, imageUrls, ecommercePrompt, 2);
        if (ecomUrl) {
          generatedUrls.push(ecomUrl);
          existingUrls.push(ecomUrl);
          await supabase.from('images').update({ generated_image_urls: existingUrls }).eq('id', imageRecordId);
        }
        await supabase.from('processing_jobs').update({
          status: generatedUrls.length > 0 ? 'step_1_done' : 'failed',
          completed_images: existingUrls.length,
          progress: 90,
          result_urls: existingUrls,
          current_step: generatedUrls.length > 0 ? 'step_1_done' : 'failed',
          ...(generatedUrls.length === 0 ? { error_message: 'E-ticaret görsel oluşturulamadı' } : {}),
        }).eq('id', jobId);
      }

      // ═══════════════════════════════════════════════════════════
      // IMAGE 3: Model shot
      // ═══════════════════════════════════════════════════════════
      const editorialBackgrounds = [
        { name: 'Carrara Marble', prompt: 'Polished Carrara marble surface with natural gray veining, soft neutral daylight' },
        { name: 'Black Volcanic Stone', prompt: 'Matte black volcanic stone surface, subtle natural texture, dramatic contrast' },
        { name: 'Ivory Silk', prompt: 'Flowing ivory silk fabric with soft sculptural folds, warm studio lighting' },
        { name: 'Deep Navy Velvet', prompt: 'Rich deep navy velvet fabric surface, subtle light play on texture' },
        { name: 'White Gallery Wall', prompt: 'Clean white gallery wall with soft museum lighting, minimal architectural space' },
        { name: 'Mediterranean Limestone', prompt: 'Natural Mediterranean limestone rock surface, warm cream and beige tones' },
      ];
      
      const selectedBackground = editorialBackgrounds[Math.floor(Math.random() * editorialBackgrounds.length)];
      
      const productTypeUpper = (productType || analysisResult.type || 'ring').toLowerCase();
      
      let modelBodyPart = 'hand';
      let wearingDescription = 'worn on elegant fingers';
      let framingDescription = 'TIGHT MACRO CROP on the ring, hand visible but ring dominates 70% of frame';
      let cameraLens = '100mm macro lens';
      let scaleNote = 'Ring appears at natural finger-to-ring proportion, NOT enlarged';
      
      if (productTypeUpper.includes('kolye') || productTypeUpper.includes('necklace') || productTypeUpper.includes('pendant') || productTypeUpper.includes('choker')) {
        modelBodyPart = 'neck and décolletage';
        wearingDescription = 'elegantly draped around the neck at natural position';
        framingDescription = 'TIGHT CROP from chin to upper chest, necklace centered and clearly readable';
        cameraLens = '85mm prime lens';
        scaleNote = 'Necklace appears at NATURAL DELICATE SIZE relative to neck - DO NOT ENLARGE.';
      } else if (productTypeUpper.includes('küpe') || productTypeUpper.includes('earring') || productTypeUpper.includes('piercing')) {
        modelBodyPart = 'ear and jawline';
        wearingDescription = 'adorning the ear in correct anatomical position';
        framingDescription = 'TIGHT CROP showing ear - jawline to temple visible, earring dominates 60% of frame';
        cameraLens = '100mm macro lens';
        scaleNote = 'Earring at natural ear proportion. ONE earring per ear ONLY.';
      } else if (productTypeUpper.includes('bileklik') || productTypeUpper.includes('bracelet') || productTypeUpper.includes('bangle')) {
        modelBodyPart = 'wrist and forearm';
        wearingDescription = 'wrapped around a slender wrist';
        framingDescription = 'TIGHT CROP on wrist area, bracelet clearly readable';
        cameraLens = '100mm macro lens';
        scaleNote = 'Bracelet at natural wrist proportion';
      } else if (productTypeUpper.includes('yüzük') || productTypeUpper.includes('ring') || productTypeUpper.includes('yuzuk')) {
        modelBodyPart = 'hand and fingers';
        wearingDescription = 'on elegant, well-manicured fingers';
        framingDescription = 'EXTREME CLOSE-UP on ring and finger, ring stone/setting occupies 60-70% of frame';
        cameraLens = '100mm macro lens';
        scaleNote = 'Ring at EXACT natural finger proportion';
      } else if (productTypeUpper.includes('saat') || productTypeUpper.includes('watch')) {
        modelBodyPart = 'wrist and forearm';
        wearingDescription = 'elegantly worn on the wrist, watch face prominently displayed';
        framingDescription = 'TIGHT MACRO CROP on wrist showing watch face details - watch occupies 65% of frame';
        cameraLens = '100mm macro lens';
        scaleNote = 'Watch at natural wrist proportion';
      }

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
          modelDescription = `${modelData.ethnicity || 'diverse'} ${genderDesc} model, ${modelData.age_range || 'young adult'} age range, ${modelData.face_shape || 'balanced'} face, ${modelData.eye_color || 'natural'} eyes, ${modelData.hair_color || 'dark'} ${modelData.hair_texture || 'straight'} hair`;
          skinToneDesc = `${modelData.skin_tone || 'medium'} skin tone with visible pores`;
          skinUndertoneDesc = `${modelData.skin_undertone || 'neutral'} undertone`;
        }
      }

      const isEarringType = productTypeUpper.includes('küpe') || productTypeUpper.includes('earring') || productTypeUpper.includes('piercing');
      const earringConstraints = isEarringType ? `
⚠️ EARRING RULE: ONE EAR = ONE PIERCING = ONE EARRING
- Each visible ear MUST have exactly ONE (1) primary lobe piercing
- Frame MUST show ONLY ONE ear clearly (single-ear close-up)
- NEVER render two earrings on the same ear
` : '';

      const modelShotPrompt = `JEWELRY WORN BY A HUMAN MODEL - EDITORIAL CAMPAIGN PHOTOGRAPHY.
⚠️ MANDATORY: THIS IMAGE MUST SHOW A REAL HUMAN MODEL WEARING THE JEWELRY ⚠️

${productExtractionBlock}

${fidelityBlock}

${earringConstraints}

⚠️ SCALE PRESERVATION ⚠️
${scaleNote}

FRAMING: ${framingDescription}
- HUMAN MODEL'S ${modelBodyPart.toUpperCase()} MUST BE VISIBLE wearing the jewelry
- Camera: ${cameraLens}, f/4-f/5.6, ISO 50-100

MODEL:
- ${modelDescription}
- Skin: ${skinToneDesc}, ${skinUndertoneDesc}
- Body part: ${modelBodyPart}
- Wearing: ${wearingDescription}
- Skin: editorial macro-photography level, visible pores, NO plastic/waxy appearance
- FEMALE BODY HAIR: Ultra-fine, nearly invisible vellus hair only

BACKGROUND: ${selectedBackground.name}
${selectedBackground.prompt}

LIGHTING:
- White balance neutral ~5000K-5500K
- Soft diffused studio lighting
- NO rim lights or colored bounce that shift metal color
- Light FAVORS jewelry detail and facet visibility

METAL COLOR ENFORCEMENT:
- Metal: ${metalType.replace('_', ' ').toUpperCase()} - LOCKED
- Any deviation = GENERATION FAILURE

MOOD: Luxury fashion editorial, calm, precise, product-first.

OUTPUT: 4K ultra-high resolution. PHOTOREALISM prioritized.
Ultra high resolution output.`;

      if (stepIndex === 2) {
        console.log('Step 2: Generating Model Shot image...');
        const modelUrl = await generateImage(base64Images, imageUrls, modelShotPrompt, 3);
        if (modelUrl) {
          generatedUrls.push(modelUrl);
          existingUrls.push(modelUrl);
          await supabase.from('images').update({ generated_image_urls: existingUrls }).eq('id', imageRecordId);
        }
        // Step 2 result handled by finalize section
      }

    } else if (hasStyleReference && styleReferenceBase64) {
      // STYLE REFERENCE MODE
      console.log('Style reference generation mode...');
      
      const productTypePlacement: Record<string, { bodyPart: string; placement: string; removal: string }> = {
        'yuzuk': { bodyPart: 'hand/finger', placement: 'Place the ring on the finger in the exact position shown in the style reference.', removal: 'Remove any existing rings from the style reference model.' },
        'bileklik': { bodyPart: 'wrist', placement: 'Place the bracelet on the wrist as shown in the style reference.', removal: 'Remove any existing bracelets or wrist accessories.' },
        'kupe': { bodyPart: 'ear', placement: 'Place the earring on the ear. If only one ear visible, render only ONE earring.', removal: 'Remove any existing earrings.' },
        'kolye': { bodyPart: 'neck/décolletage', placement: 'Place the necklace around the neck/décolletage area.', removal: 'Remove any existing necklaces.' },
        'saat': { bodyPart: 'wrist', placement: 'Place the watch on the wrist with dial face clearly visible.', removal: 'Remove any existing watches or wrist accessories.' },
      };

      const selectedPlacement = productTypePlacement[productType || ''] || {
        bodyPart: 'appropriate body part',
        placement: 'Place the jewelry on the model naturally.',
        removal: 'Remove any existing jewelry from the target body part.'
      };

      const styleTransferPrompt = `[STYLE REFERENCE TRANSFER - PRODUCT INJECTION MODE]

⚠️ PRE-PROCESSING: ACCESSORY REMOVAL ⚠️
1. REMOVE all existing jewelry from target: ${selectedPlacement.bodyPart}
2. ${selectedPlacement.removal}

IMAGE 1 = STYLE REFERENCE (pose, scene, lighting, atmosphere)
IMAGE 2+ = PRODUCT REFERENCE (jewelry to transfer)

${productExtractionBlock}

${fidelityBlock}

PRODUCT TYPE: ${productType?.toUpperCase() || 'JEWELRY'}
TARGET: ${selectedPlacement.bodyPart.toUpperCase()}
PLACEMENT: ${selectedPlacement.placement}

TECHNICAL: 4:5 portrait, 4K resolution, ultra photorealistic.
Ultra high resolution output.`;

      const styleTransferImages = [styleReferenceBase64, ...base64Images];
      const url = await generateImage(styleTransferImages, imageUrls, styleTransferPrompt, 1);
      if (url) generatedUrls.push(url);

      await supabase.from('processing_jobs').update({
        completed_images: generatedUrls.length,
        progress: 90,
      }).eq('id', jobId);
      
    } else {
      // STANDARD: Single image with scene
      console.log('Standard generation with scene...');
      
      const isModelScene = scene?.category === 'manken';
      const modelSceneEnforcement = isModelScene ? `
⚠️ MANDATORY: THIS IMAGE MUST SHOW A REAL HUMAN MODEL WEARING THE JEWELRY ⚠️
- A HUMAN MODEL must be VISIBLE and WEARING the jewelry
- NO product-only output without visible model
` : '';

      const standardPrompt = `Professional luxury jewelry photography. Ultra photorealistic. 4:5 portrait aspect ratio. 4K quality.

${productExtractionBlock}

${fidelityBlock}

${modelSceneEnforcement}

SCENE PLACEMENT:
${scene?.prompt || 'Elegant luxury setting with soft studio lighting, premium background.'}

TECHNICAL REQUIREMENTS:
- Ultra high resolution 4K output
- Macro photography quality with perfect focus
- Natural soft studio lighting
- The jewelry must look IDENTICAL to the reference

Ultra high resolution output.`;

      const url = await generateImage(base64Images, imageUrls, standardPrompt, 1);
      if (url) generatedUrls.push(url);

      await supabase.from('processing_jobs').update({
        completed_images: generatedUrls.length,
        progress: 90,
      }).eq('id', jobId);
    }

    // ═══════════════════════════════════════════════════════════════
    // FINALIZE
    // ═══════════════════════════════════════════════════════════════

    // For master intermediate steps (0, 1), completion is handled above
    if (isMasterPackage && stepIndex < 2) {
      console.log(`Master step ${stepIndex} complete. Generated: ${generatedUrls.length}`);
      // If step failed, handle refund
      if (generatedUrls.length === 0 && stepIndex === 0 && !isAdminUser) {
        await supabase.rpc('refund_credits', { _user_id: userId, _amount: creditsNeeded });
        console.log(`Full refund on step 0 failure: ${creditsNeeded}`);
      }
      return;
    }

    // For master step 2, merge all URLs from previous steps
    if (isMasterPackage && stepIndex === 2) {
      const { data: finalJob } = await supabase.from('processing_jobs').select('result_urls').eq('id', jobId).single();
      const allUrls = Array.isArray(finalJob?.result_urls) ? finalJob.result_urls as string[] : [];
      for (const u of generatedUrls) {
        if (!allUrls.includes(u)) allUrls.push(u);
      }
      generatedUrls.length = 0;
      allUrls.forEach(u => generatedUrls.push(u));
    }

    if (generatedUrls.length === 0) {
      // Refund credits
      if (!isAdminUser) {
        const { error: refundError } = await supabase
          .rpc('refund_credits', { _user_id: userId, _amount: creditsNeeded });
        if (refundError) console.error('Refund error:', refundError);
        else console.log(`Credits refunded: ${creditsNeeded}`);
      }

      await supabase.from('images').update({ 
        status: 'failed', 
        error_message: 'Görsel oluşturulamadı' 
      }).eq('id', imageRecordId);

      await supabase.from('processing_jobs').update({
        status: 'failed',
        error_message: 'Görsel oluşturulamadı',
        progress: 100,
        current_step: 'failed',
      }).eq('id', jobId);

      return;
    }

    // Partial refund for master package if some images failed
    if (isMasterPackage && generatedUrls.length < 3 && !isAdminUser) {
      const failedCount = 3 - generatedUrls.length;
      const refundAmount = Math.floor((failedCount / 3) * creditsNeeded);
      if (refundAmount > 0) {
        await supabase.rpc('refund_credits', { _user_id: userId, _amount: refundAmount });
        console.log(`Partial refund: ${refundAmount} credits for ${failedCount} failed images`);
        
        await supabase.from('processing_jobs').update({
          partial_refund_amount: refundAmount,
          failed_image_indices: Array.from({ length: failedCount }, (_, i) => generatedUrls.length + i),
        }).eq('id', jobId);
      }
    }

    // Update image record
    await supabase.from('images').update({
      status: 'completed',
      generated_image_urls: generatedUrls,
    }).eq('id', imageRecordId);

    // Update job as completed
    await supabase.from('processing_jobs').update({
      status: 'completed',
      progress: 100,
      current_step: 'completed',
      result_urls: generatedUrls,
      completed_images: generatedUrls.length,
    }).eq('id', jobId);

    console.log('Background generation complete:', generatedUrls.length, 'images');

  } catch (error) {
    console.error('Background processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    
    // Refund credits on error (only for step 0 or non-master to prevent double refund)
    if (!isAdminUser && (stepIndex === 0 || !isMasterPackage)) {
      try {
        await supabase.rpc('refund_credits', { _user_id: userId, _amount: creditsNeeded });
        console.log(`Credits refunded on error: ${creditsNeeded}`);
      } catch (refundErr) {
        console.error('Refund on error failed:', refundErr);
      }
    }

    await supabase.from('images').update({
      status: 'failed',
      error_message: errorMessage,
    }).eq('id', imageRecordId);

    await supabase.from('processing_jobs').update({
      status: 'failed',
      error_message: errorMessage,
      progress: 100,
      current_step: 'failed',
    }).eq('id', jobId);
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER - Lightweight, returns immediately with jobId
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
    const { imagePath, additionalImagePaths, sceneId, packageType, colorId, productType, modelId, metalColorOverride, styleReferencePath, modelVersion, stepIndex: rawStepIndex, existingJobId, existingImageId } = await req.json();
    const stepIndex = rawStepIndex || 0;
    console.log('Generate request:', { imagePath, sceneId, packageType, productType, modelVersion, stepIndex, userId });

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

    // Check style reference
    const hasStyleReference = styleReferencePath && typeof styleReferencePath === 'string' && styleReferencePath.startsWith(`${userId}/style-references/`);

    // Validate sceneId
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

    // Calculate credits
    const creditsNeeded = isMasterPackage ? 20 : 10;
    const totalImages = isMasterPackage ? 3 : 1;

    let imageRecordId: string;
    let jobRecordId: string;

    if (stepIndex > 0 && existingJobId && existingImageId) {
      // Continuation step - reuse existing records, no credit deduction
      imageRecordId = existingImageId;
      jobRecordId = existingJobId;
      console.log(`Continuing job ${jobRecordId}, step ${stepIndex}`);
    } else {
      // Step 0 or non-master: normal flow with credits and record creation
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
          return new Response(
            JSON.stringify({ 
              error: `Yetersiz kredi. ${creditsNeeded} kredi gerekli, mevcut: ${deductResult?.current_credits ?? 0}.` 
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
          status: 'analyzing',
        })
        .select()
        .single();

      if (insertError) throw insertError;
      imageRecordId = imageRecord.id;

      // Create processing job
      const { data: jobRecord, error: jobError } = await supabase
        .from('processing_jobs')
        .insert({
          user_id: userId,
          image_record_id: imageRecordId,
          status: 'pending',
          total_images: totalImages,
          completed_images: 0,
          progress: 0,
          current_step: 'pending',
          credits_used: isAdminUser ? 0 : creditsNeeded,
        })
        .select()
        .single();

      if (jobError) throw jobError;
      jobRecordId = jobRecord.id;

      console.log(`Job created: ${jobRecordId}, Image record: ${imageRecordId}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // SYNCHRONOUS PROCESSING - await directly, return results
    // ═══════════════════════════════════════════════════════════════
    await processGenerationInBackground({
      userId,
      imageRecordId,
      jobId: jobRecordId,
      imagePaths: [imagePath, ...validAdditionalPaths],
      validAdditionalPaths,
      sceneId: sceneId || null,
      packageType: packageType || 'standard',
      colorId: colorId || null,
      productType: productType || null,
      modelId: modelId || null,
      metalColorOverride: metalColorOverride || null,
      styleReferencePath: styleReferencePath || null,
      creditsNeeded,
      isAdminUser,
      modelVersion: modelVersion || 'v1',
      stepIndex,
    });

    // Fetch final job state after processing
    const { data: finalJobState } = await supabase.from('processing_jobs')
      .select('status, result_urls, completed_images, error_message')
      .eq('id', jobRecordId)
      .single();

    const resultUrls = Array.isArray(finalJobState?.result_urls) ? finalJobState.result_urls : [];

    return new Response(
      JSON.stringify({ 
        success: finalJobState?.status !== 'failed', 
        jobId: jobRecordId, 
        imageId: imageRecordId,
        status: finalJobState?.status || 'completed',
        resultUrls,
        totalImages,
        completedImages: finalJobState?.completed_images || 0,
        errorMessage: finalJobState?.error_message || null,
      }),
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
