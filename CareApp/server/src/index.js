import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import os from 'node:os';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { ensureDefaultAdmin } from './services/admin.service.js';
import { authRouter } from './routes/auth.routes.js';
import { studentRouter } from './routes/student.routes.js';
import { supervisorRouter } from './routes/supervisor.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { fileRouter } from './routes/file.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

const firstLanIp = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .find((details) => details && details.family === 'IPv4' && !details.internal)?.address;

const appUrlForQr = (origin) => {
  const fallback = origin || env.clientOrigin || 'http://localhost:5173';
  try {
    const url = new URL(fallback);
    if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) {
      const lanIp = firstLanIp();
      if (lanIp) url.hostname = lanIp;
    }
    return `${url.origin}/`;
  } catch {
    return fallback;
  }
};

const isPrivateLanHostname = (hostname) => {
  if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname) || hostname.endsWith('.local')) return true;
  if (/^10\./.test(hostname) || /^192\.168\./.test(hostname)) return true;
  return /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
};

const isAllowedCorsOrigin = (origin) => {
  if (!origin || env.nodeEnv === 'development' || env.clientOrigins.includes(origin)) return true;

  if (!env.allowLanOrigins) return false;

  try {
    const url = new URL(origin);
    return ['http:', 'https:'].includes(url.protocol) && isPrivateLanHostname(url.hostname);
  } catch {
    return false;
  }
};

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin(origin, callback) {
    if (isAllowedCorsOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('CORS origin is not allowed.'));
  },
  credentials: true
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'CareApp' });
});

app.get('/api/network-info', (req, res) => {
  res.json({ url: appUrlForQr(req.get('origin')) });
});

app.use('/api/auth', authRouter);
app.use('/api/student', studentRouter);
app.use('/api/supervisor', supervisorRouter);
app.use('/api/admin', adminRouter);
app.use('/api/files', fileRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const start = async () => {
  await pool.query('SELECT 1');
  await ensureDefaultAdmin();

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`CareApp API listening on http://0.0.0.0:${env.port}`);
  });
};

start().catch((error) => {
  console.error('CareApp API failed to start.');
  console.error(error);
  process.exit(1);
});
