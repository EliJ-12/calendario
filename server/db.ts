import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;

console.log('DATABASE_URL configured:', connectionString ? 'YES' : 'NO');

// Enhanced pool configuration for Vercel + Supabase
export const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 60_000,
  idleTimeoutMillis: 300_000,
  query_timeout: 30_000,
  statement_timeout: 30_000,
  max: 20,
  min: 2,
  // Additional options for Vercel
  application_name: 'calendario-app',
  // Retry configuration
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

export const db = drizzle(pool, { schema });

// Log connection status
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

pool.on('remove', () => {
  console.log('PostgreSQL client removed from pool');
});
