import type { Request } from 'express';
import { getAuthClient } from './supabase.js';

export async function authenticateUser(req: Request): Promise<{ userId: string } | { error: string; status: number }> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized', status: 401 };
  }

  const supabaseAuth = getAuthClient(authHeader);
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return { error: 'Unauthorized', status: 401 };
  }

  return { userId: user.id };
}
