import type { Request, Response } from 'express';
import { getServiceClient } from './_lib/supabase.js';
import { handleCors, sendCorsResponse } from './_lib/cors.js';
import { authenticateUser } from './_lib/auth.js';

const VIDEO_CREDIT_COST = 200;

async function refundCredits(supabase: any, userId: string, amount: number): Promise<void> {
  console.log(`Attempting to refund ${amount} credits to user ${userId}`);
  const { error } = await supabase.rpc('refund_credits', { _user_id: userId, _amount: amount });
  if (error) console.error('Refund error:', error);
  else console.log('Credits refunded successfully');
}

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

    const { videoId } = req.body;
    if (!videoId) return sendCorsResponse(res, 400, { error: 'Video ID is required' });

    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .eq('user_id', userId)
      .single();

    if (videoError || !video) throw new Error('Video not found');

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
    const isAdminUser = isAdmin === true;

    if (video.status === 'completed' || video.status === 'error') {
      return sendCorsResponse(res, 200, { success: true, status: video.status, videoUrl: video.video_url, errorMessage: video.error_message });
    }

    if (!video.operation_id) {
      return sendCorsResponse(res, 200, { success: true, status: video.status, message: 'Video generation starting...' });
    }

    console.log(`Checking operation: ${video.operation_id}`);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${video.operation_id}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GOOGLE_API_KEY } }
    );

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 404) {
        if (!isAdminUser) await refundCredits(supabase, userId, VIDEO_CREDIT_COST);
        await supabase.from('videos').update({ status: 'error', error_message: 'Video üretimi başarısız. Krediniz iade edildi.' }).eq('id', videoId);
        return sendCorsResponse(res, 200, { success: true, status: 'error', errorMessage: 'Operation not found. Credits refunded.', refunded: !isAdminUser });
      }
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const operationData = await response.json();

    if (operationData.done === true) {
      // Check RAI filter
      const raiFilteredReasons = operationData?.response?.generateVideoResponse?.raiMediaFilteredReasons;
      const raiFilteredCount = operationData?.response?.generateVideoResponse?.raiMediaFilteredCount;

      if ((raiFilteredCount && raiFilteredCount > 0) || (raiFilteredReasons && raiFilteredReasons.length > 0)) {
        if (!isAdminUser) await refundCredits(supabase, userId, VIDEO_CREDIT_COST);
        const friendly = 'Video üretimi içerik filtresine takıldı. Krediniz iade edildi.';
        await supabase.from('videos').update({ status: 'error', error_message: friendly }).eq('id', videoId);
        return sendCorsResponse(res, 200, { success: true, status: 'error', errorMessage: friendly, refunded: !isAdminUser });
      }

      if (operationData.error) {
        if (!isAdminUser) await refundCredits(supabase, userId, VIDEO_CREDIT_COST);
        await supabase.from('videos').update({ status: 'error', error_message: (operationData.error.message || 'Video üretimi başarısız') + ' Krediniz iade edildi.' }).eq('id', videoId);
        return sendCorsResponse(res, 200, { success: true, status: 'error', errorMessage: operationData.error.message, refunded: !isAdminUser });
      }

      const videoUri = operationData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
                       operationData.response?.generatedVideos?.[0]?.video?.uri ||
                       operationData.response?.predictions?.[0]?.video?.uri ||
                       operationData.result?.generatedVideos?.[0]?.video?.uri ||
                       operationData.result?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
                       operationData.response?.video?.uri;

      if (videoUri) {
        try {
          const videoResponse = await fetch(`${videoUri}&key=${GOOGLE_API_KEY}`);
          if (!videoResponse.ok) {
            throw new Error(`Video download failed: ${videoResponse.status}`);
          }
          const videoBlob = await videoResponse.arrayBuffer();
          const storagePath = `videos/${videoId}.mp4`;

          const { error: uploadError } = await supabase.storage
            .from('jewelry-images')
            .upload(storagePath, videoBlob, { contentType: 'video/mp4', upsert: true });

          if (uploadError) {
            throw new Error(`Storage upload failed: ${uploadError.message}`);
          }

          const { data: signedUrlData } = await supabase.storage
            .from('jewelry-images')
            .createSignedUrl(storagePath, 7 * 24 * 60 * 60);

          const videoUrl = signedUrlData?.signedUrl;
          if (!videoUrl) throw new Error('Could not generate signed URL for video');

          await supabase.from('videos').update({ status: 'completed', video_url: videoUrl, error_message: null }).eq('id', videoId);
          return sendCorsResponse(res, 200, { success: true, status: 'completed', videoUrl });
        } catch (uploadErr) {
          console.error('Error uploading video:', uploadErr);
          if (!isAdminUser) await refundCredits(supabase, userId, VIDEO_CREDIT_COST);
          await supabase.from('videos').update({
            status: 'error',
            error_message: 'Video depolanamadı, krediniz iade edildi.',
          }).eq('id', videoId);
          return sendCorsResponse(res, 200, { success: true, status: 'error', errorMessage: 'Video upload failed. Credits refunded.', refunded: !isAdminUser });
        }
      } else {
        if (!isAdminUser) await refundCredits(supabase, userId, VIDEO_CREDIT_COST);
        await supabase.from('videos').update({ status: 'error', error_message: 'Video tamamlandı ancak URL alınamadı. Krediniz iade edildi.' }).eq('id', videoId);
        return sendCorsResponse(res, 200, { success: true, status: 'error', errorMessage: 'No video URL', refunded: !isAdminUser });
      }
    }

    // Still in progress
    const progress = operationData.metadata?.progress || 0;
    await supabase.from('videos').update({ status: 'processing', error_message: progress > 0 ? `İşleniyor... ${progress}%` : 'Video oluşturuluyor...' }).eq('id', videoId);

    return sendCorsResponse(res, 200, { success: true, status: 'processing', progress, message: progress > 0 ? `İşleniyor... ${progress}%` : 'Video oluşturuluyor...' });

  } catch (error) {
    console.error('Error in check-video-status:', error);
    return sendCorsResponse(res, 500, { success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
