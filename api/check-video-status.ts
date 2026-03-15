import type { Request, Response } from 'express';
import { query, queryOne } from './_lib/db.js';
import { uploadFile, getSignedUrl } from './_lib/storage.js';
import { handleCors, sendCorsResponse } from './_lib/cors.js';
import { authenticateUser } from './_lib/auth.js';

const VIDEO_CREDIT_COST = 200;

async function refundCredits(userId: string, amount: number): Promise<void> {
  console.log(`Attempting to refund ${amount} credits to user ${userId}`);
  try {
    await queryOne('SELECT refund_credits($1, $2) as result', [userId, amount]);
    console.log('Credits refunded successfully');
  } catch (error) {
    console.error('Refund error:', error);
  }
}

export default async function handler(req: Request, res: Response) {
  handleCors(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const GOOGLE_API_KEY = process.env.GOOGLE_VEO_API_KEY || process.env.GOOGLE_API_KEY;
    if (!GOOGLE_API_KEY) throw new Error('GOOGLE_VEO_API_KEY or GOOGLE_API_KEY is not configured');

    const authResult = await authenticateUser(req);
    if ('error' in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }
    const { userId } = authResult;

    const { videoId } = req.body;
    if (!videoId) return sendCorsResponse(res, 400, { error: 'Video ID is required' });

    const video = await queryOne('SELECT * FROM videos WHERE id = $1 AND user_id = $2', [videoId, userId]);

    if (!video) throw new Error('Video not found');

    const adminRow = await queryOne<{ result: boolean }>('SELECT has_role($1, $2) as result', [userId, 'admin']);
    const isAdminUser = adminRow?.result === true;

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
        if (!isAdminUser) await refundCredits(userId, VIDEO_CREDIT_COST);
        await query('UPDATE videos SET status = $1, error_message = $2 WHERE id = $3', ['error', 'Video üretimi başarısız. Krediniz iade edildi.', videoId]);
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
        if (!isAdminUser) await refundCredits(userId, VIDEO_CREDIT_COST);
        const friendly = 'Video üretimi içerik filtresine takıldı. Krediniz iade edildi.';
        await query('UPDATE videos SET status = $1, error_message = $2 WHERE id = $3', ['error', friendly, videoId]);
        return sendCorsResponse(res, 200, { success: true, status: 'error', errorMessage: friendly, refunded: !isAdminUser });
      }

      if (operationData.error) {
        if (!isAdminUser) await refundCredits(userId, VIDEO_CREDIT_COST);
        await query('UPDATE videos SET status = $1, error_message = $2 WHERE id = $3', ['error', (operationData.error.message || 'Video üretimi başarısız') + ' Krediniz iade edildi.', videoId]);
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

          const { error: uploadError } = await uploadFile('jewelry-images', storagePath, Buffer.from(videoBlob), 'video/mp4', true);

          if (uploadError) {
            throw new Error(`Storage upload failed: ${uploadError.message}`);
          }

          const { data: signedUrlData } = await getSignedUrl('jewelry-images', storagePath, 7 * 24 * 60 * 60);

          const videoUrl = signedUrlData?.signedUrl;
          if (!videoUrl) throw new Error('Could not generate signed URL for video');

          await query('UPDATE videos SET status = $1, video_url = $2, error_message = $3 WHERE id = $4', ['completed', videoUrl, null, videoId]);
          return sendCorsResponse(res, 200, { success: true, status: 'completed', videoUrl });
        } catch (uploadErr) {
          console.error('Error uploading video:', uploadErr);
          if (!isAdminUser) await refundCredits(userId, VIDEO_CREDIT_COST);
          await query('UPDATE videos SET status = $1, error_message = $2 WHERE id = $3', ['error', 'Video depolanamadı, krediniz iade edildi.', videoId]);
          return sendCorsResponse(res, 200, { success: true, status: 'error', errorMessage: 'Video upload failed. Credits refunded.', refunded: !isAdminUser });
        }
      } else {
        if (!isAdminUser) await refundCredits(userId, VIDEO_CREDIT_COST);
        await query('UPDATE videos SET status = $1, error_message = $2 WHERE id = $3', ['error', 'Video tamamlandı ancak URL alınamadı. Krediniz iade edildi.', videoId]);
        return sendCorsResponse(res, 200, { success: true, status: 'error', errorMessage: 'No video URL', refunded: !isAdminUser });
      }
    }

    // Still in progress
    const progress = operationData.metadata?.progress || 0;
    await query('UPDATE videos SET status = $1, error_message = $2 WHERE id = $3', ['processing', progress > 0 ? `İşleniyor... ${progress}%` : 'Video oluşturuluyor...', videoId]);

    return sendCorsResponse(res, 200, { success: true, status: 'processing', progress, message: progress > 0 ? `İşleniyor... ${progress}%` : 'Video oluşturuluyor...' });

  } catch (error) {
    console.error('Error in check-video-status:', error);
    return sendCorsResponse(res, 500, { success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
