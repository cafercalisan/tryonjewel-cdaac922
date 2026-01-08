import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
    
    // Fetch the image and convert to base64 for Gemini API
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();
    const imageBuffer = await imageBlob.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
    
    const analysisResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`, {
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

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error('Analysis API error:', errorText);
      throw new Error('Analysis failed');
    }

    const analysisData = await analysisResponse.json();
    let analysisResult;
    try {
      const content = analysisData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      analysisResult = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
      console.error('Failed to parse analysis, using defaults');
      analysisResult = { type: 'jewelry', design_elements: { style: 'classic' } };
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

    // Step 2: Generate 2 variations
    const generatedUrls: string[] = [];
    
    for (let i = 0; i < 2; i++) {
      console.log(`Generating variation ${i + 1}/2...`);
      
      try {
        const genResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GOOGLE_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: fullPrompt },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: base64Image
                  }
                }
              ]
            }],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
              temperature: 0.4
            }
          }),
        });

        if (!genResponse.ok) {
          console.error(`Generation ${i + 1} API error:`, await genResponse.text());
          continue;
        }

        const genData = await genResponse.json();
        console.log(`Generation ${i + 1} response structure:`, JSON.stringify(genData, null, 2).substring(0, 500));
        
        // Extract image from Gemini response
        const parts = genData.candidates?.[0]?.content?.parts || [];
        let generatedImage = null;
        
        for (const part of parts) {
          if (part.inlineData?.mimeType?.startsWith('image/')) {
            generatedImage = part.inlineData.data;
            break;
          }
        }
        
        if (generatedImage) {
          // Upload to storage
          const imageBuffer = Uint8Array.from(atob(generatedImage), c => c.charCodeAt(0));
          
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
            console.error(`Upload error for variation ${i + 1}:`, uploadError);
          }
        } else {
          console.log(`No image in generation ${i + 1} response`);
        }
      } catch (genError) {
        console.error(`Generation ${i + 1} error:`, genError);
      }
    }

    if (generatedUrls.length === 0) {
      // Update status to failed
      await supabase
        .from('images')
        .update({ status: 'failed', error_message: 'No images generated' })
        .eq('id', imageRecord.id);
      throw new Error('No images generated');
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
