import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
// Phase 3 — Chain of Custody service functions
export {
  recordCustodyEvent,
  verifyCustodyChain,
  getDecisionCustody,
  type CustodyEventInput,
  type CustodyVerificationResult,
  type ChainOfCustodyRecord,
} from "./custody-service";
