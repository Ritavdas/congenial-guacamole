import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// DATABASE_URL uses port 6543 (Supabase pooler, PgBouncer transaction mode) — required for
// serverless. Must keep `prepare: false`. To enable prepared-statement caching for a real
// latency win, upgrade to Supabase's Dedicated Pooler (Supavisor session mode) and flip
// `prepare: true`. Do NOT use port 5432 (direct) from Vercel — connections won't reuse.
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, {
  prepare: false,
  // With prepare:false, postgres-js can't always infer parameter OIDs and may
  // try to write JS Date objects as raw bytes ("Received an instance of Date"
  // TypeError). Force-serialize Date params to ISO strings (Postgres parses
  // these into timestamptz/timestamp/date columns transparently).
  types: {
    date: {
      to: 1184, // timestamptz OID
      from: [1082, 1083, 1114, 1184],
      serialize: (value: Date | string) =>
        value instanceof Date ? value.toISOString() : value,
      parse: (value: string) => new Date(value),
    },
  },
});

export const db = drizzle(client, { schema });
