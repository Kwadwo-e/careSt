import { query } from '../config/db.js';

export const requestDevice = (req) => req.get('user-agent') || 'Unknown device';

export const requestIp = (req) => {
  const forwarded = req.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || null;
};

export const recordAudit = async ({
  client,
  req,
  userType,
  userId,
  name,
  identifier,
  action,
  outcome = 'success',
  timeIn,
  timeOut,
  metadata = {}
}) => {
  const runner = client || { query };
  await runner.query(
    `INSERT INTO audit_logs
      (user_type, user_id, name, identifier, action, outcome, time_in, time_out, device_used, ip_address, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      userType,
      userId || null,
      name || null,
      identifier || null,
      action,
      outcome,
      timeIn || null,
      timeOut || null,
      req ? requestDevice(req) : null,
      req ? requestIp(req) : null,
      metadata
    ]
  );
};
