import * as SecureStore from "expo-secure-store";
import type { AudienceCircle, AudienceContact } from "@/types/hold";

const INDEX_KEY = "hold.conversation.index";
const RECORD_PREFIX = "hold.conversation.";

export interface ConversationPerson {
  id: string;
  name: string;
  phoneNumber: string;
  circleId: string | null;
  circleName: string | null;
  completed: boolean;
}

export interface ConversationProgress {
  total: number;
  completed: number;
}

function recordKey(id: string): string {
  return `${RECORD_PREFIX}${id}`;
}

function createPersonId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readIndex(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

async function writeIndex(ids: string[]): Promise<void> {
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(ids));
}

async function readRecord(id: string): Promise<ConversationPerson | null> {
  const raw = await SecureStore.getItemAsync(recordKey(id));
  return raw ? (JSON.parse(raw) as ConversationPerson) : null;
}

async function writeRecord(person: ConversationPerson): Promise<void> {
  await SecureStore.setItemAsync(recordKey(person.id), JSON.stringify(person));

  const ids = await readIndex();
  if (!ids.includes(person.id)) {
    await writeIndex([...ids, person.id]);
  }
}

/** Every person currently on the Conversations list, in no particular order. */
export async function getAll(): Promise<ConversationPerson[]> {
  const ids = await readIndex();
  const records = await Promise.all(ids.map((id) => readRecord(id)));
  return records.filter((person): person is ConversationPerson => person !== null);
}

/** Null when the list is empty — distinct from "0 of 0", which would be meaningless. */
export async function getProgress(): Promise<ConversationProgress | null> {
  const all = await getAll();
  if (all.length === 0) return null;

  return { total: all.length, completed: all.filter((person) => person.completed).length };
}

/**
 * Merges the Reconnect audience into the Conversations list without clearing anyone
 * already on it — old unfinished Conversations stay saved across quiet periods.
 * Dedupes by phone number: someone in two selected Circles, or already on the list
 * from a previous round, is only ever listed once.
 */
export async function seedFromAudience(
  circles: AudienceCircle[],
  ungrouped: AudienceContact[]
): Promise<void> {
  const existing = await getAll();
  const known = new Set(existing.map((person) => person.phoneNumber));
  const additions: ConversationPerson[] = [];

  for (const circle of circles) {
    for (const contact of circle.contacts) {
      if (known.has(contact.phoneNumber)) continue;
      known.add(contact.phoneNumber);
      additions.push({
        id: createPersonId(),
        name: contact.name,
        phoneNumber: contact.phoneNumber,
        circleId: circle.circleId,
        circleName: circle.circleName,
        completed: false
      });
    }
  }

  for (const contact of ungrouped) {
    if (known.has(contact.phoneNumber)) continue;
    known.add(contact.phoneNumber);
    additions.push({
      id: createPersonId(),
      name: contact.name,
      phoneNumber: contact.phoneNumber,
      circleId: null,
      circleName: null,
      completed: false
    });
  }

  await Promise.all(additions.map((person) => writeRecord(person)));
}

/** "Expand to full Circle" — adds whoever from that Circle isn't already listed. */
export async function addCircleMembers(
  circleId: string,
  circleName: string,
  contacts: AudienceContact[]
): Promise<void> {
  const existing = await getAll();
  const known = new Set(existing.map((person) => person.phoneNumber));
  const additions = contacts
    .filter((contact) => !known.has(contact.phoneNumber))
    .map((contact) => ({
      id: createPersonId(),
      name: contact.name,
      phoneNumber: contact.phoneNumber,
      circleId,
      circleName,
      completed: false
    }));

  await Promise.all(additions.map((person) => writeRecord(person)));
}

/** "+ Add person" — always ungrouped, one at a time. */
export async function addPerson(contact: { name: string; phoneNumber: string }): Promise<void> {
  const existing = await getAll();
  if (existing.some((person) => person.phoneNumber === contact.phoneNumber)) return;

  await writeRecord({
    id: createPersonId(),
    name: contact.name,
    phoneNumber: contact.phoneNumber,
    circleId: null,
    circleName: null,
    completed: false
  });
}

export async function toggleComplete(id: string, completed: boolean): Promise<void> {
  const person = await readRecord(id);
  if (!person) return;

  await writeRecord({ ...person, completed });
}

export async function removePerson(id: string): Promise<void> {
  await SecureStore.deleteItemAsync(recordKey(id));
  const ids = await readIndex();
  await writeIndex(ids.filter((existing) => existing !== id));
}

/** "I've already replied" / "I'll reply myself" — keeps history, marks everyone complete. */
export async function completeAll(): Promise<void> {
  const all = await getAll();
  await Promise.all(all.filter((person) => !person.completed).map((person) => writeRecord({ ...person, completed: true })));
}

/** Wipes the Conversations list entirely (used by the About "Delete" action). */
export async function deleteAllConversations(): Promise<void> {
  const ids = await readIndex();
  await Promise.all(ids.map((id) => SecureStore.deleteItemAsync(recordKey(id))));
  await SecureStore.deleteItemAsync(INDEX_KEY);
}
