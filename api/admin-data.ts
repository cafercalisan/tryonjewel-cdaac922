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

    // Check admin role
    const isAdmin = await queryOne<{ result: boolean }>(
      'SELECT has_role($1, $2) as result',
      [userId, 'admin']
    );
    if (!isAdmin?.result) {
      return sendCorsResponse(res, 403, { error: 'Forbidden' });
    }

    const { table } = req.body || req.query || {};

    if (table === 'profiles') {
      const { rows } = await query('SELECT * FROM profiles ORDER BY created_at DESC');
      return sendCorsResponse(res, 200, { data: rows });
    }

    if (table === 'images') {
      const { rows } = await query('SELECT * FROM images ORDER BY created_at DESC LIMIT 100');
      return sendCorsResponse(res, 200, { data: rows });
    }

    if (table === 'videos') {
      const { rows } = await query('SELECT * FROM videos ORDER BY created_at DESC LIMIT 100');
      return sendCorsResponse(res, 200, { data: rows });
    }

    if (table === 'user_roles') {
      const { rows } = await query('SELECT * FROM user_roles ORDER BY created_at DESC');
      return sendCorsResponse(res, 200, { data: rows });
    }

    if (table === 'error_logs') {
      const { rows } = await query(
        'SELECT id, user_id, job_id, endpoint, model, attempt, status_code, is_overload, error_message, context, created_at FROM error_logs ORDER BY created_at DESC LIMIT 200',
      );
      return sendCorsResponse(res, 200, { data: rows });
    }

    return sendCorsResponse(res, 400, { error: 'Invalid table parameter' });
  } catch (err) {
    console.error('Admin data error:', err);
    return sendCorsResponse(res, 500, { error: 'Internal error' });
  }
}
