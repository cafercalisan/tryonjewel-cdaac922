import type { VercelRequest, VercelResponse } from '@vercel/node';
import { waitUntil } from '@vercel/functions';
import { getServiceClient } from './_lib/supabase.js';
import { authenticateUser } from './_lib/auth.js';
import { corsHeaders, sendCorsResponse } from './_lib/cors.js';

export const config = {
  maxDuration: 300,
};

const GOOGLE_ANALYSIS_API_KEY = process.env.GOOGLE_ANALYSIS_API_KEY;
const GOOGLE_IMAGE_API_KEY = process.env.GOOGLE_API_KEY;

const ANALYSIS_MODEL = 'models/gemini-2.5-flash';
const IMAGE_GEN_MODEL = 'gemini-3-pro-image-preview';

const MAX_IMAGE_SIZE = 1.5 * 1024 * 1024;

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
  temperature = 0.15,
}: {
  base64Images: string[];
  prompt: string;
  temperature?: number;
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
        temperature,
        imageConfig: {
          aspectRatio: '3:4',
          imageSize: '4K',
        },
      },
    }),
  });
}

// Retry-enabled single image generation
async function generateSingleImage(
  base64Images: string[],
  prompt: string,
  userId: string,
  imageRecordId: string,
  index: number,
  supabase: any,
  jobId: string,
): Promise<string | null> {
  const temperatures = [0.15, 0.2, 0.25];
  const delays = [0, 3000, 5000];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (!GOOGLE_IMAGE_API_KEY) {
        console.error('Missing GOOGLE_API_KEY');
        return null;
      }

      if (attempt > 0) {
        console.log(`Retry ${attempt}/2 for image ${index} with temperature ${temperatures[attempt]}...`);
        await new Promise(r => setTimeout(r, delays[attempt]));
      }

      const genResponse = await callGeminiImageGeneration({
        base64Images,
        prompt,
        temperature: temperatures[attempt],
      });

      if (!genResponse.ok) {
        const errText = await genResponse.text();
        console.error(`Generation ${index} API error (${genResponse.status}) attempt ${attempt + 1}:`, errText);
        if (attempt < 2) continue;
        return null;
      }

      const genData = await genResponse.json();
      const parts = genData.candidates?.[0]?.content?.parts || [];
      let generatedImage: string | null = null;

      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          generatedImage = part.inlineData.data;
          part.inlineData.data = null;
          break;
        }
      }

      if (!generatedImage) {
        console.error(`No image in generation response (attempt ${attempt + 1})`);
        if (attempt < 2) continue;
        return null;
      }

      const imageBuffer = Uint8Array.from(atob(generatedImage), (c) => c.charCodeAt(0));
      generatedImage = null; // Free memory

      const filePath = `${userId}/generated/${imageRecordId}-${index}.png`;
      const { error: uploadError } = await supabase.storage
        .from('jewelry-images')
        .upload(filePath, imageBuffer, { contentType: 'image/png' });

      if (!uploadError) {
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('jewelry-images')
          .createSignedUrl(filePath, 7 * 24 * 60 * 60);

        if (!signedUrlError && signedUrlData?.signedUrl) {
          console.log(`Image ${index} uploaded successfully (attempt ${attempt + 1})`);
          return signedUrlData.signedUrl;
        }
      }

      return null;
    } catch (error) {
      console.error(`Generation ${index} error (attempt ${attempt + 1}):`, error);
      if (attempt < 2) continue;
      return null;
    }
  }
  return null;
}

