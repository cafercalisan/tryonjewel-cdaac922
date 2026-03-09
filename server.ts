import express from 'express';

import generateJewelry from './api/generate-jewelry.js';
import generateVideo from './api/generate-video.js';
import generateDesign from './api/generate-design.js';
import generateModel from './api/generate-model.js';
import adminSetCredits from './api/admin-set-credits.js';
import checkVideoStatus from './api/check-video-status.js';

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(express.json({ limit: '50mb' }));

// API routes
app.all('/api/generate-jewelry', generateJewelry);
app.all('/api/generate-video', generateVideo);
app.all('/api/generate-design', generateDesign);
app.all('/api/generate-model', generateModel);
app.all('/api/admin-set-credits', adminSetCredits);
app.all('/api/check-video-status', checkVideoStatus);

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
