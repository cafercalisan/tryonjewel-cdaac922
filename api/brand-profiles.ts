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

    if (req.method === 'GET') {
      const { rows } = await query(
        'SELECT * FROM brand_profiles WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return sendCorsResponse(res, 200, { data: rows });
    }

    if (req.method === 'POST') {
      const body = req.body;
      const result = await queryOne(
        `INSERT INTO brand_profiles (user_id, brand_name, brand_style, brand_colors, brand_mood, logo_url, brand_dna_prompt, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [userId, body.brand_name, body.brand_style, body.brand_colors, body.brand_mood, body.logo_url, body.brand_dna_prompt, body.is_active ?? true]
      );
      return sendCorsResponse(res, 200, { data: result });
    }

    if (req.method === 'PUT') {
      const { id, ...updates } = req.body;
      if (!id) return sendCorsResponse(res, 400, { error: 'ID is required' });

      const setClauses: string[] = [];
      const values: any[] = [id, userId];
      let paramIndex = 3;

      for (const [key, value] of Object.entries(updates)) {
        if (['brand_name', 'brand_style', 'brand_colors', 'brand_mood', 'logo_url', 'brand_dna_prompt', 'is_active'].includes(key)) {
          setClauses.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      if (setClauses.length === 0) return sendCorsResponse(res, 400, { error: 'No valid fields to update' });

      setClauses.push(`updated_at = NOW()`);
      const result = await queryOne(
        `UPDATE brand_profiles SET ${setClauses.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
        values
      );
      return sendCorsResponse(res, 200, { data: result });
    }

    return sendCorsResponse(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('Brand profiles error:', err);
    return sendCorsResponse(res, 500, { error: 'Internal error' });
  }
}
