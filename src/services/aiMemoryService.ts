import * as SecureStore from "expo-secure-store";
import type { AiSurface } from "@/services/aiProxyClient";

const ENABLED_KEY = "hold.aimemory.enabled";
const INDEX_KEY = "hold.aimemory.index";
const RECORD_PREFIX = "hold.aimemory.note.";
const RETENTION_DAYS = 90;

export interface MemoryNote {
  id: string;
  text: string;
  surface: AiSurface;
  createdAt: number;
  expiresAt: number;
  /** Set once surfaced and "Used" — kept, but never suggested again. "Don't remember" deletes the record instead. */
  usedAt: number | null;
}

function recordKey(id: string): string {
  return `${RECORD_PREFIX}${id}`;
}

function createNoteId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readIndex(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

async function writeIndex(ids: string[]): Promise<void> {
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(ids));
}

async function readNote(id: string): Promise<MemoryNote | null> {
  const raw = await SecureStore.getItemAsync(recordKey(id));
  return raw ? (JSON.parse(raw) as MemoryNote) : null;
}

/** Layer 1 — a standing, off-by-default choice made ahead of time, never an in-the-moment prompt. */
export async function isMemoryEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ENABLED_KEY)) === "true";
}

/**
 * Turning Layer 1 off deletes every stored note immediately, regardless of
 * age — withdrawing consent means the data goes, not just future capture
 * stopping. See docs/03-privacy-model.md, "AI memory."
 */
export async function setMemoryEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await SecureStore.setItemAsync(ENABLED_KEY, "true");
    return;
  }

  await SecureStore.deleteItemAsync(ENABLED_KEY);
  await deleteAllMemoryNotes();
}

/**
 * Layer 2 capture — called only when Layer 1 is on and the model returned a
 * memory note alongside a draft. No interruption at capture time.
 */
export async function captureMemoryNote(surface: AiSurface, text: string): Promise<void> {
  if (!(await isMemoryEnabled())) return;

  const now = Date.now();
  const note: MemoryNote = {
    id: createNoteId(),
    text,
    surface,
    createdAt: now,
    expiresAt: now + RETENTION_DAYS * 24 * 60 * 60 * 1000,
    usedAt: null
  };

  await SecureStore.setItemAsync(recordKey(note.id), JSON.stringify(note));
  const ids = await readIndex();
  await writeIndex([...ids, note.id]);
}

/**
 * The oldest not-yet-used, not-yet-expired note, if Layer 1 is on — the
 * single suggestion surfaced during Taking Time or Reconnect. Expired notes
 * are pruned as encountered rather than on a schedule.
 */
export async function getSuggestedNote(): Promise<MemoryNote | null> {
  if (!(await isMemoryEnabled())) return null;

  const ids = await readIndex();
  const now = Date.now();
  let suggestion: MemoryNote | null = null;
  const expiredIds: string[] = [];

  for (const id of ids) {
    const note = await readNote(id);
    if (!note) continue;

    if (note.expiresAt <= now) {
      expiredIds.push(id);
      continue;
    }

    if (note.usedAt !== null) continue;

    if (!suggestion || note.createdAt < suggestion.createdAt) {
      suggestion = note;
    }
  }

  if (expiredIds.length > 0) {
    await Promise.all(expiredIds.map((id) => SecureStore.deleteItemAsync(recordKey(id))));
    await writeIndex(ids.filter((id) => !expiredIds.includes(id)));
  }

  return suggestion;
}

/** "Use it" — kept for the record, but never suggested again. */
export async function markNoteUsed(id: string): Promise<void> {
  const note = await readNote(id);
  if (!note) return;

  await SecureStore.setItemAsync(recordKey(id), JSON.stringify({ ...note, usedAt: Date.now() }));
}

/** "Don't remember" — deletes the note outright, not just marks it resolved. */
export async function deleteMemoryNote(id: string): Promise<void> {
  await SecureStore.deleteItemAsync(recordKey(id));
  const ids = await readIndex();
  await writeIndex(ids.filter((existing) => existing !== id));
}

export async function deleteAllMemoryNotes(): Promise<void> {
  const ids = await readIndex();
  await Promise.all(ids.map((id) => SecureStore.deleteItemAsync(recordKey(id))));
  await SecureStore.deleteItemAsync(INDEX_KEY);
}
