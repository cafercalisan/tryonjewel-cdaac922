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

    if (req.method === 'GET' || (req.method === 'POST' && !req.body?.action)) {
      const profile = await queryOne(
        'SELECT * FROM profiles WHERE id = $1',
        [userId]
      );

      if (!profile) {
        return sendCorsResponse(res, 404, { error: 'Profile not found' });
      }

      return sendCorsResponse(res, 200, { data: profile });
    }

    if (req.method === 'PUT' || req.body?.action === 'update') {
      const { first_name, last_name, phone, company } = req.body;
      const profile = await queryOne(
        `UPDATE profiles SET
          first_name = COALESCE($2, first_name),
          last_name = COALESCE($3, last_name),
          phone = COALESCE($4, phone),
          company = COALESCE($5, company),
          updated_at = NOW()
        WHERE id = $1 RETURNING *`,
        [userId, first_name, last_name, phone, company]
      );

      return sendCorsResponse(res, 200, { data: profile });
    }

    return sendCorsResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('Profile error:', err);
    return sendCorsResponse(res, 500, { error: 'Internal error' });
  }
}
