import type { Request, Response } from 'express';
import { queryOne } from './_lib/db.js';
import { verifyRefreshToken, generateTokens } from './_lib/auth-local.js';
import { handleCors, sendCorsResponse } from './_lib/cors.js';

export default async function handler(req: Request, res: Response) {
  handleCors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return sendCorsResponse(res, 400, { error: 'Refresh token is required' });
    }

    const result = await verifyRefreshToken(refresh_token);
    if (!result) {
      return sendCorsResponse(res, 401, { error: 'Invalid refresh token' });
    }

    const user = await queryOne<{ id: string; email: string }>(
      'SELECT id, email FROM users WHERE id = $1',
      [result.userId]
    );

    if (!user) {
      return sendCorsResponse(res, 401, { error: 'User not found' });
    }

    const tokens = await generateTokens(user.id);

    return sendCorsResponse(res, 200, {
      success: true,
      user: { id: user.id, email: user.email },
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
  } catch (err) {
    console.error('Token refresh error:', err);
    return sendCorsResponse(res, 500, { error: 'Internal error' });
  }
}
