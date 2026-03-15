import type { Request, Response } from 'express';
import { queryOne } from './_lib/db.js';
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

    const user = await queryOne<{ id: string; email: string; metadata: any; created_at: string }>(
      'SELECT id, email, metadata, created_at FROM users WHERE id = $1',
      [authResult.userId]
    );

    if (!user) {
      return sendCorsResponse(res, 404, { error: 'User not found' });
    }

    return sendCorsResponse(res, 200, {
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.metadata || {},
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('Auth me error:', err);
    return sendCorsResponse(res, 500, { error: 'Internal error' });
  }
}
