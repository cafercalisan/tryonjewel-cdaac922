import type { Request, Response } from 'express';
import { queryOne, query } from './_lib/db.js';
import { authenticateUser } from './_lib/auth.js';
import { handleCors, sendCorsResponse } from './_lib/cors.js';

export default async function handler(req: Request, res: Response) {
  handleCors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Disable caching — polling must always get fresh data, never a 304
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.removeHeader('ETag');
  res.removeHeader('Last-Modified');

  try {
    const authResult = await authenticateUser(req);
    if ('error' in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }

    // POST /cancel — cancel an active job so user can start a new generation
    if (req.method === 'POST' && (req.params?.id === 'cancel' || req.path?.endsWith('/cancel'))) {
      const jobId = req.body?.jobId;
      if (jobId) {
        // Cancel specific job
        await query(
          `UPDATE processing_jobs SET status = 'cancelled', error_message = 'Kullanıcı tarafından iptal edildi'
           WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'generating')`,
          [jobId, authResult.userId]
        );
      } else {
        // Cancel all active jobs for this user
        await query(
          `UPDATE processing_jobs SET status = 'cancelled', error_message = 'Kullanıcı tarafından iptal edildi'
           WHERE user_id = $1 AND status IN ('pending', 'generating')`,
          [authResult.userId]
        );
      }
      return sendCorsResponse(res, 200, { success: true });
    }

    // /active — return only genuinely in-progress jobs (not completed ones)
    if (req.params?.id === 'active' || req.path?.endsWith('/active')) {
      const job = await queryOne(
        `SELECT * FROM processing_jobs
         WHERE user_id = $1
         AND status IN ('pending', 'generating')
         ORDER BY created_at DESC LIMIT 1`,
        [authResult.userId]
      );
      return sendCorsResponse(res, 200, { data: job || null });
    }

    const jobId = req.params?.id || req.query?.id || req.body?.id;
    if (!jobId) {
      return sendCorsResponse(res, 400, { error: 'Job ID is required' });
    }

    const job = await queryOne(
      'SELECT * FROM processing_jobs WHERE id = $1 AND user_id = $2',
      [jobId, authResult.userId]
    );

    if (!job) {
      return sendCorsResponse(res, 404, { error: 'Job not found' });
    }

    return sendCorsResponse(res, 200, { data: job });
  } catch (err) {
    console.error('Processing jobs error:', err);
    return sendCorsResponse(res, 500, { error: 'Internal error' });
  }
}
