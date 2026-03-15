import type { Request, Response } from 'express';
import { queryOne } from './_lib/db.js';
import { verifyPassword, generateTokens } from './_lib/auth-local.js';
import { handleCors, sendCorsResponse } from './_lib/cors.js';

export default async function handler(req: Request, res: Response) {
  handleCors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendCorsResponse(res, 400, { error: 'Email and password are required' });
    }

    const user = await queryOne<{ id: string; password_hash: string }>(
      'SELECT id, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!user) {
      return sendCorsResponse(res, 401, { error: 'Invalid credentials' });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return sendCorsResponse(res, 401, { error: 'Invalid credentials' });
    }

    const tokens = await generateTokens(user.id);

    return sendCorsResponse(res, 200, {
      success: true,
      user: { id: user.id, email: email.toLowerCase() },
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
  } catch (err) {
    console.error('Login error:', err);
    return sendCorsResponse(res, 500, { error: 'Internal error' });
  }
}
