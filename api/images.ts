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
