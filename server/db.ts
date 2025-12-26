import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

const { Pool } = pg;

// Temporarily disable database connection for testing
console.warn("DATABASE_URL temporarily disabled for testing. Database operations will not work.");
const pool = new Pool({ 
  connectionString: "postgresql://localhost:5432/temp",
  max: 0 // Prevent actual connections
});
export const db = drizzle(pool, { schema });
export { pool };
