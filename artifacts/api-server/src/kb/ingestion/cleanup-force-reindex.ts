/**
 * One-time cleanup: remove the duplicate kb_documents rows created by the
 * --force re-run (IDs 23–33 from the first ingestion attempt, superseded by
 * IDs 34–44 from the fixed run). Also clears all cross-references so the
 * amendment graph and case-law graphs can be rebuilt cleanly.
 *
 * Safe to run multiple times (uses DELETE with WHERE, not TRUNCATE).
 */
import { pool } from "@workspace/db";

async function main() {
  const client = await pool.connect();
  try {
    // 1. Clear ALL cross-references (amendment + case-law) — rebuild after cleanup
    const xrefRes = await client.query("DELETE FROM kb_cross_references");
    console.log(`[cleanup] Deleted ${xrefRes.rowCount} cross-reference rows`);

    // 2. Clear articles for orphaned docs 23–33
    const artRes = await client.query(
      "DELETE FROM kb_articles WHERE document_id BETWEEN 23 AND 33",
    );
    console.log(`[cleanup] Deleted ${artRes.rowCount} article rows for orphaned docs 23–33`);

    // 3. Clear embeddings for orphaned docs 23–33
    const embRes = await client.query(`
      DELETE FROM kb_embeddings
       WHERE entity_type = 'document' AND entity_id BETWEEN 23 AND 33
    `);
    console.log(`[cleanup] Deleted ${embRes.rowCount} embedding rows for orphaned docs 23–33`);

    // 4. Delete the orphaned document rows themselves
    const docRes = await client.query(
      "DELETE FROM kb_documents WHERE id BETWEEN 23 AND 33",
    );
    console.log(`[cleanup] Deleted ${docRes.rowCount} orphaned document rows (IDs 23–33)`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
