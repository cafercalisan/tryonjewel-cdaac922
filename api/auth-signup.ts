import type { Request, Response } from 'express';
import { query, queryOne } from './_lib/db.js';
import { hashPassword, generateTokens } from './_lib/auth-local.js';
import { handleCors, sendCorsResponse } from './_lib/cors.js';

export default async function handler(req: Request, res: Response) {
  handleCors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { email, password, metadata } = req.body;

    if (!email || !password) {
      return sendCorsResponse(res, 400, { error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return sendCorsResponse(res, 400, { error: 'Password must be at least 6 characters' });
    }

    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing) {
      return sendCorsResponse(res, 409, { error: 'User already exists' });
    }

    const passwordHash = await hashPassword(password);
    const user = await queryOne<{ id: string }>(
      'INSERT INTO users (email, password_hash, metadata) VALUES ($1, $2, $3) RETURNING id',
      [email.toLowerCase(), passwordHash, JSON.stringify(metadata || {})]
    );

    if (!user) throw new Error('Failed to create user');

    // Create profile
    await query(
      `INSERT INTO profiles (id, email, first_name, last_name, phone, company, credits)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user.id,
        email.toLowerCase(),
        metadata?.first_name || '',
        metadata?.last_name || '',
        metadata?.phone || null,
        metadata?.company || null,
        100, // default credits
      ]
    );

    const tokens = await generateTokens(user.id);

    return sendCorsResponse(res, 200, {
      success: true,
      user: { id: user.id, email: email.toLowerCase() },
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
  } catch (err) {
    console.error('Signup error:', err);
    return sendCorsResponse(res, 500, { error: 'Internal error' });
  }
}
