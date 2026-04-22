import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// DATABASE_URL uses port 6543 (Supabase pooler, PgBouncer transaction mode) — required for
// serverless. Must keep `prepare: false`. To enable prepared-statement caching for a real
// latency win, upgrade to Supabase's Dedicated Pooler (Supavisor session mode) and flip
// `prepare: true`. Do NOT use port 5432 (direct) from Vercel — connections won't reuse.
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
