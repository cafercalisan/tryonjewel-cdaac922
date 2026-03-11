import type { Request, Response } from 'express';
import { getServiceClient } from './_lib/supabase.js';
import { handleCors, sendCorsResponse } from './_lib/cors.js';
import { authenticateUser } from './_lib/auth.js';
import { GoogleGenAI } from '@google/genai';

const ANIMATION_CORE = `IMAGE-TO-VIDEO ANIMATION — Animate the provided image.

RULES:
- The provided image is your first frame — preserve it exactly
- DO NOT create new products, objects, scenes, or compositions
- DO NOT add sparkle effects, lens flares, glowing halos, or artificial light bursts
- DO NOT add particle effects, dust, or atmospheric fog that isn't in the original
- Product shape, metal color, stone count, proportions — ALL UNCHANGED
- Add ONLY subtle, physically realistic motion to what already exists

REALISM:
- Light behaves like real physics — soft, gradual, no sudden flashes
- Metal reflects like real metal — smooth, continuous highlights, no digital shimmer
- Stones refract naturally — no exaggerated fire, no CGI sparkle overlay
- Everything must look like it was filmed with a real cinema camera on a tripod

FORBIDDEN:
- NO sparkle/glitter particle effects
- NO lens flare or light burst overlays
- NO artificial glow or bloom on metal or stones
- NO celebrity references or real person likeness
- NO text, watermarks, logos`;

const MULTI_FRAME_PROMPT = `${ANIMATION_CORE}

TRANSITION: Smooth cinematic transition from the first frame to the last frame.
The camera performs a fluid, continuous motion connecting both compositions.
Every intermediate frame must be physically plausible — no morphing, no dissolves, no jump cuts.
The jewelry product must remain consistent and recognizable throughout the entire transition.
Maintain continuous lighting and color temperature across all frames.
The motion should feel like a single continuous camera take — natural, elegant, unhurried.`;

const JEWELRY_VIDEO_PROMPTS: Record<string, string> = {
  default: `${ANIMATION_CORE}

MOTION: Very slow camera push-in toward the jewelry. The camera advances barely a centimeter over 6 seconds. Tripod-mounted, zero shake. As the camera gets closer, finer surface details become visible — metal grain, setting construction.

LIGHTING: The existing light in the image stays exactly as-is. As the camera angle shifts minutely, reflections on polished metal surfaces drift slowly and naturally — the way they would in real life when you lean slightly closer to look at a piece.

ATMOSPHERE: Still, quiet, contemplative. Like examining a piece in a museum vitrine. No drama, no effects — just the honest beauty of real materials under real light.

TECHNICAL: 24fps, locked tripod feel, natural color grading matching the source image.`,

  model: `${ANIMATION_CORE}

MOTION: The model breathes — a gentle chest rise, an almost imperceptible weight shift. Nothing more. The jewelry moves naturally with the body: a necklace sways a millimeter, a ring shifts with finger micro-movement. Camera holds perfectly still.

REALISM: Skin looks real — visible pores, natural sheen, no beauty filter. Hair doesn't move unless there's a reason. The model is nearly still, like a living photograph. No exaggerated gestures, no dramatic turns.

ATMOSPHERE: The quiet moment between shots in a real photo session. Natural, unstaged, authentic. The jewelry is prominent because the model is still, not because of effects.

TECHNICAL: 24fps, locked camera, natural skin tones, no color manipulation beyond the source image.`,

  product: `${ANIMATION_CORE}

MOTION: The product sits on its surface and does not move. The camera performs an extremely slow, barely perceptible lateral drift — shifting perspective by only a few degrees over the entire clip. This reveals how light falls differently across the metal and stone surfaces.

LIGHTING: No changes to lighting. The existing light in the image produces natural reflections that shift subtly as the viewing angle changes. Polished metal shows smooth, continuous highlight movement. Matte surfaces stay still. Stones show natural internal refraction — no added sparkle.

ATMOSPHERE: Clean, professional, catalog-quality. Like a high-end product video for an auction house. Precision and restraint.

TECHNICAL: 24fps, locked smooth dolly movement, deep focus, true-to-life colors.`,

  closeup: `${ANIMATION_CORE}

MOTION: Ultra-slow lateral pan across the jewelry surface at macro scale. The camera drifts horizontally, revealing different areas of the piece in sequence — a stone, a prong, a section of metalwork. Movement is glacially slow and perfectly smooth.

LIGHTING: As the macro camera position shifts, the angle of incidence changes on reflective surfaces. This creates natural, physics-based highlight movement on polished metal. No added effects — just real optics.

ATMOSPHERE: Intimate, reverent, documentary. Like a craftsman examining their own work through a loupe. The beauty comes from the real craftsmanship, not from effects.

TECHNICAL: 24fps, macro depth of field, focus plane may shift gently, natural color.`,
};

