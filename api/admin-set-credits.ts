import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServiceClient } from './_lib/supabase.js';
import { authenticateUser } from './_lib/auth.js';
import { corsHeaders, sendCorsResponse } from './_lib/cors.js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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

    const supabase = getServiceClient();

    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: callerUserId,
      _role: 'admin',
    });

    if (roleError) {
      return sendCorsResponse(res, 500, { error: 'Role check failed' });
    }

    if (isAdmin !== true) {
      return sendCorsResponse(res, 403, { error: 'Forbidden' });
    }

    const { data: result, error: updateError } = await supabase.rpc('admin_set_credits', {
      _user_id: userId,
      _credits: credits,
    });

    if (updateError) {
      return sendCorsResponse(res, 500, { error: 'Update failed' });
    }

    console.log(`Admin ${callerUserId} set credits for user ${userId} to ${credits}`);

    return sendCorsResponse(res, 200, { success: true, ...result });

  } catch (e) {
    console.error('admin-set-credits error:', e);
    return sendCorsResponse(res, 500, { error: 'Internal error' });
  }
}
