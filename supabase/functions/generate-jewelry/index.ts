import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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
// Analysis: gemini-2.5-flash
// Image Generation: gemini-3-pro-image-preview
// ========================================================
const ANALYSIS_MODEL = 'models/gemini-2.5-flash';
const IMAGE_GEN_MODEL = 'gemini-3-pro-image-preview';

async function callGeminiImageGeneration({
  base64Image,
  prompt,
}: {
  base64Image: string;
  prompt: string;
}) {
  // Using Gemini 3 Pro Image Preview with v1alpha API
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

  return url.slice(commaIndex + 1); // base64
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user from JWT
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
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log('Authenticated user:', userId);

    // Parse request body
    const { imagePath, sceneId } = await req.json();
    console.log('Generate request:', { imagePath, sceneId, userId });

    // Validate imagePath format to prevent SSRF
    if (!imagePath || typeof imagePath !== 'string' || !imagePath.startsWith(`${userId}/originals/`)) {
      return new Response(
        JSON.stringify({ error: 'Invalid image path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate sceneId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!sceneId || !uuidRegex.test(sceneId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid scene ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Generate signed URL for the original image (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('jewelry-images')
      .createSignedUrl(imagePath, 3600);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Signed URL error:', signedUrlError);
      return new Response(
        JSON.stringify({ error: 'Failed to access image' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageUrl = signedUrlData.signedUrl;

    // Get scene details
    const { data: scene, error: sceneError } = await supabase
      .from('scenes')
      .select('*')
      .eq('id', sceneId)
      .single();

    if (sceneError || !scene) {
      return new Response(
        JSON.stringify({ error: 'Scene not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has credits before processing
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();

    if (!profile || profile.credits <= 0) {
      return new Response(
        JSON.stringify({ error: 'Insufficient credits' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create image record
    const { data: imageRecord, error: insertError } = await supabase
      .from('images')
      .insert({
        user_id: userId,
        scene_id: sceneId,
        original_image_url: imagePath,
        status: 'analyzing',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Step 1: Analyze the jewelry for accurate reproduction
    console.log('Step 1: Analyzing jewelry with precision...');
    
    // Fetch the image and convert to base64 for Gemini API (using chunked encoding to avoid stack overflow)
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = base64Encode(imageBuffer);
    
    const analysisResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${ANALYSIS_MODEL}:generateContent?key=${GOOGLE_ANALYSIS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `You are an expert jewelry analyst. Analyze this jewelry image with extreme precision for accurate reproduction.

Return a JSON object with these exact fields:
{
  "type": "ring|necklace|bracelet|earring|pendant|brooch|watch",
  "metal": {
    "type": "gold|silver|platinum|rose_gold|white_gold|mixed",
    "karat": "24k|22k|18k|14k|10k|sterling|unknown",
    "finish": "polished|matte|brushed|hammered|textured|satin",
    "color_hex": "#hex color of the metal"
  },
  "stones": [
    {
      "type": "diamond|ruby|emerald|sapphire|pearl|amethyst|topaz|other",
      "count": number,
      "cut": "round|princess|oval|cushion|emerald|pear|marquise|cabochon|baguette",
      "color": "color description",
      "size_mm": "approximate size",
      "setting": "prong|bezel|channel|pave|tension|cluster|halo"
    }
  ],
  "dimensions": {
    "estimated_width_mm": number,
    "estimated_height_mm": number,
    "aspect_ratio": "width:height ratio"
  },
  "design_elements": {
    "style": "modern|vintage|art_deco|minimalist|ornate|classic|bohemian",
    "patterns": ["filigree", "engraving", "milgrain", "rope", "cable", "none"],
    "symmetry": "symmetric|asymmetric",
    "complexity": "simple|moderate|intricate"
  },
  "unique_identifiers": "describe any unique features, hallmarks, or distinctive elements"
}

ONLY respond with valid JSON. No other text.`
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Image
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048
        }
      }),
    });

    let analysisResult: any;

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error('Analysis API error (continuing with defaults):', errorText);
      // Do NOT fail the whole job if analysis model is unavailable.
      analysisResult = { type: 'jewelry', design_elements: { style: 'classic', patterns: ['none'] } };
    } else {
      const analysisData = await analysisResponse.json();
      try {
        const content = analysisData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        analysisResult = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());
      } catch {
        console.error('Failed to parse analysis, using defaults');
        analysisResult = { type: 'jewelry', design_elements: { style: 'classic', patterns: ['none'] } };
      }
    }

    console.log('Analysis result:', JSON.stringify(analysisResult, null, 2));

    // Update status to generating
    await supabase
      .from('images')
      .update({ status: 'generating', analysis_data: analysisResult })
      .eq('id', imageRecord.id);

    // Build precision prompt for accurate reproduction
    const metalDesc = analysisResult.metal 
      ? `${analysisResult.metal.finish || 'polished'} ${analysisResult.metal.type || 'gold'} (${analysisResult.metal.karat || '18k'})`
      : 'polished gold';
    
    const stoneDesc = analysisResult.stones?.length > 0
      ? analysisResult.stones.map((s: any) => 
          `${s.count || 1} ${s.color || ''} ${s.type || 'gemstone'}(s) in ${s.cut || 'round'} cut with ${s.setting || 'prong'} setting`
        ).join(', ')
      : '';

    const dimensionInfo = analysisResult.dimensions
      ? `Approximate dimensions: ${analysisResult.dimensions.estimated_width_mm || 20}mm x ${analysisResult.dimensions.estimated_height_mm || 20}mm`
      : '';

    const fidelityBlock = `
JEWELRY SPECIFICATIONS (MUST BE PRESERVED EXACTLY):
- Type: ${analysisResult.type || 'jewelry piece'}
- Metal: ${metalDesc}
${stoneDesc ? `- Stones: ${stoneDesc}` : ''}
${dimensionInfo ? `- ${dimensionInfo}` : ''}
- Style: ${analysisResult.design_elements?.style || 'classic'}
${analysisResult.design_elements?.patterns?.filter((p: string) => p !== 'none').join(', ') ? `- Decorative elements: ${analysisResult.design_elements.patterns.filter((p: string) => p !== 'none').join(', ')}` : ''}
${analysisResult.unique_identifiers ? `- Unique features: ${analysisResult.unique_identifiers}` : ''}

CRITICAL FIDELITY REQUIREMENTS:
1. EXACT stone count - no more, no less
2. EXACT setting structure and prong positions
3. EXACT metal color and surface finish
4. EXACT proportions - do not enlarge or shrink the jewelry
5. EXACT design elements - preserve all engravings, patterns, details
6. Natural realistic scale relative to scene elements
`.trim();

    const fullPrompt = `Professional luxury jewelry photography. Ultra photorealistic. 4:5 portrait aspect ratio.

${fidelityBlock}

SCENE PLACEMENT:
${scene.prompt}

TECHNICAL REQUIREMENTS:
- Macro photography quality with perfect focus on jewelry
- Natural soft studio lighting with subtle highlights
- Accurate metal reflections and gemstone refractions
- Clean, uncluttered composition
- The jewelry must look IDENTICAL to the reference - same piece, different setting

FORBIDDEN:
- No text, watermarks, or logos
- No design alterations or creative interpretations
- No exaggerated proportions
- No additional jewelry pieces`;

    console.log('Generating with precision prompt...');

    // Step 2: Generate 1 variation
    const generatedUrls: string[] = [];
    let lastGenerationError: string | null = null;
    let lastGenerationStatus: number | null = null;
    
    for (let i = 0; i < 1; i++) {
      console.log(`Generating variation ${i + 1}/1 with ${IMAGE_GEN_MODEL}...`);
      
      try {
        if (!GOOGLE_IMAGE_API_KEY) {
          console.error('Missing GOOGLE_API_KEY (for image generation)');
          lastGenerationError = 'Missing GOOGLE_API_KEY';
          lastGenerationStatus = 500;
          break;
        }

        const variationHint = 'Variation A: slightly different camera angle and lighting.';
        const prompt = `${fullPrompt}\n\n${variationHint}`;

        const genResponse = await callGeminiImageGeneration({ base64Image, prompt });

        if (!genResponse.ok) {
          const errText = await genResponse.text();
          lastGenerationError = errText;
          lastGenerationStatus = genResponse.status;
          console.error(`Generation ${i + 1} API error (${genResponse.status}):`, errText);

          // If Google image generation is blocked (region / project restriction), fall back to Lovable AI.
          if (
            errText.includes('Image generation is not available in your country') ||
            errText.includes('FAILED_PRECONDITION')
          ) {
            try {
              console.log('Falling back to Lovable AI image generation...');
              const lovableBase64 = await callLovableImageGeneration({ base64Image, prompt });
              const imageBuffer = Uint8Array.from(atob(lovableBase64), (c) => c.charCodeAt(0));
              const filePath = `${userId}/generated/${imageRecord.id}-${i + 1}.png`;

              const { error: uploadError } = await supabase.storage
                .from('jewelry-images')
                .upload(filePath, imageBuffer, { contentType: 'image/png' });

              if (uploadError) {
                lastGenerationError = `Upload error: ${JSON.stringify(uploadError)}`;
                lastGenerationStatus = 500;
                console.error(`Upload error for variation ${i + 1}:`, uploadError);
              } else {
                const { data: { publicUrl } } = supabase.storage
                  .from('jewelry-images')
                  .getPublicUrl(filePath);
                generatedUrls.push(publicUrl);
                console.log(`Variation ${i + 1} uploaded successfully (Lovable AI)`);
              }
            } catch (fallbackErr) {
              const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
              console.error('Lovable AI fallback failed:', msg);
              lastGenerationError = `Lovable fallback failed: ${msg}`;
              lastGenerationStatus = 500;
            }
          }

          continue;
        }

        const genData = await genResponse.json();
        console.log(`Generation ${i + 1} response received`);

        // Extract image from Gemini response
        const parts = genData.candidates?.[0]?.content?.parts || [];
        let generatedImage: string | null = null;

        for (const part of parts) {
          if (part.inlineData?.mimeType?.startsWith('image/')) {
            generatedImage = part.inlineData.data;
            break;
          }
        }

        if (!generatedImage) {
          lastGenerationError = 'Model response did not include an image.';
          lastGenerationStatus = 502;
          console.error(`No image in generation ${i + 1} response`);
          continue;
        }

        const imageBuffer = Uint8Array.from(atob(generatedImage), (c) => c.charCodeAt(0));
        const filePath = `${userId}/generated/${imageRecord.id}-${i + 1}.png`;
        const { error: uploadError } = await supabase.storage
          .from('jewelry-images')
          .upload(filePath, imageBuffer, { contentType: 'image/png' });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('jewelry-images')
            .getPublicUrl(filePath);
          generatedUrls.push(publicUrl);
          console.log(`Variation ${i + 1} uploaded successfully`);
        } else {
          lastGenerationError = `Upload error: ${JSON.stringify(uploadError)}`;
          lastGenerationStatus = 500;
          console.error(`Upload error for variation ${i + 1}:`, uploadError);
        }
      } catch (genError) {
        lastGenerationError = genError instanceof Error ? genError.message : String(genError);
        lastGenerationStatus = 500;
        console.error(`Generation ${i + 1} error:`, genError);
      }
    }

    if (generatedUrls.length === 0) {
      const friendlyError = (() => {
        // Known Google restriction (seen in logs)
        if (lastGenerationError?.includes('Image generation is not available in your country')) {
          return 'Image generation is not available in your country for this API key/project.';
        }
        return 'No images generated';
      })();

      await supabase
        .from('images')
        .update({ status: 'failed', error_message: friendlyError })
        .eq('id', imageRecord.id);

      return new Response(
        JSON.stringify({ error: friendlyError, details: lastGenerationError }),
        { status: lastGenerationStatus ?? 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduct credit
    await supabase
      .from('profiles')
      .update({ credits: profile.credits - 1 })
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
