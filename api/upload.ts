import type { Request, Response } from 'express';
import { uploadFile } from './_lib/storage.js';
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

    const { bucket, path, contentType, data } = req.body;

    if (!bucket || !path || !data) {
      return sendCorsResponse(res, 400, { error: 'bucket, path, and data are required' });
    }

    // Ensure user can only upload to their own paths
    if (!path.startsWith(`${userId}/`)) {
      return sendCorsResponse(res, 403, { error: 'Cannot upload to this path' });
    }

    const buffer = Buffer.from(data, 'base64');
    const { error } = await uploadFile(bucket, path, buffer, contentType || 'application/octet-stream');

    if (error) {
      return sendCorsResponse(res, 500, { error: error.message });
    }

    return sendCorsResponse(res, 200, { success: true, path });
  } catch (err) {
    console.error('Upload error:', err);
    return sendCorsResponse(res, 500, { error: 'Internal error' });
  }
}
