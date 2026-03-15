import type { Request, Response } from 'express';
import { getSignedUrl } from './_lib/storage.js';
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

    const { bucket, path, expiresIn } = req.body;

    if (!bucket || !path) {
      return sendCorsResponse(res, 400, { error: 'bucket and path are required' });
    }

    const { data, error } = await getSignedUrl(bucket, path, expiresIn || 7 * 24 * 60 * 60);

    if (error || !data) {
      return sendCorsResponse(res, 500, { error: error?.message || 'Failed to generate signed URL' });
    }

    return sendCorsResponse(res, 200, { signedUrl: data.signedUrl });
  } catch (err) {
    console.error('Signed URL error:', err);
    return sendCorsResponse(res, 500, { error: 'Internal error' });
  }
}
