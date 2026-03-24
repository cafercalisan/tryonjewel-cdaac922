import express from 'express';

import generateJewelry from './api/generate-jewelry.js';
import generateJewelryV2 from './api/generate-jewelry-v2.js';
import generateVideo from './api/generate-video.js';
import generateDesign from './api/generate-design.js';
import generateModel from './api/generate-model.js';
import adminSetCredits from './api/admin-set-credits.js';
import checkVideoStatus from './api/check-video-status.js';
import analyzeBrand from './api/analyze-brand.js';

// Auth endpoints
import authSignup from './api/auth-signup.js';
import authLogin from './api/auth-login.js';
import authRefresh from './api/auth-refresh.js';
import authMe from './api/auth-me.js';

// Data endpoints
import scenes from './api/scenes.js';
import images from './api/images.js';
import processingJobs from './api/processing-jobs.js';
import profile from './api/profile.js';
import videos from './api/videos.js';
import userModels from './api/user-models.js';
import brandProfiles from './api/brand-profiles.js';
import adminData from './api/admin-data.js';

// Storage endpoints
import upload from './api/upload.js';
import signedUrl from './api/signed-url.js';

// n8n integration
import n8nTrigger from './api/n8n-trigger.js';

// ── Env validation ──
const REQUIRED_ENV = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GOOGLE_API_KEY',
];

const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing required env variables: ${missing.join(', ')}`);
  console.error('Server will start but some API calls will fail.');
}

const OPTIONAL_ENV = ['GOOGLE_ANALYSIS_API_KEY', 'MINIO_ENDPOINT', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'JWT_REFRESH_SECRET'];
const missingOptional = OPTIONAL_ENV.filter(k => !process.env[k]);
if (missingOptional.length > 0) {
  console.warn(`Missing optional env variables: ${missingOptional.join(', ')}`);
}

// ── Express app ──
const app = express();
const PORT = process.env.API_PORT || 3001;

// ── CORS middleware (before all routes) ──
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(express.json({ limit: '50mb' }));

// ── Request logging ──
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ── Health check ──
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      JWT_SECRET: !!process.env.JWT_SECRET,
      GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
      MINIO_ENDPOINT: !!process.env.MINIO_ENDPOINT,
    },
  });
});

// ── Auth routes ──
app.all('/api/auth/signup', authSignup);
app.all('/api/auth/login', authLogin);
app.all('/api/auth/refresh', authRefresh);
app.all('/api/auth/me', authMe);

// ── Generation routes ──
app.all('/api/generate-jewelry', generateJewelry);
app.all('/api/generate-jewelry-v2', generateJewelryV2);
app.all('/api/generate-video', generateVideo);
app.all('/api/generate-design', generateDesign);
app.all('/api/generate-model', generateModel);
app.all('/api/check-video-status', checkVideoStatus);
app.all('/api/analyze-brand', analyzeBrand);

// ── Admin routes ──
app.all('/api/admin-set-credits', adminSetCredits);
app.all('/api/admin-data', adminData);

// ── Data routes ──
app.all('/api/scenes', scenes);
app.all('/api/images', images);
app.get('/api/processing-jobs/active', processingJobs);
app.post('/api/processing-jobs/cancel', processingJobs);
app.get('/api/processing-jobs/:id', processingJobs);
app.all('/api/processing-jobs', processingJobs);
app.all('/api/profile', profile);
app.all('/api/videos', videos);
app.all('/api/user-models', userModels);
app.all('/api/brand-profiles', brandProfiles);

// ── Storage routes ──
app.all('/api/upload', upload);
app.all('/api/signed-url', signedUrl);

// ── n8n internal routes ──
app.post('/api/n8n/trigger', n8nTrigger);

// ── MinIO storage proxy — proxies signed URLs so browser can access them ──
app.get('/storage/{*path}', async (req, res) => {
  try {
    const minioEndpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
    // Forward the full path including query string
    const targetPath = '/' + (req.params.path || req.params[0] || '');
    const queryString = req.originalUrl.split('?')[1] || '';
    const targetUrl = `${minioEndpoint}${targetPath}${queryString ? '?' + queryString : ''}`;

    // Extract MinIO host from endpoint for the Host header.
    // S3 signed URLs include host in the signature — must match exactly.
    const minioUrl = new URL(minioEndpoint);
    const minioHost = minioUrl.host;

    const upstream = await fetch(targetUrl, {
      headers: { 'Host': minioHost },
    });
    if (!upstream.ok) {
      return res.status(upstream.status).end();
    }

    // Forward content-type and cache headers
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    const cl = upstream.headers.get('content-length');
    if (cl) res.setHeader('Content-Length', cl);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // Stream the response
    const arrayBuffer = await upstream.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('Storage proxy error:', err?.message);
    res.status(502).json({ error: 'Storage proxy error' });
  }
});

// ── Global error handler ──
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled Express error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Process-level error handlers ──
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  setTimeout(() => process.exit(1), 1000);
});

// ── Startup API key validation ──
async function validateGeminiKey() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_API_KEY not set — Gemini calls will fail');
    return;
  }
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(url);
    if (res.ok) {
      console.log('Gemini API key validated successfully');
    } else {
      const text = await res.text();
      console.error(`Gemini API key validation failed (${res.status}): ${text.substring(0, 200)}`);
    }
  } catch (err: any) {
    console.error('Gemini API key validation error:', err?.message || err);
  }
}

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  validateGeminiKey();
});
