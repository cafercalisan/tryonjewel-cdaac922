import type { Request, Response } from 'express';
import { query } from './_lib/db.js';
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

    const { rows } = await query(
      'SELECT * FROM scenes ORDER BY sort_order ASC, created_at ASC'
    );

    return sendCorsResponse(res, 200, { data: rows });
  } catch (err) {
    console.error('Scenes error:', err);
    return sendCorsResponse(res, 500, { error: 'Internal error' });
  }
}
