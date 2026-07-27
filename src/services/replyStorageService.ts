import * as SecureStore from "expo-secure-store";
import { partitionActiveReplies } from "@/services/replyExpiry";
import type { StoredReply } from "@/types/hold";

const INDEX_KEY = "hold.reply.index";
const RECORD_PREFIX = "hold.reply.";

function recordKey(id: string): string {
  return `${RECORD_PREFIX}${id}`;
}

async function readIndex(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

async function writeIndex(ids: string[]): Promise<void> {
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(ids));
}

/**
 * Persists one reply record, encrypted at rest (Keychain on iOS, Keystore-backed
 * storage on Android). This is the one deliberate, narrow exception to Hold's
 * in-memory-only rule — see docs/03-privacy-model.md.
 */
export async function saveReply(reply: StoredReply): Promise<void> {
  await SecureStore.setItemAsync(recordKey(reply.id), JSON.stringify(reply));

  const ids = await readIndex();
  if (!ids.includes(reply.id)) {
    await writeIndex([...ids, reply.id]);
  }
}

export async function deleteReply(id: string): Promise<void> {
  await SecureStore.deleteItemAsync(recordKey(id));
  const ids = await readIndex();
  await writeIndex(ids.filter((existing) => existing !== id));
}

/** Wipes every stored reply, expired or not. */
export async function deleteAllReplies(): Promise<void> {
  const ids = await readIndex();
  await Promise.all(ids.map((id) => SecureStore.deleteItemAsync(recordKey(id))));
  await SecureStore.deleteItemAsync(INDEX_KEY);
}

export interface ActiveRepliesResult {
  active: StoredReply[];
  justExpiredIds: string[];
}

/**
 * Reads every stored reply, deleting (and reporting) any whose bridge window
 * has passed. Expiry is only checked when this runs — there is no guaranteed
 * background timer — so a record can remain at rest, still encrypted, until
 * the app is next opened or foregrounded.
 */
export async function getActiveReplies(now: number): Promise<ActiveRepliesResult> {
  const ids = await readIndex();
  const records: StoredReply[] = [];

  for (const id of ids) {
    const raw = await SecureStore.getItemAsync(recordKey(id));
    if (raw) records.push(JSON.parse(raw) as StoredReply);
  }

  const { active, expired } = partitionActiveReplies(records, now);

  for (const reply of expired) {
    await deleteReply(reply.id);
  }

  return { active, justExpiredIds: expired.map((reply) => reply.id) };
}

/** A single reply by id, if it exists and hasn't expired. Used to load a person's
 * existing Personalise draft when their accordion panel expands. */
export async function getReply(id: string): Promise<StoredReply | null> {
  const { active } = await getActiveReplies(Date.now());
  return active.find((reply) => reply.id === id) ?? null;
}
