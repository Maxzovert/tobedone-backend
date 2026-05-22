import dns from "dns";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Prefer IPv4 — fixes intermittent ENOTFOUND on some Windows networks
dns.setDefaultResultOrder("ipv4first");

function buildConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is missing. Add it to backend/.env");
  }

  let connectionString = url.replace(/[&?]channel_binding=[^&]*/g, "");

  // Pooled hostnames (-pooler) often fail DNS on Windows (ENOTFOUND). Direct endpoint works.
  if (
    connectionString.includes("neon.tech") &&
    connectionString.includes("-pooler.") &&
    process.env.USE_NEON_POOLER !== "true"
  ) {
    connectionString = connectionString.replace("-pooler.", ".");
  }

  if (
    connectionString.includes("neon.tech") &&
    !connectionString.includes("uselibpqcompat")
  ) {
    connectionString += connectionString.includes("?")
      ? "&uselibpqcompat=true"
      : "?uselibpqcompat=true";
  }

  if (
    connectionString.includes("neon.tech") &&
    !connectionString.includes("sslmode=")
  ) {
    connectionString += connectionString.includes("?")
      ? "&sslmode=require"
      : "?sslmode=require";
  }

  return connectionString;
}

const connectionString = buildConnectionString();

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("neon.tech")
    ? { rejectUnauthorized: false }
    : undefined,
  connectionTimeoutMillis: 15_000,
  max: 10,
});

pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err.message);
});

export const db = drizzle(pool, { schema });
export { pool };

export async function checkDatabase(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
