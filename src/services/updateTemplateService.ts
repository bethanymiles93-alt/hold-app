import * as SecureStore from "expo-secure-store";
import { combinationKey } from "./templateService";

const INDEX_KEY = "hold.updateTemplate.index";
const RECORD_PREFIX = "hold.updateTemplate.circle.";
const COMBINATION_INDEX_KEY = "hold.updateTemplate.combination.index";
const COMBINATION_RECORD_PREFIX = "hold.updateTemplate.combination.";

export interface UpdateCircleTemplateRecord {
  circleId: string;
  text: string;
  updatedAt: number;
}

export interface UpdateCombinationTemplateRecord {
  combinationKey: string;
  circleIds: string[];
  text: string;
  updatedAt: number;
}

/**
 * Taking Time's "Send an Update" gets its own storage namespace, separate
 * from Going Quiet's (`templateService.ts`) and Reconnect's
 * (`reconnectTemplateService.ts`) — same mechanics (single-circle key,
 * sorted-combination key via the shared `combinationKey()` helper), same
 * reason those two are already kept apart: a Circle plausibly wants a
 * different saved default for each kind of message, and sharing one key
 * would let one silently overwrite another. `combinationKey()` itself is
 * reused directly (pure/stateless, no reason to duplicate it) rather than
 * reimplemented. Doubles as the source of "these Circles are linked"
 * (Olympic-rings) grouping in the Update drawer — a combination with a
 * saved template here is, by construction, a set of Circles that received
 * one combined message together. See docs/09-decision-log.md, 2026-08-13.
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

async function readRecord(circleId: string): Promise<UpdateCircleTemplateRecord | null> {
  const raw = await SecureStore.getItemAsync(recordKey(circleId));
  return raw ? (JSON.parse(raw) as UpdateCircleTemplateRecord) : null;
}

export async function saveUpdateCircleTemplate(circleId: string, text: string): Promise<void> {
  const record: UpdateCircleTemplateRecord = { circleId, text, updatedAt: Date.now() };
  await SecureStore.setItemAsync(recordKey(circleId), JSON.stringify(record));

  const ids = await readIndex();
  if (!ids.includes(circleId)) {
    await writeIndex([...ids, circleId]);
  }
}

/** Null if this Circle has never had an Update message saved as its default. */
export async function getUpdateCircleTemplate(circleId: string): Promise<string | null> {
  const record = await readRecord(circleId);
  return record ? record.text : null;
}

export async function deleteAllUpdateTemplates(): Promise<void> {
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

async function readCombinationRecord(key: string): Promise<UpdateCombinationTemplateRecord | null> {
  const raw = await SecureStore.getItemAsync(combinationRecordKey(key));
  return raw ? (JSON.parse(raw) as UpdateCombinationTemplateRecord) : null;
}

export async function saveUpdateCombinationTemplate(circleIds: string[], text: string): Promise<void> {
  const key = combinationKey(circleIds);
  const record: UpdateCombinationTemplateRecord = { combinationKey: key, circleIds, text, updatedAt: Date.now() };
  await SecureStore.setItemAsync(combinationRecordKey(key), JSON.stringify(record));

  const keys = await readCombinationIndex();
  if (!keys.includes(key)) {
    await writeCombinationIndex([...keys, key]);
  }
}

/** Null if this exact set of Circles has never had a shared Update message saved for it before. */
export async function getUpdateCombinationTemplate(circleIds: string[]): Promise<string | null> {
  const record = await readCombinationRecord(combinationKey(circleIds));
  return record ? record.text : null;
}

/**
 * Every saved combination template, in no particular order — the Update
 * drawer's source for "which Circles are currently linked": each record's
 * `circleIds` is a set that has previously been sent to together as one
 * message, independent of whether it's the currently-selected set.
 */
export async function getAllUpdateCombinationTemplates(): Promise<UpdateCombinationTemplateRecord[]> {
  const keys = await readCombinationIndex();
  const records = await Promise.all(keys.map((key) => readCombinationRecord(key)));
  return records.filter((record): record is UpdateCombinationTemplateRecord => record !== null);
}

/**
 * For a combination with no saved default of its own: each member Circle's
 * own single-circle Update default, as an offered starting point — the
 * person picks one or starts blank, matching Going Quiet's own
 * first-use-of-a-combination pattern (`templateService.getStartingPointsForCombination`).
 */
export async function getUpdateStartingPointsForCombination(
  circleIds: string[]
): Promise<{ circleId: string; text: string }[]> {
  const records = await Promise.all(circleIds.map((circleId) => readRecord(circleId)));
  return records
    .map((record, index) => (record ? { circleId: circleIds[index] ?? record.circleId, text: record.text } : null))
    .filter((entry): entry is { circleId: string; text: string } => entry !== null);
}

export async function deleteAllUpdateCombinationTemplates(): Promise<void> {
  const keys = await readCombinationIndex();
  await Promise.all(keys.map((key) => SecureStore.deleteItemAsync(combinationRecordKey(key))));
  await SecureStore.deleteItemAsync(COMBINATION_INDEX_KEY);
}
