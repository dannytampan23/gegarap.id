import { spawn } from 'node:child_process';
import { config } from 'dotenv';

const envPath = process.argv[2] ?? '.vercel/.env.production.local';
const loaded = config({ path: envPath, override: true });

if (loaded.error) {
  console.error(`Unable to load Vercel environment file: ${envPath}`);
  process.exit(1);
}

if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  console.error('DIRECT_URL or DATABASE_URL is required for database migrations.');
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
  {
    env: process.env,
    stdio: 'inherit',
    shell: false,
  }
);

child.once('error', (error) => {
  console.error(`Unable to start Prisma migration: ${error.message}`);
  process.exit(1);
});

child.once('exit', (code, signal) => {
  if (signal) {
    console.error(`Prisma migration terminated by signal ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
