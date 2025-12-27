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

// Some drivers/layers parse `sslmode=require` from the URL and enable TLS with
// certificate verification by default, which can fail on serverless platforms
// with `SELF_SIGNED_CERT_IN_CHAIN`. We strip `sslmode` and control TLS via the
// explicit `ssl` option below.
let sanitizedConnectionString = connectionString;
try {
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  sanitizedConnectionString = url.toString();
} catch {
  // If DATABASE_URL isn't a valid URL for Node's URL parser, leave it as-is.
}

// Supabase requires SSL in most environments (including Vercel).
// Using sslmode=require in the URL usually works, but explicitly enabling SSL
// avoids resolution differences between runtimes.
const shouldUseSsl = process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: sanitizedConnectionString,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});
export const db = drizzle(pool, { schema });
