import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

dotenv.config();

const { Client } = pg;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(scriptDir, '../../../database/migrations');
const databaseUrl = process.env.DATABASE_URL || 'postgres://careapp:careapp@localhost:5432/careapp';

const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

if (!files.length) {
  console.log('No migration files found.');
  process.exit(0);
}

const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();
  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    console.log(`Running migration: ${file}`);
    await client.query(sql);
  }
  console.log('Database migrations complete.');
} finally {
  await client.end();
}
