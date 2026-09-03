/**
 * Small localStorage-backed helpers used by the redesigned homepage composer,
 * the results page, and the Archive / Previous Requests pages (Issue #8).
 * Deliberately client-only (no new backend endpoints) — archive/draft state is
 * per-browser, same pattern already used elsewhere in this app (e.g. appLang).
 *
 * Namespaced per authenticated user (see setStorageUserId, called by
 * UserProvider whenever the session loads/changes) so that on a shared or
 * kiosk-style workstation, one user's archived request titles or in-progress
 * draft text are never visible to the next person who signs in.
 */

const ARCHIVE_KEY = 'marsad_archive';
const DRAFT_KEY = 'marsad_draft';

let currentUserId: number | null = null;

/** Called by UserProvider whenever the session changes (login/logout/switch). */
export function setStorageUserId(userId: number | null): void {
  currentUserId = userId;
}

function scopedKey(base: string): string {
  return currentUserId !== null ? `${base}:${currentUserId}` : base;
}

export interface ArchiveEntry {
  sessionId: number;
  title: string;
  savedAt: string;
}

export function getArchive(): ArchiveEntry[] {
  try {
    const raw = localStorage.getItem(scopedKey(ARCHIVE_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addToArchive(entry: ArchiveEntry): void {
  const current = getArchive().filter((e) => e.sessionId !== entry.sessionId);
  const next = [entry, ...current].slice(0, 200);
  localStorage.setItem(scopedKey(ARCHIVE_KEY), JSON.stringify(next));
}

export function isArchived(sessionId: number): boolean {
  return getArchive().some((e) => e.sessionId === sessionId);
}

export function removeFromArchive(sessionId: number): void {
  const next = getArchive().filter((e) => e.sessionId !== sessionId);
  localStorage.setItem(scopedKey(ARCHIVE_KEY), JSON.stringify(next));
}

export interface DraftPayload {
  question: string;
  fileNames: string[];
  hasVoiceNote: boolean;
  selections: Record<string, string>;
  savedAt: string;
}

export function getDraft(): DraftPayload | null {
  try {
    const raw = localStorage.getItem(scopedKey(DRAFT_KEY));
    if (!raw) return null;
    return JSON.parse(raw) as DraftPayload;
  } catch {
    return null;
  }
}

export function saveDraft(payload: DraftPayload): void {
  localStorage.setItem(scopedKey(DRAFT_KEY), JSON.stringify(payload));
}

export function clearDraft(): void {
  localStorage.removeItem(scopedKey(DRAFT_KEY));
}
