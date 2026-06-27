import dotenv from 'dotenv';

dotenv.config();

const numberFromEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const listFromEnv = (value, fallback) =>
  (value || fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: numberFromEnv('PORT', 4000),
  clientOrigin,
  clientOrigins: listFromEnv(clientOrigin, 'http://localhost:5173'),
  allowLanOrigins: process.env.ALLOW_LAN_ORIGINS !== 'false',
  databaseUrl: process.env.DATABASE_URL || 'postgres://careapp:careapp@localhost:5432/careapp',
  jwtSecret: process.env.JWT_SECRET || 'development-only-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  maxUploadMb: numberFromEnv('MAX_UPLOAD_MB', 25),
  defaultAdminUsername: process.env.DEFAULT_ADMIN_USERNAME || 'superadmin',
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMeNow!2026',
  defaultAdminName: process.env.DEFAULT_ADMIN_NAME || 'Super Administrator'
};
