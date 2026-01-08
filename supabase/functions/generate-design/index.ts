import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Design generation request received');

    const { 
      productImageUrls, 
      logoBase64, 
      campaignText, 
      designType, 
      designMode,
      aspectRatio 
    } = await req.json();

    console.log('Request params:', { 
      imageCount: productImageUrls?.length, 
      hasLogo: !!logoBase64, 
      designType, 
      designMode,
      aspectRatio 
    });

    if (!productImageUrls || productImageUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No product images provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch product images and convert to base64
    const productImagesBase64: string[] = [];
    for (const url of productImageUrls.slice(0, 3)) {
      try {
        console.log('Fetching image:', url);
        const response = await fetch(url);
        if (!response.ok) {
          console.error('Failed to fetch image:', response.status);
          continue;
        }
        const buffer = await response.arrayBuffer();
        // Use Deno's base64 encoder instead of btoa with spread operator
        const base64 = encode(buffer);
        productImagesBase64.push(base64);
        console.log('Image fetched successfully, size:', buffer.byteLength);
      } catch (e) {
        console.error('Error fetching product image:', e);
      }
    }

    if (productImagesBase64.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Could not fetch product images' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build prompt based on design type and mode
    const modePrompts: Record<string, string> = {
      'kampanya': 'High-end luxury sale campaign aesthetic. Bold yet elegant typography placement. Premium fashion brand advertising style like Cartier or Tiffany campaigns.',
      'koleksiyon': 'Exclusive collection launch visual. Editorial fashion photography style. Vogue magazine aesthetic with sophisticated minimalism.',
      'reklam': 'Cinematic luxury advertisement. Hollywood-style glamour lighting. Premium brand commercial aesthetic like Bulgari or Van Cleef & Arpels.',
      'sinematik': 'Ultra cinematic movie poster style. Dramatic lighting and shadows. Anamorphic lens flare effects. Epic and luxurious mood.'
    };

    const typePrompts: Record<string, string> = {
      'instagram': `Instagram post design (${aspectRatio || '1:1'} aspect ratio). Modern luxury social media aesthetic. Clean composition with elegant typography space.`,
      'banner': `Web banner design (${aspectRatio || '16:9'} aspect ratio). Premium website hero banner. Sophisticated horizontal composition for luxury jewelry brand.`
    };

    const selectedMode = modePrompts[designMode] || modePrompts['kampanya'];
    const selectedType = typePrompts[designType] || typePrompts['instagram'];

    const designPrompt = `Create a professional luxury jewelry marketing design.

DESIGN TYPE:
${selectedType}

STYLE & MOOD:
${selectedMode}

PRODUCT INTEGRATION:
- Feature the jewelry product prominently as the hero element
- Maintain exact product details and proportions
- Professional product photography integration
- Elegant placement with breathing room

${campaignText ? `CAMPAIGN TEXT TO INCLUDE:
"${campaignText}"
- Use premium luxury typography (Didot, Bodoni, or similar serif fonts)
- Elegant text placement that complements the jewelry
- Text should feel like high-end fashion advertising` : ''}

${logoBase64 ? `LOGO INTEGRATION:
- Subtly place the provided logo in an appropriate corner
- Logo should be elegant and not overpower the jewelry
- Professional brand placement` : ''}

VISUAL REQUIREMENTS:
- Ultra premium luxury aesthetic
- Clean, sophisticated color palette (black, gold, cream, deep jewel tones)
- Professional lighting and shadows
- High-end fashion magazine quality
- No cluttered or cheap-looking elements
- Subtle gradient backgrounds or solid luxury colors
- Professional depth and dimension

OUTPUT:
- Single cohesive marketing visual
- Ready for social media or web use
- Professional advertising quality`;

    console.log('Generating design with prompt...');

    // Build content parts
    const contentParts: any[] = [
      { text: designPrompt }
    ];

    // Add product images
    for (const base64 of productImagesBase64) {
      contentParts.push({
        inline_data: {
          mime_type: "image/jpeg",
          data: base64
        }
      });
    }

    // Add logo if provided
    if (logoBase64) {
      // Remove data URL prefix if present
      const cleanLogo = logoBase64.replace(/^data:image\/\w+;base64,/, '');
      contentParts.push({
        inline_data: {
          mime_type: "image/png",
          data: cleanLogo
        }
      });
    }

    const genResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: contentParts
        }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          temperature: 0.6
        }
      }),
    });

    if (!genResponse.ok) {
      const errorText = await genResponse.text();
      console.error('Generation API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Design generation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const genData = await genResponse.json();
    console.log('Generation response received');

    // Extract image from response
    const parts = genData.candidates?.[0]?.content?.parts || [];
    let generatedImage = null;

    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        generatedImage = part.inlineData.data;
        break;
      }
    }

    if (!generatedImage) {
      console.error('No image in response');
      return new Response(
        JSON.stringify({ error: 'No image generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upload to storage
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const imageBuffer = Uint8Array.from(atob(generatedImage), c => c.charCodeAt(0));
    const fileName = `designs/${Date.now()}-${designType}-${designMode}.png`;
    
    const { error: uploadError } = await supabase.storage
      .from('jewelry-images')
      .upload(fileName, imageBuffer, { contentType: 'image/png' });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to save design' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { publicUrl } } = supabase.storage
      .from('jewelry-images')
      .getPublicUrl(fileName);

    console.log('Design generated and uploaded:', publicUrl);

    return new Response(
      JSON.stringify({ success: true, designUrl: publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
