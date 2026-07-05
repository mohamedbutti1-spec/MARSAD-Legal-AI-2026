/**
 * Phase 57 — Citation Refresh / Staleness Checker
 *
 * When a saved research answer is fetched, we check whether any KB documents
 * it cited have been updated (kb_documents.updated_at) since the last check.
 * If so, we mark the citation_refresh_status row as stale and return the reason.
 *
 * Polling-on-open model: no background jobs, no webhooks.
 * DO NOT modify any existing table or route.
 */

import { db, kbDocumentsTable, citationRefreshStatusTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

export interface CitationStalenessResult {
  isStale: boolean;
  reason: string | null;
  lastCheckedAt: Date | null;
  checkedNow: boolean;
}

/**
 * Check whether any KB document cited by this research item has been updated
 * since the last staleness check. Updates citation_refresh_status in place.
 *
 * @param itemId    research_items.id
 * @param forceCheck  if true, skip the cooldown and always re-check
 * @returns CitationStalenessResult
 */
export async function checkCitationStaleness(
  itemId: number,
  forceCheck = false,
): Promise<CitationStalenessResult> {
  // Fetch the current staleness row
  const [row] = await db
    .select()
    .from(citationRefreshStatusTable)
    .where(eq(citationRefreshStatusTable.itemId, itemId))
    .limit(1);

  if (!row) {
    // No refresh row = this item has no cited KB documents to check
    return { isStale: false, reason: null, lastCheckedAt: null, checkedNow: false };
  }

  const kbDocIds: number[] = JSON.parse(row.kbDocumentIds || "[]");
  if (kbDocIds.length === 0) {
    return { isStale: false, reason: null, lastCheckedAt: row.lastCheckedAt, checkedNow: false };
  }

  // Cooldown: don't re-check more than once per 5 minutes unless forced
  const COOLDOWN_MS = 5 * 60 * 1000;
  const now = new Date();
  if (!forceCheck && row.lastCheckedAt) {
    const elapsed = now.getTime() - new Date(row.lastCheckedAt).getTime();
    if (elapsed < COOLDOWN_MS) {
      return {
        isStale:       row.isStale,
        reason:        row.stalenessReason ?? null,
        lastCheckedAt: row.lastCheckedAt,
        checkedNow:    false,
      };
    }
  }

  // Fetch KB docs to check updated_at
  const kbRows = await db
    .select({
      id:        kbDocumentsTable.id,
      titleAr:   kbDocumentsTable.titleAr,
      updatedAt: kbDocumentsTable.updatedAt,
    })
    .from(kbDocumentsTable)
    .where(inArray(kbDocumentsTable.id, kbDocIds));

  const lastCheckedAt = row.lastCheckedAt;
  const staleEntries: string[] = [];

  if (lastCheckedAt) {
    const lastCheckedDate = new Date(lastCheckedAt);
    for (const kbRow of kbRows) {
      if (kbRow.updatedAt && new Date(kbRow.updatedAt) > lastCheckedDate) {
        staleEntries.push(
          `${kbRow.titleAr} (updated ${new Date(kbRow.updatedAt).toLocaleDateString("ar-AE")})`,
        );
      }
    }
  }

  const isStale   = staleEntries.length > 0;
  const reason    = isStale
    ? `التالية تم تحديثها منذ حفظ هذا الجواب: ${staleEntries.join("، ")}`
    : null;

  // Update the staleness row
  await db.execute(sql`
    UPDATE citation_refresh_status
    SET is_stale         = ${isStale},
        staleness_reason = ${reason},
        last_checked_at  = ${now.toISOString()},
        updated_at       = NOW()
    WHERE item_id = ${itemId}
  `);

  return { isStale, reason, lastCheckedAt: now, checkedNow: true };
}

/**
 * Register (or replace) the set of KB document IDs cited by an answer item.
 * Called when a new answer item is saved.
 */
export async function registerCitedKbDocs(
  itemId: number,
  kbDocumentIds: number[],
): Promise<void> {
  const existing = await db
    .select({ id: citationRefreshStatusTable.id })
    .from(citationRefreshStatusTable)
    .where(eq(citationRefreshStatusTable.itemId, itemId))
    .limit(1);

  const idsJson = JSON.stringify(kbDocumentIds);

  if (existing.length > 0) {
    await db.execute(sql`
      UPDATE citation_refresh_status
      SET kb_document_ids = ${idsJson},
          is_stale        = FALSE,
          staleness_reason = NULL,
          last_checked_at  = NOW(),
          updated_at       = NOW()
      WHERE item_id = ${itemId}
    `);
  } else {
    await db.execute(sql`
      INSERT INTO citation_refresh_status
        (item_id, kb_document_ids, last_checked_at, is_stale, updated_at)
      VALUES
        (${itemId}, ${idsJson}, NOW(), FALSE, NOW())
    `);
  }
}
