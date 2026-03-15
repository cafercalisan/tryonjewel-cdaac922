import type { Request, Response } from 'express';
import { query, queryOne } from './_lib/db.js';
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
        'SELECT * FROM videos WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return sendCorsResponse(res, 200, { data: rows });
    }

    if (req.method === 'DELETE') {
      const videoId = req.body?.id || req.query?.id;
      if (!videoId) {
        return sendCorsResponse(res, 400, { error: 'Video ID is required' });
      }

      const video = await queryOne(
        'SELECT id FROM videos WHERE id = $1 AND user_id = $2',
        [videoId, userId]
      );

      if (!video) {
        return sendCorsResponse(res, 404, { error: 'Video not found' });
      }

      await query('DELETE FROM videos WHERE id = $1', [videoId]);
      return sendCorsResponse(res, 200, { success: true });
    }

    return sendCorsResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('Videos error:', err);
    return sendCorsResponse(res, 500, { error: 'Internal error' });
  }
}
