import type { Request, Response } from 'express';
import { query, queryOne } from './_lib/db.js';
import { deleteFile } from './_lib/storage.js';
import { authenticateUser } from './_lib/auth.js';
import { handleCors, sendCorsResponse } from './_lib/cors.js';

export default async function handler(req: Request, res: Response) {
  handleCors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const authResult = await authenticateUser(req);
    if ('error' in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }
    const { userId } = authResult;

    if (req.method === 'GET') {
      const imageId = req.query?.id as string | undefined;
      if (imageId) {
        const image = await queryOne(
          `SELECT i.*, pj.result_urls as job_result_urls, pj.status as job_status
           FROM images i
           LEFT JOIN processing_jobs pj ON pj.image_record_id = i.id
           WHERE i.id = $1 AND i.user_id = $2`,
          [imageId, userId]
        );
        if (!image) {
          return sendCorsResponse(res, 404, { error: 'Image not found' });
        }
        // Fallback: if generated_image_urls is empty but job has result_urls
        if ((!image.generated_image_urls || image.generated_image_urls.length === 0) && image.job_result_urls) {
          try {
            const urls = typeof image.job_result_urls === 'string'
              ? JSON.parse(image.job_result_urls)
              : image.job_result_urls;
            if (Array.isArray(urls) && urls.length > 0) {
              image.generated_image_urls = urls;
              // Also fix the status if job is completed
              if (image.job_status === 'completed') {
                image.status = 'completed';
              }
            }
          } catch { /* ignore parse error */ }
        }
        // Fallback: if image status is still generating/pending but job is completed
        if (image.status !== 'completed' && image.job_status === 'completed') {
          image.status = 'completed';
        }
        return sendCorsResponse(res, 200, { data: image });
      }
      const { rows } = await query(
        'SELECT * FROM images WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return sendCorsResponse(res, 200, { data: rows });
    }

    if (req.method === 'DELETE') {
      const imageId = req.body?.id || req.query?.id;
      if (!imageId) {
        return sendCorsResponse(res, 400, { error: 'Image ID is required' });
      }

      const image = await queryOne<{ id: string; user_id: string; original_image_url: string }>(
        'SELECT id, user_id, original_image_url FROM images WHERE id = $1 AND user_id = $2',
        [imageId, userId]
      );

      if (!image) {
        return sendCorsResponse(res, 404, { error: 'Image not found' });
      }

      await query('DELETE FROM images WHERE id = $1', [imageId]);

      if (image.original_image_url) {
        await deleteFile('jewelry-images', image.original_image_url);
      }

      return sendCorsResponse(res, 200, { success: true });
    }

    return sendCorsResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('Images error:', err);
    return sendCorsResponse(res, 500, { error: 'Internal error' });
  }
}
