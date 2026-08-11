import * as SecureStore from "expo-secure-store";

const INDEX_KEY = "hold.template.index";
const RECORD_PREFIX = "hold.template.circle.";
const COMBINATION_INDEX_KEY = "hold.template.combination.index";
const COMBINATION_RECORD_PREFIX = "hold.template.combination.";

export interface CircleTemplateRecord {
  circleId: string;
  text: string;
  updatedAt: number;
}

export interface CombinationTemplateRecord {
  combinationKey: string;
  circleIds: string[];
  text: string;
  updatedAt: number;
}

function recordKey(circleId: string): string {
  return `${RECORD_PREFIX}${circleId}`;
}

/**
 * The canonical key for a set of Circles selected together — sorted so the
 * same combination always keys the same way regardless of tap order, joined
 * with a separator that can't appear inside a Circle id (a
 * timestamp-plus-random string, see circleService.ts/createGroup).
 */
export function combinationKey(circleIds: string[]): string {
  return [...circleIds].sort().join("|");
}

async function readIndex(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

async function writeIndex(ids: string[]): Promise<void> {
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(ids));
}

async function readRecord(circleId: string): Promise<CircleTemplateRecord | null> {
  const raw = await SecureStore.getItemAsync(recordKey(circleId));
  return raw ? (JSON.parse(raw) as CircleTemplateRecord) : null;
}

/**
 * Saves a message as a given Circle's default — the "Save to Library" control
 * on Going Quiet's message step, and Library's own Templates section.
 */
export async function saveCircleTemplate(circleId: string, text: string): Promise<void> {
  const record: CircleTemplateRecord = { circleId, text, updatedAt: Date.now() };
  await SecureStore.setItemAsync(recordKey(circleId), JSON.stringify(record));

  const ids = await readIndex();
  if (!ids.includes(circleId)) {
    await writeIndex([...ids, circleId]);
  }
}

/** Null if this Circle has never had a message saved as its default. */
export async function getCircleTemplate(circleId: string): Promise<string | null> {
  const record = await readRecord(circleId);
  return record ? record.text : null;
}

/** Every Circle that currently has a saved default, in no particular order. */
export async function getAllTemplates(): Promise<CircleTemplateRecord[]> {
  const ids = await readIndex();
  const records = await Promise.all(ids.map((id) => readRecord(id)));
  return records.filter((record): record is CircleTemplateRecord => record !== null);
}

export async function deleteAllTemplates(): Promise<void> {
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

async function readCombinationRecord(key: string): Promise<CombinationTemplateRecord | null> {
  const raw = await SecureStore.getItemAsync(combinationRecordKey(key));
  return raw ? (JSON.parse(raw) as CombinationTemplateRecord) : null;
}

/**
 * Saves a message as the default for a specific SET of Circles selected
 * together — a second, parallel key scheme alongside the single-circle one
 * above, not a replacement for it (2026-08-11). A combination previously
 * sent to auto-loads its saved message the same no-decision way a single
 * Circle's own default does; a new combination offers starting points drawn
 * from its member Circles' single-circle defaults instead (see
 * getStartingPointsForCombination) rather than auto-loading anything. See
 * docs/09-decision-log.md, 2026-08-11.
 */
export async function saveCombinationTemplate(circleIds: string[], text: string): Promise<void> {
  const key = combinationKey(circleIds);
  const record: CombinationTemplateRecord = { combinationKey: key, circleIds, text, updatedAt: Date.now() };
  await SecureStore.setItemAsync(combinationRecordKey(key), JSON.stringify(record));

  const keys = await readCombinationIndex();
  if (!keys.includes(key)) {
    await writeCombinationIndex([...keys, key]);
  }
}

/** Null if this exact set of Circles has never had a shared message saved for it before. */
export async function getCombinationTemplate(circleIds: string[]): Promise<string | null> {
  const record = await readCombinationRecord(combinationKey(circleIds));
  return record ? record.text : null;
}

/**
 * For a combination with no saved default of its own: each member Circle's
 * own single-circle default, as an offered starting point ("start from
 * Work's message") rather than something auto-loaded — the person picks one
 * or starts fresh. Only returns Circles that actually have a single-circle
 * default saved; a Circle that's never been sent to alone contributes
 * nothing here.
 */
export async function getStartingPointsForCombination(
  circleIds: string[]
): Promise<{ circleId: string; text: string }[]> {
  const records = await Promise.all(circleIds.map((circleId) => readRecord(circleId)));
  return records
    .map((record, index) => (record ? { circleId: circleIds[index] ?? record.circleId, text: record.text } : null))
    .filter((entry): entry is { circleId: string; text: string } => entry !== null);
}

export async function deleteAllCombinationTemplates(): Promise<void> {
  const keys = await readCombinationIndex();
  await Promise.all(keys.map((key) => SecureStore.deleteItemAsync(combinationRecordKey(key))));
  await SecureStore.deleteItemAsync(COMBINATION_INDEX_KEY);
}
