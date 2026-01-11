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

// Generate single image and return base64
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
            const { data: { publicUrl } } = supabase.storage
              .from('jewelry-images')
              .getPublicUrl(filePath);
            return publicUrl;
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
      const { data: { publicUrl } } = supabase.storage
        .from('jewelry-images')
        .getPublicUrl(filePath);
      console.log(`Image ${index} uploaded successfully`);
      return publicUrl;
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
    const { imagePath, sceneId, packageType, colorId, productType } = await req.json();
    console.log('Generate request:', { imagePath, sceneId, packageType, colorId, productType, userId });

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

    // Verify credits
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();

    if (!profile || profile.credits < creditsNeeded) {
      return new Response(
        JSON.stringify({ error: `Yetersiz kredi. ${creditsNeeded} kredi gerekli.` }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    // Build fidelity block
    const metalDesc = analysisResult.metal 
      ? `${analysisResult.metal.finish || 'polished'} ${analysisResult.metal.type || 'gold'} (${analysisResult.metal.karat || '18k'})`
      : 'polished gold';
    
    const stoneDesc = analysisResult.stones?.length > 0
      ? analysisResult.stones.map((s: any) => 
          `${s.count || 1} ${s.color || ''} ${s.type || 'gemstone'}(s) in ${s.cut || 'round'} cut with ${s.setting || 'prong'} setting`
        ).join(', ')
      : '';

    const fidelityBlock = `
JEWELRY SPECIFICATIONS (MUST BE PRESERVED EXACTLY):
- Type: ${analysisResult.type || 'jewelry piece'}
- Metal: ${metalDesc}
${stoneDesc ? `- Stones: ${stoneDesc}` : ''}
- Style: ${analysisResult.design_elements?.style || 'classic'}
${analysisResult.unique_identifiers ? `- Unique features: ${analysisResult.unique_identifiers}` : ''}

CRITICAL FIDELITY REQUIREMENTS:
1. EXACT stone count - no more, no less
2. EXACT setting structure and prong positions
3. EXACT metal color and surface finish
4. EXACT proportions - do not resize
5. EXACT design elements - preserve all patterns
6. Natural realistic scale

DIAMOND AND GEMSTONE REALISM (CRITICAL):
- Real diamond light behavior: fire (spectral dispersion), brilliance (white light reflection), scintillation
- Authentic internal light refraction patterns
- Subtle rainbow flashes from dispersion - not uniform glow
- Natural inclusions visible in realistic diamonds
- Depth and three-dimensionality inside the stone
- Realistic facet edges with crisp precision
- No artificial HDR glow, no CGI-like perfection

FORBIDDEN:
- No text, watermarks, logos
- No design alterations
- No additional jewelry pieces
- No artificial CGI gemstones
`.trim();

    const generatedUrls: string[] = [];

    if (isMasterPackage) {
      // MASTER PACKAGE: 3 images sequentially
      console.log('Master Package: Generating 3 images sequentially...');

      // Color mapping for e-commerce background
      const colorMap: Record<string, { name: string; prompt: string }> = {
        'white': { name: 'Beyaz', prompt: 'pure white, clean ivory, soft cream white' },
        'cream': { name: 'Krem', prompt: 'warm cream, soft ivory, delicate beige-white' },
        'blush': { name: 'Pudra Pembe', prompt: 'soft blush pink, delicate rose, pale pink' },
        'lavender': { name: 'Lavanta', prompt: 'soft lavender, pale purple, gentle violet' },
        'mint': { name: 'Nane Yeşili', prompt: 'soft mint green, pale sage, delicate seafoam' },
        'skyblue': { name: 'Gök Mavisi', prompt: 'soft sky blue, pale azure, gentle powder blue' },
        'peach': { name: 'Şeftali', prompt: 'soft peach, gentle apricot, warm coral tint' },
        'champagne': { name: 'Şampanya', prompt: 'warm champagne gold, soft beige gold, elegant nude' },
        'silver': { name: 'Gümüş', prompt: 'soft silver gray, pale platinum, gentle metallic gray' },
        'gray': { name: 'Gri', prompt: 'soft dove gray, gentle stone, neutral warm gray' },
      };

      const selectedColor = colorMap[colorId] || colorMap['white'];

      // Image 1: E-commerce clean background
      const ecommercePrompt = `Professional e-commerce product photography. Ultra photorealistic. 4:5 portrait aspect ratio. 4K ultra-high resolution quality (3840x4800 pixels).

${fidelityBlock}

SCENE: Clean, minimal e-commerce product shot
- Background: ${selectedColor.prompt} - soft, gradient, seamless studio backdrop
- Lighting: Soft, diffused studio lighting, no harsh shadows
- Style: Amazon/luxury e-commerce listing quality
- The jewelry should be the absolute focal point
- Clean, uncluttered, professional commercial aesthetic
- Perfect for online store product listings
- Subtle reflection on surface, professional product photography

OUTPUT QUALITY: Maximum resolution, ultra-sharp details, no compression artifacts.
Ultra high resolution output.`;

      console.log('Generating E-commerce image...');
      const ecomUrl = await generateSingleImage(base64Image, ecommercePrompt, userId, imageRecord.id, 1, supabase);
      if (ecomUrl) generatedUrls.push(ecomUrl);

      // Image 2: Luxury catalog shot
      const catalogPrompt = `Professional luxury catalog photography. Ultra photorealistic. 4:5 portrait aspect ratio. 4K ultra-high resolution quality (3840x4800 pixels).

${fidelityBlock}

SCENE: High-end jewelry catalog photography
- Setting: Premium textured surface (marble, velvet, or brushed metal)
- Lighting: Dramatic but controlled studio lighting with rim lights
- Style: Vogue, Harper's Bazaar jewelry editorial quality
- Macro-level detail visibility
- Professional jewelry photography with artistic composition
- Subtle props that complement without distraction
- Rich shadows and highlights that emphasize dimensionality
- Magazine-worthy luxury presentation

OUTPUT QUALITY: Maximum resolution, ultra-sharp details, no compression artifacts.
Ultra high resolution output.`;

      console.log('Generating Catalog image...');
      const catalogUrl = await generateSingleImage(base64Image, catalogPrompt, userId, imageRecord.id, 2, supabase);
      if (catalogUrl) generatedUrls.push(catalogUrl);

      // Image 3: Model shot based on detected product type from analysis
      // AUTO-DETECT: Use analysis result type, fallback to provided productType
      const detectedType = analysisResult.type?.toLowerCase() || '';
      const typeMapping: Record<string, string> = {
        'ring': 'yuzuk',
        'bracelet': 'bileklik',
        'earring': 'kupe',
        'necklace': 'kolye',
        'pendant': 'kolye',
        'choker': 'gerdanlik',
        'piercing': 'piercing',
        'watch': 'bileklik',
        'brooch': 'kolye',
      };
      
      const autoDetectedProductType = typeMapping[detectedType] || productType || 'kolye';
      console.log(`Auto-detected product type: ${detectedType} -> ${autoDetectedProductType}`);

      const modelSceneMap: Record<string, string> = {
        'yuzuk': 'Elegant feminine hand close-up with manicured nails, showcasing the RING naturally worn on the finger. Soft skin texture, natural hand pose, professional hand model photography. The RING must be on the finger, NOT on ear or other body parts.',
        'bileklik': 'Elegant wrist and forearm shot, showcasing the BRACELET worn around the wrist. Natural pose, soft lighting on skin, fashion photography quality. The BRACELET must be on the wrist, NOT on other body parts.',
        'kupe': 'Side profile portrait showcasing the EARRING on the ear. Visible ear with the earring properly attached, styled hair, soft studio lighting, fashion editorial quality. The EARRING must be on the ear.',
        'kolye': 'Elegant neck and décolletage portrait showcasing the NECKLACE worn around the neck. Soft skin tones, professional fashion photography, romantic mood. The NECKLACE must be around the neck.',
        'gerdanlik': 'Upper body portrait showcasing the CHOKER necklace worn tightly around the neck. Elegant pose, fashion editorial style, soft dramatic lighting. The CHOKER must be around the neck.',
        'piercing': 'Close-up portrait showcasing the PIERCING jewelry in its proper placement. Natural skin texture, contemporary fashion photography style.',
      };

      const modelScene = modelSceneMap[autoDetectedProductType] || modelSceneMap['kolye'];

      const modelPrompt = `Professional fashion model photography. Ultra photorealistic. 4:5 portrait aspect ratio. 4K ultra-high resolution quality.

${fidelityBlock}

CRITICAL PLACEMENT RULE:
- Detected jewelry type: ${analysisResult.type || 'jewelry'}
- This ${analysisResult.type || 'jewelry'} MUST be placed on the correct body part for its type
- RINGS go on FINGERS only
- BRACELETS go on WRISTS only  
- EARRINGS go on EARS only
- NECKLACES go around the NECK only
- NEVER place a ring on an ear or a necklace on a wrist

SCENE: ${modelScene}
- Model: Professional model with realistic skin texture (NOT plastic or over-retouched)
- Lighting: Soft key light with subtle rim light, cinematic quality
- Style: High-end fashion advertising, editorial quality
- The jewelry is worn naturally on the CORRECT body part and becomes the focal point
- Natural pose, confident but not forced
- Background: Soft, out of focus, elegant
- Skin shows natural texture and pores, not airbrushed
- Jewelry perfectly scaled on the model

Ultra high resolution output. Maximum image quality.`;

      console.log('Generating Model image with auto-detected type:', autoDetectedProductType);
      const modelUrl = await generateSingleImage(base64Image, modelPrompt, userId, imageRecord.id, 3, supabase);
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
      await supabase
        .from('images')
        .update({ status: 'failed', error_message: 'Görsel oluşturulamadı' })
        .eq('id', imageRecord.id);

      return new Response(
        JSON.stringify({ error: 'No images generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduct credits
    await supabase
      .from('profiles')
      .update({ credits: profile.credits - creditsNeeded })
      .eq('id', userId);

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
