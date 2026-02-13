import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient } from './_lib/supabase.js';
import { corsHeaders, sendCorsResponse } from './_lib/cors.js';
import { GoogleGenAI } from '@google/genai';

export const config = {
  maxDuration: 300,
};

const CORE_FRAMEWORK = `ULTRA-PREMIUM LUXURY JEWELRY CINEMATOGRAPHY — Advertising campaign quality.

CINEMATIC PHILOSOPHY:
- Every frame is a work of art — museum-quality visual composition
- Slow-motion elegance with breathtaking fluidity
- Light dances across metal and gemstones with mesmerizing realism
- Each second reveals new facets, reflections, and micro-details
- The viewer should feel the weight, the craftsmanship, the luxury

COMPLIANCE (CRITICAL):
- No celebrity references, no real person's name or likeness
- Use generic, non-identifiable model only (if visible)
- No text, no watermarks, no logos`;

const JEWELRY_VIDEO_PROMPTS: Record<string, string> = {
  default: `${CORE_FRAMEWORK}

SCENE: Ultra slow-motion 360° rotation on a dark velvet surface. The jewelry piece rotates imperceptibly slowly, like a museum turntable. Light catches each facet as it turns — diamonds fire, metal gleams, settings sparkle.

CAMERA: Cinematic macro lens (100mm f/2.8). Extremely slow dolly-in combined with the rotation. Starts from medium shot, ends at intimate macro detail. Silky smooth motion, zero shake, tripod-mounted cinema rig feel.

LIGHTING: Dramatic three-point lighting. Key light from upper-left creates sculpted shadows. Rim light from behind produces a luminous golden edge glow on metal. Subtle fill prevents black crush. Occasional caustic light patterns from gemstone refractions dance across the velvet surface.

MOTION: Ultra slow-motion (240fps feel). The rotation is so slow it feels meditative. Light reflections move like liquid gold across metal surfaces. Each diamond facet triggers a brief, natural sparkle.

PRODUCT INTEGRITY: Metal color EXACT — preserve gold warmth, silver coolness, or rose gold blush. Every prong, setting, and stone position unchanged. Natural material behavior only — real physics of light on metal and stone.

ATMOSPHERE: Dark, moody, cinematic. Shallow depth of field with dreamy bokeh in background. Rich color grading — deep blacks, warm highlights, controlled midtones. Feels like a Cartier or Tiffany & Co. campaign.`,

  model: `${CORE_FRAMEWORK}

SCENE: Elegant slow-motion lifestyle moment. Model in a luxury environment — soft natural light streaming through sheer curtains. The model makes a subtle, graceful movement — touching collarbone, adjusting hair, turning chin — that naturally showcases the jewelry.

CAMERA: Cinema-grade portrait lens (85mm f/1.4). Slow drift from profile to three-quarter view. Ultra-smooth horizontal tracking. The jewelry remains in razor-sharp focus while the background melts into creamy cinematic bokeh.

LIGHTING: Golden hour warmth flooding from one side. Soft, flattering, directional. Skin glows naturally. Metal catches warm highlights. Gemstones create subtle prismatic flashes as the model moves.

MOTION: Slow-motion (120fps feel). The model's movement is graceful and minimal — barely a breath. Hair moves slightly. Fabric drapes softly. The jewelry catches and releases light with each micro-movement. Natural skin texture visible — pores, fine lines, real human beauty.

PRODUCT INTEGRITY: Jewelry is the hero — always in focus, always prominent. Metal color preserved exactly. Stone settings accurate. Natural interaction between skin and metal — no floating, no CGI.

ATMOSPHERE: Warm, intimate, aspirational. Like a luxury brand's hero campaign film. Soft film grain optional. Rich, warm color palette.`,

  product: `${CORE_FRAMEWORK}

SCENE: Precision product showcase on pristine white-to-grey gradient surface. The jewelry sits perfectly centered. An invisible turntable produces an imperceptible slow rotation. Light plays across every surface with mathematical precision.

CAMERA: Macro cinema lens (100mm). Extremely slow push-in from establishing shot to extreme close-up. The transition is so smooth it feels like floating toward the piece. Deep focus throughout — every detail razor sharp.

LIGHTING: Soft studio lighting from multiple angles. Clean, even illumination that reveals every detail. Subtle catch lights in gemstones. Controlled reflections on polished metal. Minimal shadows — just enough for depth and dimension.

MOTION: Ultra slow rotation — 15° over the entire clip. Combined with the push-in, it creates a hypnotic reveal of the jewelry's construction. Each second shows new angles of stone cuts, prong details, metal grain patterns.

PRODUCT INTEGRITY: 100% faithful reproduction. Metal color exact. Proportions unchanged. No enhancement, no artistic license with the product itself. This is a product documentation piece — absolute accuracy.

ATMOSPHERE: Clean, bright, commercial perfection. E-commerce meets cinematic quality. Professional, trustworthy, premium.`,

  closeup: `${CORE_FRAMEWORK}

SCENE: Extreme macro close-up of the jewelry's finest details. The camera explores the piece like a scientific instrument discovering beauty. Diamond facets become landscapes. Metal grain becomes terrain. Prong settings become architecture.

CAMERA: Extreme macro (1:1 magnification feel). Ultra-slow pan across the jewelry's surface. Moving from one point of interest to another — stone to setting to metal to engraving. Incredibly shallow depth of field creates dreamy bokeh even within the piece itself.

LIGHTING: Precise spot lighting that follows the camera's exploration. As we move across the piece, light reveals hidden details — internal reflections in stones, micro-textures in brushed metal, the precise meeting point of stone and setting.

MOTION: Glacially slow lateral pan across the piece. Each second reveals a new micro-world of detail. Light shifts create mesmerizing caustic patterns. Diamond fire appears and disappears. Metal reflects and absorbs.

PRODUCT INTEGRITY: Ultimate fidelity. This is about revealing the real craftsmanship. Every scratch in brushed metal, every inclusion in natural stones, every imperfection that proves authenticity. No CGI cleanup.

ATMOSPHERE: Intimate, reverent, awe-inspiring. Like watching a master craftsman's work under a jeweler's loupe. Deep, dark, focused.`,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const GOOGLE_API_KEY = process.env.GOOGLE_VEO_API_KEY || process.env.GOOGLE_API_KEY;
    if (!GOOGLE_API_KEY) throw new Error('GOOGLE_VEO_API_KEY or GOOGLE_API_KEY is not configured');

    const supabase = getServiceClient();

    const authHeader = req.headers.authorization;
    if (!authHeader) throw new Error('Authorization required');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Invalid authentication');

    const { imageUrl, videoId, promptType = 'default', videoFormat = '9:16' } = req.body;
    if (!imageUrl) throw new Error('Image URL is required');
    if (!videoId) throw new Error('Video ID is required');

    console.log('Starting video generation for user:', user.id);

    // Credit check
    const VIDEO_CREDIT_COST = 200;
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    const isAdminUser = isAdmin === true;

    if (!isAdminUser) {
      const { data: deductResult, error: deductError } = await supabase
        .rpc('deduct_credits', { _user_id: user.id, _amount: VIDEO_CREDIT_COST });

      if (deductError) {
        await supabase.from('videos').update({ status: 'error', error_message: 'Kredi kontrolü sırasında hata oluştu' }).eq('id', videoId);
        return sendCorsResponse(res, 500, { error: 'Kredi kontrolü sırasında hata oluştu' });
      }

      if (!deductResult?.success) {
        await supabase.from('videos').update({ status: 'error', error_message: `Yetersiz kredi. ${VIDEO_CREDIT_COST} kredi gerekli.` }).eq('id', videoId);
        return sendCorsResponse(res, 402, { error: `Yetersiz kredi. ${VIDEO_CREDIT_COST} kredi gerekli, mevcut: ${deductResult?.current_credits ?? 0}.` });
      }
    }

    const selectedPrompt = JEWELRY_VIDEO_PROMPTS[promptType] || JEWELRY_VIDEO_PROMPTS.default;
    const fullPrompt = `${selectedPrompt}

GLOBAL CINEMATIC LOCKS:
- Frame rate: 24fps smooth cinematic feel
- Duration: 5-8 seconds of elegant stillness
- Motion speed: Very slow, almost imperceptible
- Camera shake: ZERO (tripod-mounted cinema feel)
- Color grading: Neutral, preserves metal truth
- Quality: Advertising-grade production value`;

    await supabase.from('videos').update({ status: 'generating', prompt: fullPrompt, error_message: 'Video API\'ye bağlanılıyor...' }).eq('id', videoId);

    // Fetch source image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      await supabase.from('videos').update({ status: 'error', error_message: 'Kaynak görsel yüklenemedi' }).eq('id', videoId);
      throw new Error('Failed to fetch source image');
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const uint8Array = new Uint8Array(imageBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Image = btoa(binary);
    const mimeType = imageResponse.headers.get('content-type') || 'image/png';

    await supabase.from('videos').update({ error_message: 'Google Veo 3.1 API çağrılıyor...' }).eq('id', videoId);

    const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

    let veo31OperationName: string | undefined;
    let veo31ErrorText: string | undefined;

    try {
      const operation: any = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: fullPrompt,
        image: { imageBytes: base64Image, mimeType },
        config: { aspectRatio: videoFormat === '16:9' ? '16:9' : '9:16' },
      });
      veo31OperationName = operation?.name;
    } catch (err) {
      veo31ErrorText = err instanceof Error ? err.message : String(err);
      console.error('Veo 3.1 error:', err);
    }

    if (!veo31OperationName) {
      // Veo 2.0 fallback
      console.log('Trying Veo 2.0 text-to-video fallback...');
      const veo2Response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning?key=${GOOGLE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: fullPrompt }],
            parameters: { aspectRatio: videoFormat === '16:9' ? '16:9' : '9:16', sampleCount: 1, durationSeconds: 5, personGeneration: 'allow_adult' },
          }),
        }
      );

      if (!veo2Response.ok) {
        const veo2ErrorText = await veo2Response.text();
        await supabase.from('videos').update({
          status: 'error',
          error_message: `Video API hatası: ${(veo31ErrorText || '').substring(0, 100)}`,
        }).eq('id', videoId);
        return sendCorsResponse(res, 400, { success: false, error: 'Video API error', veo31Error: veo31ErrorText, veo2Error: veo2ErrorText });
      }

      const veo2Data = await veo2Response.json();
      if (veo2Data.name) {
        await supabase.from('videos').update({ status: 'processing', operation_id: veo2Data.name, error_message: 'Video oluşturuluyor (Veo 2.0)...' }).eq('id', videoId);
        return sendCorsResponse(res, 200, { success: true, status: 'processing', operationId: veo2Data.name, videoId });
      }
    }

    if (veo31OperationName) {
      await supabase.from('videos').update({ status: 'processing', operation_id: veo31OperationName, error_message: 'Video oluşturuluyor...' }).eq('id', videoId);
      return sendCorsResponse(res, 200, { success: true, status: 'processing', operationId: veo31OperationName, videoId });
    }

    await supabase.from('videos').update({ status: 'error', error_message: 'Video başlatılamadı' }).eq('id', videoId);
    return sendCorsResponse(res, 500, { success: false, error: 'No operation ID received' });

  } catch (error) {
    console.error('Error in generate-video:', error);
    return sendCorsResponse(res, 500, { success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
