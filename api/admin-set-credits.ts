import type { Request, Response } from 'express';
import { queryOne } from './_lib/db.js';
import { authenticateUser } from './_lib/auth.js';
import { handleCors, sendCorsResponse } from './_lib/cors.js';

// Simple in-memory rate limiter (IP + userId, 10 req/min)
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

export default async function handler(req: Request, res: Response) {
  handleCors(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Rate limit by IP
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(`admin-ip:${clientIp}`)) {
    return sendCorsResponse(res, 429, { error: 'Too many requests. Try again later.' });
  }

  try {
    const authResult = await authenticateUser(req);
    if ('error' in authResult) {
      return sendCorsResponse(res, authResult.status, { error: authResult.error });
    }

    const callerUserId = authResult.userId;

    const body = req.body || {};
    const { userId, credits: rawCredits } = body;
    const credits = Number(rawCredits);

    if (!userId || typeof userId !== 'string') {
      return sendCorsResponse(res, 400, { error: 'userId is required' });
    }

    if (!Number.isFinite(credits) || credits < 0 || credits > 1_000_000) {
      return sendCorsResponse(res, 400, { error: 'Invalid credits' });
    }

    const roleRow = await queryOne<{ result: boolean }>('SELECT has_role($1, $2) as result', [callerUserId, 'admin']);

    if (!roleRow) {
      return sendCorsResponse(res, 500, { error: 'Role check failed' });
    }

    if (roleRow.result !== true) {
      return sendCorsResponse(res, 403, { error: 'Forbidden' });
    }

    const updateRow = await queryOne<{ result: any }>('SELECT admin_set_credits($1, $2) as result', [userId, credits]);

    if (!updateRow) {
      return sendCorsResponse(res, 500, { error: 'Update failed' });
    }

    console.log(`Admin ${callerUserId} set credits for user ${userId} to ${credits}`);

    return sendCorsResponse(res, 200, { success: true, ...updateRow.result });

  } catch (e) {
    console.error('admin-set-credits error:', e);
    return sendCorsResponse(res, 500, { error: 'Internal error' });
  }
}