async function processGeneration(params: {
  userId: string;
  imageRecordId: string;
  jobId: string;
  imagePaths: string[];
  validAdditionalPaths: string[];
  sceneId: string | null;
  packageType: string;
  productType: string | null;
  metalColorOverride: string | null;
  styleReferencePath: string | null;
  creditsNeeded: number;
  isAdminUser: boolean;
}) {
  const supabase = getServiceClient();
  const {
    userId, imageRecordId, jobId, imagePaths, validAdditionalPaths,
    sceneId, packageType, productType,
    metalColorOverride, styleReferencePath, creditsNeeded, isAdminUser,
  } = params;

  console.log(`Using model: Analysis=Gemini 2.5 Flash, Generation=Gemini 3 Pro (4K), Package=${packageType}`);

  const isRetouchPackage = packageType === 'retouch';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  try {
    // Update job: started
    await supabase.from('processing_jobs').update({
      status: 'generating',
      current_step: 'downloading',
      started_at: new Date().toISOString(),
      progress: 2,
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

    await supabase.from('processing_jobs').update({
      progress: 5,
      current_step: 'downloading',
    }).eq('id', jobId);

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

    // Fetch and convert first image to base64
    await supabase.from('processing_jobs').update({
      current_step: 'analyzing',
      progress: 10,
    }).eq('id', jobId);

    const base64Images: string[] = [];
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

    // ═══════════════════════════════════════════════════
    // ANALYZE JEWELRY
    // ═══════════════════════════════════════════════════
    console.log('Step 1: Analyzing jewelry...');
    await supabase.from('processing_jobs').update({ progress: 15 }).eq('id', jobId);

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

    await supabase.from('images')
      .update({ status: 'generating', analysis_data: analysisResult })
      .eq('id', imageRecordId);

    await supabase.from('processing_jobs').update({
      current_step: 'generating',
      progress: 25,
    }).eq('id', jobId);

    // ═══════════════════════════════════════════════════
    // BUILD FIDELITY BLOCK
    // ═══════════════════════════════════════════════════
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

    console.log('Metal color decision:', { userOverride: metalColorOverride, finalType: metalType, finalCategory: metalColorCategory });

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
═══════════════════════════════════════════════════════════════`.trim();

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
- ❌ No artificial CGI gemstones`.trim();

    const generatedUrls: string[] = [];

    // ═══════════════════════════════════════════════════
    // GENERATION LOGIC
    // ═══════════════════════════════════════════════════

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

      await supabase.from('processing_jobs').update({ progress: 28 }).eq('id', jobId);
      const retouchUrl = await generateSingleImage(base64Images, retouchPrompt, userId, imageRecordId, 0, supabase, jobId);

      if (retouchUrl) {
        generatedUrls.push(retouchUrl);
        console.log('Retouch complete');
      }

      await supabase.from('processing_jobs').update({
        completed_images: generatedUrls.length,
        progress: 90,
      }).eq('id', jobId);

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

      await supabase.from('processing_jobs').update({ progress: 28 }).eq('id', jobId);
      const styleTransferImages = [styleReferenceBase64, ...base64Images];
      const url = await generateSingleImage(styleTransferImages, styleTransferPrompt, userId, imageRecordId, 1, supabase, jobId);
      if (url) generatedUrls.push(url);

      await supabase.from('processing_jobs').update({
        completed_images: generatedUrls.length,
        progress: 90,
      }).eq('id', jobId);

    } else {
      // STANDARD: 3 images sequentially with scene
      console.log('Standard generation with scene (3 images sequential, 4K)...');

      const isModelScene = scene?.category === 'manken';
      const modelSceneEnforcement = isModelScene ? `
⚠️ MANDATORY: THIS IMAGE MUST SHOW A REAL HUMAN MODEL WEARING THE JEWELRY ⚠️
- A HUMAN MODEL must be VISIBLE and WEARING the jewelry
- NO product-only output without visible model
` : '';

      const lightingVariations = [
        'Primary lighting from upper-left (10 o\'clock position). Soft diffused key light.',
        'Balanced front lighting with gentle fill. Even illumination across the piece.',
        'Dramatic side lighting from the right (2 o\'clock position). Subtle shadow play.',
      ];

      const totalToGenerate = 3;
      for (let i = 0; i < totalToGenerate; i++) {
        console.log(`Generating image ${i + 1}/${totalToGenerate}...`);

        // Granular progress: 28, 48, 68 for start of each image
        const startProgress = 28 + (i * 20);
        await supabase.from('processing_jobs').update({
          progress: startProgress,
          current_step: `generating_${i + 1}`,
        }).eq('id', jobId);

        const standardPrompt = `Professional luxury jewelry photography. Ultra photorealistic. 4:5 portrait aspect ratio. 4K quality.

${productExtractionBlock}

${fidelityBlock}

${modelSceneEnforcement}

SCENE PLACEMENT:
${scene?.prompt || 'Elegant luxury setting with soft studio lighting, premium background.'}

LIGHTING DIRECTION: ${lightingVariations[i]}

TECHNICAL REQUIREMENTS:
- Ultra high resolution output
- Macro photography quality with perfect focus
- Natural soft studio lighting
- The jewelry must look IDENTICAL to the reference

Ultra high resolution output.`;

        const url = await generateSingleImage(base64Images, standardPrompt, userId, imageRecordId, i + 1, supabase, jobId);
        if (url) generatedUrls.push(url);

        // Update progress: 45, 65, 85 after each image
        const endProgress = 45 + (i * 20);
        await supabase.from('processing_jobs').update({
          completed_images: generatedUrls.length,
          progress: endProgress,
        }).eq('id', jobId);

        console.log(`Image ${i + 1} done. Progress: ${endProgress}%`);
      }
    }

    // ═══════════════════════════════════════════════════
    // FINALIZE
    // ═══════════════════════════════════════════════════

    await supabase.from('processing_jobs').update({ progress: 90, current_step: 'saving' }).eq('id', jobId);

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

    // Partial success: at least 1 image generated
    await supabase.from('images').update({
      status: 'completed',
      generated_image_urls: generatedUrls,
    }).eq('id', imageRecordId);

    await supabase.from('processing_jobs').update({
      status: 'completed',
      progress: 100,
      current_step: 'completed',
      result_urls: generatedUrls,
      completed_images: generatedUrls.length,
    }).eq('id', jobId);

    console.log('Generation complete:', generatedUrls.length, 'images');

  } catch (error) {
    console.error('Processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

    if (!isAdminUser) {
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

// ═══════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
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

    const { imagePath, additionalImagePaths, sceneId, packageType, productType, metalColorOverride, styleReferencePath } = req.body;
    console.log('Generate request:', { imagePath, sceneId, packageType, productType, userId });

    if (!imagePath || typeof imagePath !== 'string' || !imagePath.startsWith(`${userId}/originals/`)) {
      return sendCorsResponse(res, 400, { error: 'Invalid image path' });
    }

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
    const isRetouchPackage = packageType === 'retouch';

    if (!hasStyleReference && !isRetouchPackage && (!sceneId || !uuidRegex.test(sceneId))) {
      return sendCorsResponse(res, 400, { error: 'Invalid scene ID' });
    }

    const supabase = getServiceClient();

    // Auto-clean stuck jobs older than 3 minutes
    const { data: stuckJobs } = await supabase
      .from('processing_jobs')
      .select('id, image_record_id')
      .eq('user_id', userId)
      .in('status', ['pending', 'generating'])
      .lt('updated_at', new Date(Date.now() - 3 * 60 * 1000).toISOString());

    if (stuckJobs && stuckJobs.length > 0) {
      const stuckJobIds = stuckJobs.map(j => j.id);
      const stuckImageIds = stuckJobs.map(j => j.image_record_id).filter(Boolean);

      await supabase
        .from('processing_jobs')
        .update({ status: 'failed', error_message: 'Auto-cleaned: stuck job (timeout)' })
        .in('id', stuckJobIds);

      if (stuckImageIds.length > 0) {
        await supabase
          .from('images')
          .update({ status: 'failed', error_message: 'Auto-cleaned: generation timed out' })
          .in('id', stuckImageIds);
      }
      console.log(`Auto-cleaned ${stuckJobs.length} stuck jobs`);
    }

    // Check for active jobs
    const { count: activeJobs } = await supabase
      .from('processing_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['pending', 'generating']);

    if (activeJobs && activeJobs > 0) {
      return sendCorsResponse(res, 409, { error: 'Zaten devam eden bir üretim var. Lütfen bekleyin.', code: 'ACTIVE_JOB_EXISTS' });
    }

    // Check admin status
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
    const isAdminUser = isAdmin === true;

    const creditsNeeded = 10;

    // Deduct credits
    if (!isAdminUser) {
      const { data: deductResult, error: deductError } = await supabase
        .rpc('deduct_credits', { _user_id: userId, _amount: creditsNeeded });

      if (deductError) {
        return sendCorsResponse(res, 500, { error: 'Kredi kontrolü sırasında hata oluştu.' });
      }

      if (!deductResult?.success) {
        return sendCorsResponse(res, 402, {
          error: `Yetersiz kredi. ${creditsNeeded} kredi gerekli, mevcut: ${deductResult?.current_credits ?? 0}.`
        });
      }

      console.log(`Credits deducted: ${creditsNeeded}, remaining: ${deductResult.remaining_credits}`);
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
    const imageRecordId = imageRecord.id;

    // Create processing job
    const { data: jobRecord, error: jobError } = await supabase
      .from('processing_jobs')
      .insert({
        user_id: userId,
        image_record_id: imageRecordId,
        status: 'pending',
        total_images: 3,
        completed_images: 0,
        progress: 0,
        current_step: 'pending',
        credits_used: isAdminUser ? 0 : creditsNeeded,
      })
      .select()
      .single();

    if (jobError) throw jobError;
    const jobRecordId = jobRecord.id;

    console.log(`Job created: ${jobRecordId}, Image record: ${imageRecordId}`);

    // Return immediately, process in background via waitUntil
    waitUntil(processGeneration({
      userId,
      imageRecordId,
      jobId: jobRecordId,
      imagePaths: [imagePath, ...validAdditionalPaths],
      validAdditionalPaths,
      sceneId: sceneId || null,
      packageType: packageType || 'standard',
      productType: productType || null,
      metalColorOverride: metalColorOverride || null,
      styleReferencePath: styleReferencePath || null,
      creditsNeeded,
      isAdminUser,
    }));

    return sendCorsResponse(res, 200, {
      success: true,
      jobId: jobRecordId,
      imageId: imageRecordId,
      status: 'pending',
    });

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return sendCorsResponse(res, 500, { error: errorMessage });
  }
}
