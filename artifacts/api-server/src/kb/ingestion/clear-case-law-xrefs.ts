/**
 * One-time utility: clear cross-reference edges whose source_document_id
 * belongs to the uae_case_law collection, so the case-law-runner can
 * rebuild them cleanly with the fixed citation/legislation logic.
 */
import { pool } from "@workspace/db";

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      DELETE FROM kb_cross_references
       WHERE source_document_id IN (
         SELECT id FROM kb_documents WHERE collection_id = 'uae_case_law'
       )
          OR target_document_id IN (
         SELECT id FROM kb_documents WHERE collection_id = 'uae_case_law'
       )
    `);
    console.log(`[clear-case-law-xrefs] Deleted ${res.rowCount} case-law cross-reference rows.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
