import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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
    console.log('Design generation request received');

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI is not configured (missing LOVABLE_API_KEY)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Fetch product images and convert to data URLs (avoid call stack issues)
    const productImageDataUrls: string[] = [];
    for (const url of productImageUrls.slice(0, 3)) {
      try {
        console.log('Fetching image:', url);
        const response = await fetch(url);
        if (!response.ok) {
          console.error('Failed to fetch image:', response.status);
          continue;
        }

        const contentType = response.headers.get('content-type') || 'image/png';
        const buffer = await response.arrayBuffer();
        const b64 = encode(buffer);
        productImageDataUrls.push(`data:${contentType};base64,${b64}`);
        console.log('Image fetched successfully, size:', buffer.byteLength);
      } catch (e) {
        console.error('Error fetching product image:', e);
      }
    }

    if (productImageDataUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Could not fetch product images' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build prompt based on design type and mode
    const modePrompts: Record<string, string> = {
      kampanya:
        'High-end luxury sale campaign aesthetic. Bold yet elegant typography placement. Premium fashion brand advertising style like Cartier or Tiffany campaigns.',
      koleksiyon:
        'Exclusive collection launch visual. Editorial fashion photography style. Vogue magazine aesthetic with sophisticated minimalism.',
      reklam:
        'Cinematic luxury advertisement. Hollywood-style glamour lighting. Premium brand commercial aesthetic like Bulgari or Van Cleef & Arpels.',
      sinematik:
        'Ultra cinematic movie poster style. Dramatic lighting and shadows. Anamorphic lens flare effects. Epic and luxurious mood.',
    };

    const typePrompts: Record<string, string> = {
      instagram: `Instagram post design (${aspectRatio || '3:4'} aspect ratio). Modern luxury social media aesthetic. Clean composition with elegant typography space.`,
      banner: `Web banner design (${aspectRatio || '16:9'} aspect ratio). Premium website hero banner. Sophisticated horizontal composition for luxury jewelry brand.`,
    };

    const selectedMode = modePrompts[designMode] || modePrompts.kampanya;
    const selectedType = typePrompts[designType] || typePrompts.instagram;

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

    console.log('Generating design with Lovable AI gateway...');

    const userContent: any[] = [{ type: 'text', text: designPrompt }];

    for (const dataUrl of productImageDataUrls) {
      userContent.push({
        type: 'image_url',
        image_url: { url: dataUrl },
      });
    }

    if (logoBase64) {
      userContent.push({
        type: 'image_url',
        image_url: { url: logoBase64 },
      });
    }

    const genResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: userContent,
          },
        ],
        modalities: ['image', 'text'],
      }),
    });

    if (!genResponse.ok) {
      const t = await genResponse.text();
      console.error('AI gateway error:', genResponse.status, t);

      if (genResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit aşıldı, lütfen biraz sonra tekrar deneyin.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (genResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI kullanım kredisi yetersiz. Lütfen çalışma alanı kredinizi kontrol edin.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Design generation failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const genData = await genResponse.json();
    const dataUrl = genData?.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined;

    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      console.error('No image in gateway response');
      return new Response(
        JSON.stringify({ error: 'No image generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generation response received');

    // Extract base64 payload from data URL
    const commaIndex = dataUrl.indexOf(',');
    const meta = dataUrl.slice(0, commaIndex);
    const payload = dataUrl.slice(commaIndex + 1);
    const mimeMatch = meta.match(/^data:(image\/[^;]+);base64$/);
    const outMime = mimeMatch?.[1] || 'image/png';

    // Upload to storage
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const imageBuffer = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
    const ext = outMime === 'image/jpeg' ? 'jpg' : outMime === 'image/webp' ? 'webp' : 'png';
    const fileName = `designs/${Date.now()}-${designType}-${designMode}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('jewelry-images')
      .upload(fileName, imageBuffer, { contentType: outMime });

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
