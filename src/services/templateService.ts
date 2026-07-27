import * as SecureStore from "expo-secure-store";

const INDEX_KEY = "hold.template.index";
const RECORD_PREFIX = "hold.template.circle.";

interface CircleTemplateRecord {
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

/**
 * Saves a message as a given Circle's default — the "Save to Library" control
 * on Going Quiet's message step. Only save/read is built here; browsing/editing
 * saved defaults directly is Library's job (Section 3).
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
  const raw = await SecureStore.getItemAsync(recordKey(circleId));
  if (!raw) return null;

  return (JSON.parse(raw) as CircleTemplateRecord).text;
}

export async function deleteAllTemplates(): Promise<void> {
  const ids = await readIndex();
  await Promise.all(ids.map((id) => SecureStore.deleteItemAsync(recordKey(id))));
  await SecureStore.deleteItemAsync(INDEX_KEY);
}
