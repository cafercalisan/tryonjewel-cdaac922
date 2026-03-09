import express from 'express';

import generateJewelry from './api/generate-jewelry.js';
import generateVideo from './api/generate-video.js';
import generateDesign from './api/generate-design.js';
import generateModel from './api/generate-model.js';
import adminSetCredits from './api/admin-set-credits.js';
import checkVideoStatus from './api/check-video-status.js';

// ── Env validation ──
const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_API_KEY',
];

const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`❌ Missing required env variables: ${missing.join(', ')}`);
  console.error('Server will start but API calls requiring these keys will fail.');
}

const OPTIONAL_ENV = ['GOOGLE_ANALYSIS_API_KEY'];
const missingOptional = OPTIONAL_ENV.filter(k => !process.env[k]);
if (missingOptional.length > 0) {
  console.warn(`⚠️  Missing optional env variables: ${missingOptional.join(', ')}`);
}

// ── Express app ──
const app = express();
const PORT = process.env.API_PORT || 3001;

// ── CORS middleware (before all routes) ──
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
    },
  });
});

// ── API routes ──
app.all('/api/generate-jewelry', generateJewelry);
app.all('/api/generate-video', generateVideo);
app.all('/api/generate-design', generateDesign);
app.all('/api/generate-model', generateModel);
app.all('/api/admin-set-credits', adminSetCredits);
app.all('/api/check-video-status', checkVideoStatus);

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
  // Give time for logs to flush, then exit (start.sh will restart)
  setTimeout(() => process.exit(1), 1000);
});

app.listen(PORT, () => {
  console.log(`✅ API server running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
});
