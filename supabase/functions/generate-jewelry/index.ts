import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, sceneId, userId } = await req.json();
    console.log('Generate request:', { imageUrl, sceneId, userId });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get scene details
    const { data: scene, error: sceneError } = await supabase
      .from('scenes')
      .select('*')
      .eq('id', sceneId)
      .single();

    if (sceneError || !scene) {
      throw new Error('Scene not found');
    }

    // Create image record
    const { data: imageRecord, error: insertError } = await supabase
      .from('images')
      .insert({
        user_id: userId,
        scene_id: sceneId,
        original_image_url: imageUrl,
        status: 'analyzing',
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Step 1: Analyze the jewelry
    console.log('Step 1: Analyzing jewelry...');
    const analysisResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this jewelry image in detail and return a JSON object with the following structure:
{
  "type": "ring|necklace|bracelet|earring|pendant|other",
  "metal_type": "gold|silver|platinum|rose_gold|white_gold|other",
  "metal_color": "yellow|white|rose|silver|other",
  "metal_finish": "polished|matte|brushed|hammered|textured",
  "main_stone": {"type": "diamond|ruby|emerald|sapphire|pearl|none|other", "color": "string", "cut": "round|princess|oval|cushion|emerald|pear|marquise|other"},
  "stone_count": number,
  "setting_type": "prong|bezel|channel|pave|tension|none|other",
  "design_style": "modern|vintage|minimalist|ornate|classic|art_deco|other",
  "additional_details": "string describing unique features"
}
Only respond with valid JSON, no other text.`
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
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
      const content = analysisData.choices?.[0]?.message?.content || '{}';
      analysisResult = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
      analysisResult = { type: 'jewelry', design_style: 'classic' };
    }

    console.log('Analysis result:', analysisResult);

    // Update status to generating
    await supabase
      .from('images')
      .update({ status: 'generating', analysis_data: analysisResult })
      .eq('id', imageRecord.id);

    // Build dynamic prompt
    const fidelityBlock = `
The jewelry is a ${analysisResult.type || 'piece'} made of ${analysisResult.metal_color || ''} ${analysisResult.metal_finish || ''} ${analysisResult.metal_type || 'metal'}.
${analysisResult.main_stone?.type && analysisResult.main_stone.type !== 'none' ? `It features ${analysisResult.stone_count || 'a'} ${analysisResult.main_stone.type} stone(s) in ${analysisResult.main_stone.cut || ''} cut.` : ''}
${analysisResult.setting_type && analysisResult.setting_type !== 'none' ? `Setting type: ${analysisResult.setting_type}.` : ''}
Design style: ${analysisResult.design_style || 'classic'}.
${analysisResult.additional_details || ''}

CRITICAL PRESERVATION RULES:
- Maintain exactly the same number of stones
- Preserve the exact prong/setting structure
- Keep the exact metal color and finish
- Maintain original proportions and scale
- No design modifications allowed
`.trim();

    const fullPrompt = `Ultra high-end jewelry photography. Photorealistic. 4:5 portrait aspect ratio.

${fidelityBlock}

${scene.prompt}

Quality requirements: Macro photography look, controlled studio lighting, natural reflections, clean background.
No text, no watermark, no logos.`;

    console.log('Generating with prompt:', fullPrompt.substring(0, 200) + '...');

    // Step 2: Generate 3 variations
    const generatedUrls: string[] = [];
    
    for (let i = 0; i < 3; i++) {
      console.log(`Generating variation ${i + 1}/3...`);
      
      const genResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-pro-image-preview',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: fullPrompt },
                { type: 'image_url', image_url: { url: imageUrl } }
              ]
            }
          ],
          modalities: ['image', 'text'],
        }),
      });

      if (!genResponse.ok) {
        console.error(`Generation ${i + 1} failed:`, await genResponse.text());
        continue;
      }

      const genData = await genResponse.json();
      const generatedImage = genData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      if (generatedImage) {
        // Upload to storage
        const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        
        const filePath = `${userId}/generated/${imageRecord.id}-${i + 1}.png`;
        const { error: uploadError } = await supabase.storage
          .from('jewelry-images')
          .upload(filePath, imageBuffer, { contentType: 'image/png' });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('jewelry-images')
            .getPublicUrl(filePath);
          generatedUrls.push(publicUrl);
        }
      }
    }

    if (generatedUrls.length === 0) {
      throw new Error('No images generated');
    }

    // Deduct credit
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();

    if (profile && profile.credits > 0) {
      await supabase
        .from('profiles')
        .update({ credits: profile.credits - 1 })
        .eq('id', userId);
    }

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
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