export default async function handler(req: Request, res: Response) {
  handleCors(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const GOOGLE_API_KEY = process.env.GOOGLE_VEO_API_KEY || process.env.GOOGLE_API_KEY;
    if (!GOOGLE_API_KEY) throw new Error('GOOGLE_VEO_API_KEY or GOOGLE_API_KEY is not configured');

    const supabase = getServiceClient();

    const authResult = await authenticateUser(req);
    if ('error' in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }
    const { userId } = authResult;

    const { imageUrl, endImageUrl, videoId, promptType = 'default', videoFormat = '9:16' } = req.body;
    if (!imageUrl) return sendCorsResponse(res, 400, { error: 'Image URL is required' });
    if (!videoId) return sendCorsResponse(res, 400, { error: 'Video ID is required' });

    const isMultiFrame = !!endImageUrl;

    console.log('Starting video generation for user:', userId);

    // Credit check
    const VIDEO_CREDIT_COST = 200;
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
    const isAdminUser = isAdmin === true;

    if (!isAdminUser) {
      const { data: deductResult, error: deductError } = await supabase
        .rpc('deduct_credits', { _user_id: userId, _amount: VIDEO_CREDIT_COST });

      if (deductError) {
        await supabase.from('videos').update({ status: 'error', error_message: 'Kredi kontrolü sırasında hata oluştu' }).eq('id', videoId);
        return sendCorsResponse(res, 500, { error: 'Kredi kontrolü sırasında hata oluştu' });
      }

      if (!deductResult?.success) {
        await supabase.from('videos').update({ status: 'error', error_message: `Yetersiz kredi. ${VIDEO_CREDIT_COST} kredi gerekli.` }).eq('id', videoId);
        return sendCorsResponse(res, 402, { error: `Yetersiz kredi. ${VIDEO_CREDIT_COST} kredi gerekli, mevcut: ${deductResult?.current_credits ?? 0}.` });
      }
    }

    const selectedPrompt = isMultiFrame ? MULTI_FRAME_PROMPT : (JEWELRY_VIDEO_PROMPTS[promptType] || JEWELRY_VIDEO_PROMPTS.default);
    const fullPrompt = `${selectedPrompt}

GLOBAL LOCKS:
- 24fps, 6-8 seconds duration
- Zero camera shake — locked tripod
- Motion speed: barely perceptible, real-time slow
- Color grading: match the source image exactly, no stylization
- NO post-processing effects: no sparkle, no glow, no flare, no bloom, no particles
- The video should look like it was shot on a RED or ARRI cinema camera — clean, real, unprocessed`;

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

    await supabase.from('videos').update({ error_message: isMultiFrame ? 'Multi-frame video hazırlanıyor...' : 'Google Veo 3.1 API çağrılıyor...' }).eq('id', videoId);

    // Fetch end image for multi-frame mode
    let base64EndImage: string | undefined;
    let endMimeType: string | undefined;

    if (isMultiFrame && endImageUrl) {
      try {
        const endImageResponse = await fetch(endImageUrl);
        if (endImageResponse.ok) {
          const endImageBuffer = await endImageResponse.arrayBuffer();
          const endUint8Array = new Uint8Array(endImageBuffer);
          let endBinary = '';
          for (let i = 0; i < endUint8Array.length; i++) {
            endBinary += String.fromCharCode(endUint8Array[i]);
          }
          base64EndImage = btoa(endBinary);
          endMimeType = endImageResponse.headers.get('content-type') || 'image/png';
          console.log('End frame image loaded for multi-frame video');
        }
      } catch (err) {
        console.error('Failed to fetch end image:', err);
      }
    }

    const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });

    let veo31OperationName: string | undefined;
    let veo31ErrorText: string | undefined;

    try {
      const veoConfig: any = { aspectRatio: videoFormat === '16:9' ? '16:9' : '9:16' };

      if (base64EndImage && endMimeType) {
        veoConfig.lastFrame = { imageBytes: base64EndImage, mimeType: endMimeType };
        console.log('Using multi-frame mode with lastFrame');
      }

      const operation: any = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: fullPrompt,
        image: { imageBytes: base64Image, mimeType },
        config: veoConfig,
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
