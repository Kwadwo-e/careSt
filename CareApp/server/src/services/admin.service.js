import { query } from '../config/db.js';
import { env } from '../config/env.js';
import { hashPassword } from '../utils/password.js';

export const ensureDefaultAdmin = async () => {
  const existing = await query('SELECT id FROM admins LIMIT 1');
  if (existing.rowCount > 0) return;

  const passwordHash = await hashPassword(env.defaultAdminPassword);
  await query(
    `INSERT INTO admins (username, full_name, password_hash)
     VALUES ($1, $2, $3)`,
    [env.defaultAdminUsername, env.defaultAdminName, passwordHash]
  );

  console.log(`Created default super administrator "${env.defaultAdminUsername}".`);
};
