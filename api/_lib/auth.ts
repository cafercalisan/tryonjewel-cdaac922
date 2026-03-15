import type { Request } from 'express';
import { verifyAccessToken } from './auth-local.js';

export async function authenticateUser(req: Request): Promise<{ userId: string } | { error: string; status: number }> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized', status: 401 };
  }

  const token = authHeader.slice(7);
  const result = await verifyAccessToken(token);

  if (!result) {
    return { error: 'Unauthorized', status: 401 };
  }

  return { userId: result.userId };
}
