import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient } from './_lib/supabase.js';
import { authenticateUser } from './_lib/auth.js';
import { corsHeaders, sendCorsResponse } from './_lib/cors.js';

export const config = {
  maxDuration: 300,
};

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('Design generation request received');

    const authResult = await authenticateUser(req);
    if ('error' in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }

    console.log('Authenticated user:', authResult.userId);

    if (!GOOGLE_API_KEY) {
      return sendCorsResponse(res, 500, { error: 'AI is not configured (missing GOOGLE_API_KEY)' });
    }

    const { productImageUrls, logoBase64, campaignText, designType, designMode, aspectRatio } = req.body;

    console.log('Request params:', {
      imageCount: productImageUrls?.length,
      hasLogo: !!logoBase64,
      designType,
      designMode,
      aspectRatio,
    });

    if (!productImageUrls || productImageUrls.length === 0) {
      return sendCorsResponse(res, 400, { error: 'No product images provided' });
    }

    // Fetch product images and convert to base64
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
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192) {
          const chunk = bytes.subarray(i, Math.min(i + 8192, bytes.length));
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const b64 = btoa(binary);
        productImageDataUrls.push(`data:${contentType};base64,${b64}`);
        console.log('Image fetched successfully, size:', buffer.byteLength);
      } catch (e) {
        console.error('Error fetching product image:', e);
      }
    }

    if (productImageDataUrls.length === 0) {
      return sendCorsResponse(res, 400, { error: 'Could not fetch product images' });
    }

    // Build prompt
    const modePrompts: Record<string, string> = {
      kampanya: 'High-end luxury sale campaign aesthetic. Bold yet elegant typography placement. Premium fashion brand advertising style like Cartier or Tiffany campaigns.',
      koleksiyon: 'Exclusive collection launch visual. Editorial fashion photography style. Vogue magazine aesthetic with sophisticated minimalism.',
      reklam: 'Cinematic luxury advertisement. Hollywood-style glamour lighting. Premium brand commercial aesthetic like Bulgari or Van Cleef & Arpels.',
      sinematik: 'Ultra cinematic movie poster style. Dramatic lighting and shadows. Anamorphic lens flare effects. Epic and luxurious mood.',
    };

    const typePrompts: Record<string, string> = {
      instagram: `Instagram post design (${aspectRatio || '3:4'} aspect ratio). Modern luxury social media aesthetic. Clean composition with elegant typography space.`,
      banner: `Web banner design (${aspectRatio || '16:9'} aspect ratio). Premium website hero banner. Sophisticated horizontal composition for luxury jewelry brand.`,
    };

    const selectedMode = modePrompts[designMode] || modePrompts.kampanya;
    const selectedType = typePrompts[designType] || typePrompts.instagram;

    const designPrompt = `Create a stunning luxury jewelry marketing design with REAL design elements.

DESIGN TYPE:
${selectedType}

STYLE & MOOD:
${selectedMode}

CRITICAL DESIGN ELEMENTS TO INCLUDE:
- Geometric patterns: Art deco lines, golden ratio spirals, diamond shapes
- Luxury textures: Subtle marble veins, brushed gold accents, silk textures
- Premium borders: Elegant frames with ornate corners
- Decorative motifs: Subtle filigree patterns, jewel-inspired ornaments
- Typography layout: Create visual hierarchy with styled text blocks
- Visual depth: Layered elements, shadows, reflections

PRODUCT INTEGRATION:
- Place the jewelry as the hero centerpiece
- Create visual harmony between design elements and product
- Maintain exact product details and proportions
- Surround with complementary decorative elements

${campaignText ? `CAMPAIGN TEXT TO INCLUDE:\n"${campaignText}"\n- Use premium luxury serif typography (Didot, Bodoni, Playfair Display style)\n- Create typographic art - stylized letter spacing, elegant ligatures\n- Text should be part of the design composition, not just overlaid\n- Add decorative flourishes around key text` : ''}

${logoBase64 ? `LOGO INTEGRATION:\n- Place logo with decorative frame or border\n- Integrate naturally into the overall design composition\n- Professional brand placement with design context` : ''}

COLOR PALETTE:
- Rich jewel tones: deep emerald, sapphire blue, ruby red, amethyst purple
- Luxury metallics: gold, rose gold, platinum, champagne
- Elegant neutrals: ivory, charcoal, soft black
- Accent gradients: subtle color transitions for depth

DESIGN COMPOSITION:
- Use rule of thirds for balanced layout
- Create visual flow that guides eye to product
- Include breathing space balanced with decorative richness
- Layer elements: background texture → patterns → product → text → accents

OUTPUT REQUIREMENTS:
- Complete, polished marketing design (not just product on plain background)
- Cartier/Tiffany/Vogue advertisement quality
- Print-ready professional composition
- Every element intentionally designed`;

    console.log('Generating design with Google Gemini API...');

    const contentParts: any[] = [{ text: designPrompt }];

    for (const dataUrl of productImageDataUrls) {
      const commaIdx = dataUrl.indexOf(',');
      const base64Data = dataUrl.slice(commaIdx + 1);
      const mimeType = dataUrl.slice(5, commaIdx).split(';')[0] || 'image/png';
      contentParts.push({ inline_data: { mime_type: mimeType, data: base64Data } });
    }

    if (logoBase64) {
      const commaIdx = logoBase64.indexOf(',');
      const base64Data = logoBase64.slice(commaIdx + 1);
      const mimeType = logoBase64.slice(5, commaIdx).split(';')[0] || 'image/png';
      contentParts.push({ inline_data: { mime_type: mimeType, data: base64Data } });
    }

    // Discover working image-generation model
    const modelsResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GOOGLE_API_KEY}`, { method: 'GET' });
    const modelsJson = modelsResp.ok ? await modelsResp.json() : null;
    const modelCandidates = Array.isArray(modelsJson?.models)
      ? modelsJson.models
          .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map((m: any) => String(m.name || ''))
          .filter(Boolean)
      : [];

    const preferred = modelCandidates.filter((n: string) => n.toLowerCase().includes('image'));
    const chosenModel = preferred[0] || modelCandidates[0];

    if (!chosenModel) {
      return sendCorsResponse(res, 503, { error: 'AI model is not available right now' });
    }

    const genResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${chosenModel}:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: contentParts }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            temperature: 0.5,
          },
        }),
      }
    );

    if (!genResponse.ok) {
      const t = await genResponse.text();
      console.error('Gemini API error:', genResponse.status, t);

      if (genResponse.status === 429) {
        return sendCorsResponse(res, 429, { error: 'Rate limit aşıldı, lütfen biraz sonra tekrar deneyin.' });
      }

      return sendCorsResponse(res, 500, { error: 'Design generation failed' });
    }

    const genData = await genResponse.json();
    console.log('Generation response received');

    const parts = genData.candidates?.[0]?.content?.parts || [];
    let generatedImage: string | null = null;

    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        generatedImage = part.inlineData.data;
        break;
      }
    }

    if (!generatedImage) {
      return sendCorsResponse(res, 500, { error: 'No image generated' });
    }

    const supabase = getServiceClient();
    const imageBuffer = Uint8Array.from(atob(generatedImage), (c) => c.charCodeAt(0));
    const fileName = `designs/${Date.now()}-${designType}-${designMode}.png`;

    const { error: uploadError } = await supabase.storage
      .from('jewelry-images')
      .upload(fileName, imageBuffer, { contentType: 'image/png' });

    if (uploadError) {
      return sendCorsResponse(res, 500, { error: 'Failed to save design' });
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('jewelry-images')
      .createSignedUrl(fileName, 7 * 24 * 60 * 60); // 7-day signed URL

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error('Failed to create signed URL for design:', signedUrlError);
      return sendCorsResponse(res, 500, { error: 'Failed to generate design URL' });
    }

    console.log('Design generated and uploaded:', signedUrlData.signedUrl);

    return sendCorsResponse(res, 200, { success: true, designUrl: signedUrlData.signedUrl });

  } catch (error) {
    console.error('Error:', error);
    return sendCorsResponse(res, 500, { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
