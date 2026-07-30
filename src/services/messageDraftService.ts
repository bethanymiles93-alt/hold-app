import * as SecureStore from "expo-secure-store";
import { DRAFT_REPLY_RETENTION_HOURS } from "@/constants/copy";

const INDEX_KEY = "hold.draft.index";
const RECORD_PREFIX = "hold.draft.";

interface DraftRecord {
  key: string;
  text: string;
  expiresAt: number;
}

function recordKey(key: string): string {
  return `${RECORD_PREFIX}${key}`;
}

async function readIndex(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

async function writeIndex(keys: string[]): Promise<void> {
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(keys));
}

/**
 * An unsaved Reconnect message edit — the effortful, personal content that
 * must survive interruption across a "reach everyone at your own pace"
 * session. Persists until sent, explicitly discarded, or a 48h backstop,
 * whichever comes first.
 */
export async function saveDraft(key: string, text: string): Promise<void> {
  if (!text) {
    await clearDraft(key);
    return;
  }

  const record: DraftRecord = {
    key,
    text,
    expiresAt: Date.now() + DRAFT_REPLY_RETENTION_HOURS * 60 * 60 * 1000
  };
  await SecureStore.setItemAsync(recordKey(key), JSON.stringify(record));

  const keys = await readIndex();
  if (!keys.includes(key)) {
    await writeIndex([...keys, key]);
  }
}

/** Null if there's no draft for this key, or its 48h backstop has passed (deleted if so). */
export async function getDraft(key: string): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(recordKey(key));
  if (!raw) return null;

  const record = JSON.parse(raw) as DraftRecord;
  if (record.expiresAt <= Date.now()) {
    await clearDraft(key);
    return null;
  }

  return record.text;
}

/** On send, or once the content has been explicitly saved to Library instead. */
export async function clearDraft(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(recordKey(key));
  const keys = await readIndex();
  await writeIndex(keys.filter((existing) => existing !== key));
}

export async function deleteAllDrafts(): Promise<void> {
  const keys = await readIndex();
  await Promise.all(keys.map((key) => SecureStore.deleteItemAsync(recordKey(key))));
  await SecureStore.deleteItemAsync(INDEX_KEY);
}
