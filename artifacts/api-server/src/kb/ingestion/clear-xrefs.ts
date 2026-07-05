/**
 * One-time utility: clear all kb_cross_references rows so the unique
 * index can be created cleanly, then the ingestion runner re-populates them.
 */
import { pool } from "@workspace/db";

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query("DELETE FROM kb_cross_references");
    console.log(`[clear-xrefs] Deleted ${res.rowCount} cross-reference rows.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
