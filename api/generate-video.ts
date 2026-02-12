import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient } from './_lib/supabase';
import { corsHeaders, sendCorsResponse } from './_lib/cors';
import { GoogleGenAI } from '@google/genai';

export const config = {
  maxDuration: 300,
};

const CORE_FRAMEWORK = `High-end editorial jewelry video.
Minimal, controlled motion.
Slow cinematic pacing, no exaggerated movement.
Natural light behavior, soft highlights, realistic reflections.
Camera movement is subtle and intentional.
Luxury fashion campaign aesthetic.
No fast cuts, no dramatic effects, no artificial glow.

COMPLIANCE (CRITICAL):
- No celebrity references
- No real person's name
- No real person's likeness
- Use generic, non-identifiable model only (if a model is visible)`;

const JEWELRY_VIDEO_PROMPTS: Record<string, string> = {
  default: `${CORE_FRAMEWORK}
CAMERA MOVEMENT: Slow Push-In. Almost imperceptible advance. Macro depth of field.
LIGHTING: Natural diffused light. No artificial flares. Soft shadows. Cinematic lens (50mm/85mm).
PRODUCT PRESERVATION: Metal color EXACT, proportions UNCHANGED, natural light only.
FORBIDDEN: NO dramatic, NO dynamic motion, NO fast camera, NO glowing effects.`,

  model: `${CORE_FRAMEWORK}
MODEL: Standing still, natural breathing, subtle weight shift. Jewelry moves naturally.
CAMERA: Slow horizontal drift. Smooth, continuous. Jewelry in sharp focus.
LIGHTING: Natural diffused. Cinematic lens (50mm/85mm). Shallow DOF.
PRODUCT: EXACT replication. Natural skin texture, pores visible. No beauty blur.
FORBIDDEN: NO dramatic, NO dynamic motion, NO fast camera, NO glowing effects.`,

  product: `${CORE_FRAMEWORK}
CAMERA: Micro Parallax. Subtle foreground/background shift. Jewelry perfectly stable.
LIGHTING: Natural diffused. Cinematic lens (50mm/85mm). Shallow DOF.
PRODUCT: 100% faithful. Metal EXACT. Proportions UNCHANGED. No enhancement.
FORBIDDEN: NO dramatic, NO dynamic motion, NO fast camera, NO glowing effects.`,

  closeup: `${CORE_FRAMEWORK}
HAND: Mostly still, very slow finger relaxation. Natural skin texture.
CAMERA: Slow Push-In. Almost imperceptible. Macro depth of field.
LIGHTING: Natural diffused. Cinematic 85mm macro. Shallow DOF.
PRODUCT: Metal color EXACT. Proportions UNCHANGED. Natural skin preserved.
FORBIDDEN: NO dramatic, NO dynamic motion, NO fast camera, NO glowing effects.`,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    if (!GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY is not configured');

    const supabase = getServiceClient();

    const authHeader = req.headers.authorization;
    if (!authHeader) throw new Error('Authorization required');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Invalid authentication');

    const { imageUrl, videoId, promptType = 'default' } = req.body;
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
        model: 'veo-3.1-generate-preview',
        prompt: fullPrompt,
        image: { imageBytes: base64Image, mimeType },
        config: { aspectRatio: '9:16' },
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
            parameters: { aspectRatio: '9:16', sampleCount: 1, durationSeconds: 5, personGeneration: 'allow_adult' },
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
