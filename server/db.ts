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

// Supabase requires SSL in most environments (including Vercel).
// Using sslmode=require in the URL usually works, but explicitly enabling SSL
// avoids resolution differences between runtimes.
const shouldUseSsl =
  process.env.NODE_ENV === "production" &&
  (connectionString.includes("sslmode=require") ||
    /\.supabase\.(co|com)(?::\d+)?\//.test(connectionString));

export const pool = new Pool({
  connectionString,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});
export const db = drizzle(pool, { schema });
