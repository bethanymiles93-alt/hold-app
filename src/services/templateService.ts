import * as SecureStore from "expo-secure-store";

const INDEX_KEY = "hold.template.index";
const RECORD_PREFIX = "hold.template.circle.";

export interface CircleTemplateRecord {
  circleId: string;
  text: string;
  updatedAt: number;
}

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
