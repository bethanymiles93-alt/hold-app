import * as SecureStore from "expo-secure-store";
import { combinationKey } from "@/services/templateService";

const INDEX_KEY = "hold.reconnect.template.index";
const RECORD_PREFIX = "hold.reconnect.template.circle.";
const COMBINATION_INDEX_KEY = "hold.reconnect.template.combination.index";
const COMBINATION_RECORD_PREFIX = "hold.reconnect.template.combination.";

export interface ReconnectTemplateRecord {
  circleId: string;
  text: string;
  updatedAt: number;
}

export interface ReconnectCombinationTemplateRecord {
  combinationKey: string;
  circleIds: string[];
  text: string;
  updatedAt: number;
}

/**
 * Reconnect's own per-Circle/per-combination saved-message architecture
 * (2026-08-13) — deliberately a separate storage namespace from
 * templateService.ts's Going Quiet templates, not a shared one, even
 * though the mechanics (single-Circle + sorted-combination keys, Save/
 * Change template controls) are the same pattern. The content itself is a
 * different kind of thing: a short, instant, placeholder-style line
 * ("I'm getting there, will send a proper response soon"), not a fully
 * redrafted message — a Circle plausibly wants a different saved default
 * for "going quiet" than for "reconnecting", so sharing one key per Circle
 * across both would silently overwrite one with the other's tone. Replaces
 * the previous hardcoded QUICK_RECONNECT_MESSAGES as Reconnect's own
 * message source; that constant and Library's own separate use of it are
 * untouched. See docs/09-decision-log.md.
 */
function recordKey(circleId: string): string {
  return `${RECORD_PREFIX}${circleId}`;
}

async function readIndex(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

async function writeIndex(ids: string[]): Promise<void> {
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(ids));
}

async function readRecord(circleId: string): Promise<ReconnectTemplateRecord | null> {
  const raw = await SecureStore.getItemAsync(recordKey(circleId));
  return raw ? (JSON.parse(raw) as ReconnectTemplateRecord) : null;
}

export async function saveReconnectCircleTemplate(circleId: string, text: string): Promise<void> {
  const record: ReconnectTemplateRecord = { circleId, text, updatedAt: Date.now() };
  await SecureStore.setItemAsync(recordKey(circleId), JSON.stringify(record));

  const ids = await readIndex();
  if (!ids.includes(circleId)) {
    await writeIndex([...ids, circleId]);
  }
}

/** Null if this Circle has never had a Reconnect message saved as its default. */
export async function getReconnectCircleTemplate(circleId: string): Promise<string | null> {
  const record = await readRecord(circleId);
  return record ? record.text : null;
}

export async function deleteAllReconnectTemplates(): Promise<void> {
  const ids = await readIndex();
  await Promise.all(ids.map((id) => SecureStore.deleteItemAsync(recordKey(id))));
  await SecureStore.deleteItemAsync(INDEX_KEY);
}

function combinationRecordKey(key: string): string {
  return `${COMBINATION_RECORD_PREFIX}${key}`;
}

async function readCombinationIndex(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(COMBINATION_INDEX_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

async function writeCombinationIndex(keys: string[]): Promise<void> {
  await SecureStore.setItemAsync(COMBINATION_INDEX_KEY, JSON.stringify(keys));
}

async function readCombinationRecord(key: string): Promise<ReconnectCombinationTemplateRecord | null> {
  const raw = await SecureStore.getItemAsync(combinationRecordKey(key));
  return raw ? (JSON.parse(raw) as ReconnectCombinationTemplateRecord) : null;
}

/**
 * Saves a message as the default for a specific set of Circles currently
 * contributing to a Reconnect send together — mirrors
 * templateService.ts's own combination scheme exactly, same
 * combinationKey() helper (sorted, joined circle ids), separate storage.
 */
export async function saveReconnectCombinationTemplate(circleIds: string[], text: string): Promise<void> {
  const key = combinationKey(circleIds);
  const record: ReconnectCombinationTemplateRecord = { combinationKey: key, circleIds, text, updatedAt: Date.now() };
  await SecureStore.setItemAsync(combinationRecordKey(key), JSON.stringify(record));

  const keys = await readCombinationIndex();
  if (!keys.includes(key)) {
    await writeCombinationIndex([...keys, key]);
  }
}

/** Null if this exact set of Circles has never had a shared Reconnect message saved for it before. */
export async function getReconnectCombinationTemplate(circleIds: string[]): Promise<string | null> {
  const record = await readCombinationRecord(combinationKey(circleIds));
  return record ? record.text : null;
}

export async function deleteAllReconnectCombinationTemplates(): Promise<void> {
  const keys = await readCombinationIndex();
  await Promise.all(keys.map((key) => SecureStore.deleteItemAsync(combinationRecordKey(key))));
  await SecureStore.deleteItemAsync(COMBINATION_INDEX_KEY);
}
