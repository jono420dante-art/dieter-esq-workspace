import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import compression from 'compression';
import musicRouter from './routes/music.js';
import vocalsRouter from './routes/vocals.js';
import videoRouter from './routes/video.js';
import granularRouter from './routes/granular.js';
import directorRouter from './routes/director.js';
import seoRouter from './routes/seo.js';
import commerceRouter from './routes/commerce.js';
import portalsRouter from './routes/portals.js';
import dieterRouter from './routes/dieter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use(express.static(join(__dirname, '..', 'dist')));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

app.use('/api/music', musicRouter);
app.use('/api/vocals', vocalsRouter);
app.use('/api/video', videoRouter);
app.use('/api/granular', granularRouter);
app.use('/api/director', directorRouter);
app.use('/api/seo', seoRouter);
app.use('/api/commerce', commerceRouter);
app.use('/api/portals', portalsRouter);
app.use('/api/dieter', dieterRouter);

app.get('/{*splat}', (req, res) => {
  res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
});

app.use((err, req, res, _next) => {
  console.error('[API Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  const du = (process.env.DIETER_FASTAPI_URL || '').trim();
  console.log(`\n  ⚡ DIETER PRO API running on http://localhost:${PORT}`);
  console.log(`  📡 Health: http://localhost:${PORT}/api/health`);
  console.log(
    du
      ? `  🔗 Dieter FastAPI proxy: ${du} → /api/dieter/*\n`
      : '  ⚠️  DIETER_FASTAPI_URL not set — Video Suite “cover + song” proxy returns 503 until configured.\n',
  );
});
