import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient } from './_lib/supabase.js';
import { corsHeaders, sendCorsResponse } from './_lib/cors.js';
import { GoogleGenAI } from '@google/genai';

export const config = {
  maxDuration: 300,
};

const ANIMATION_CORE = `⚠️ CRITICAL — IMAGE-TO-VIDEO ANIMATION TASK ⚠️
The provided image is your EXACT FIRST FRAME.
Your ONLY job is to bring THIS EXACT IMAGE to life with subtle, elegant motion.

ABSOLUTE RULES:
- DO NOT create new products, new objects, or new compositions
- DO NOT change the jewelry, the scene, the background, or the colors
- DO NOT generate different or additional items
- The video MUST start as a pixel-perfect match of the input image
- Then add ONLY subtle cinematic motion to animate what already exists
- Every element in the image stays exactly where it is
- Product shape, metal color, stone positions — ALL UNCHANGED

COMPLIANCE:
- No celebrity references, no real person's name or likeness
- No text, no watermarks, no logos`;

const JEWELRY_VIDEO_PROMPTS: Record<string, string> = {
  default: `${ANIMATION_CORE}

ANIMATE THIS IMAGE: Add a very slow, subtle camera push-in toward the jewelry. The camera drifts forward almost imperceptibly, revealing finer details as it approaches. Light gently shifts across the metal and stone surfaces creating natural sparkle and reflection movement.

MOTION DETAILS:
- Ultra-slow dolly-in (barely noticeable advance over 5-8 seconds)
- Light reflections on metal slowly shift as if a soft light source is breathing
- Any gemstones produce subtle, natural scintillation — tiny flashes of fire
- If there are fabric/surface textures in the image, they remain perfectly still
- Shallow depth of field gradually reveals sharper focus on the jewelry

SPEED: Extremely slow, meditative, luxurious. Every motion takes its time.
FEEL: Like watching a premium jewelry ad in ultra slow-motion. Cartier, Tiffany level.`,

  model: `${ANIMATION_CORE}

ANIMATE THIS IMAGE: The model in this image comes to life with minimal, elegant movement. A subtle breath, a very slight head turn, the tiniest shift in weight. The jewelry catches light naturally as the model moves.

MOTION DETAILS:
- Model makes only micro-movements: gentle breathing, slight chin tilt, soft blink
- Hair may move ever so slightly as if touched by a gentle breeze
- Jewelry responds naturally to body movement — slight sway, light catching
- Skin texture remains photorealistic — pores visible, no beauty blur
- Camera holds steady or drifts imperceptibly

SPEED: Ultra slow-motion feel (120fps). Every gesture is stretched and elegant.
FEEL: Fashion editorial film. The model is almost a living sculpture.`,

  product: `${ANIMATION_CORE}

ANIMATE THIS IMAGE: The jewelry in this image begins an imperceptibly slow rotation on its surface. The camera holds steady while the product turns just a few degrees, revealing different angles of light on its surfaces.

MOTION DETAILS:
- Product rotates no more than 10-15 degrees total over the entire clip
- Light plays across metal surfaces as the angle changes — reflections slide smoothly
- Gemstone facets catch and release light creating natural sparkle patterns
- Background and surface remain completely static
- Deep focus — the entire product stays sharp

SPEED: Glacially slow rotation. The viewer almost doesn't notice the motion.
FEEL: Premium e-commerce product video. Clean, precise, professional.`,

  closeup: `${ANIMATION_CORE}

ANIMATE THIS IMAGE: A very slow lateral camera drift across the jewelry surface, exploring the fine details. The camera moves like a macro lens scanning across the piece, revealing textures and reflections.

MOTION DETAILS:
- Ultra-slow horizontal pan across the jewelry (a few millimeters per second feel)
- As the camera position shifts, light reveals hidden facets and surface details
- Gemstone fire patterns shift and dance as viewing angle changes minutely
- Metal grain and texture become visible as light angle evolves
- Extremely shallow depth of field — focus plane moves gently

SPEED: Glacially slow. Each second reveals a new micro-detail.
FEEL: Like looking through a jeweler's loupe in slow motion.`,
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
