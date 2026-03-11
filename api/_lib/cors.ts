import type { Request, Response } from 'express';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

function getOrigin(req?: Request): string {
  if (!req) return '*';
  const origin = req.headers.origin as string | undefined;
  if (!origin) return '*';
  if (ALLOWED_ORIGINS.length === 0) return '*'; // dev fallback
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function handleCors(res: Response, req?: Request): Response | null {
  const origin = getOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', corsHeaders['Access-Control-Allow-Headers']);
  res.setHeader('Access-Control-Allow-Methods', corsHeaders['Access-Control-Allow-Methods']);
  if (origin !== '*') {
    res.setHeader('Vary', 'Origin');
  }
  return null;
}

export function sendCorsResponse(res: Response, status: number, body: any, req?: Request): void {
  handleCors(res, req);
  res.status(status).json(body);
}
