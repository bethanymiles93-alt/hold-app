import * as SecureStore from "expo-secure-store";
import type { AudienceCircle, AudienceContact } from "@/types/hold";

const INDEX_KEY = "hold.conversation.index";
const RECORD_PREFIX = "hold.conversation.";

export type ConversationBucket = "quick" | "personalise";

export interface ConversationPerson {
  id: string;
  name: string;
  phoneNumber: string;
  circleId: string | null;
  circleName: string | null;
  completed: boolean;
  bucket: ConversationBucket;
  sentAt: number | null;
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
 * already on it — old *unfinished* Conversations stay saved across quiet periods.
 * Someone already on the list but already completed from a previous round is reset
 * to fresh and incomplete instead: being back in a new Reconnect audience means this
 * round is asking the "have you told them" question again, not inheriting last
 * round's answer. Dedupes by phone number either way — someone in two selected
 * Circles, or already on the list, is only ever listed once.
 */
export async function seedFromAudience(
  circles: AudienceCircle[],
  ungrouped: AudienceContact[]
): Promise<void> {
  const existing = await getAll();
  const existingByPhone = new Map(existing.map((person) => [person.phoneNumber, person]));
  const known = new Set(existing.map((person) => person.phoneNumber));
  const writes: ConversationPerson[] = [];

  const seed = (
    contact: { name: string; phoneNumber: string },
    circleId: string | null,
    circleName: string | null
  ) => {
    if (known.has(contact.phoneNumber)) {
      const current = existingByPhone.get(contact.phoneNumber);
      if (current?.completed) {
        writes.push({ ...current, completed: false, bucket: "quick", sentAt: null });
      }
      return;
    }

    known.add(contact.phoneNumber);
    writes.push({
      id: createPersonId(),
      name: contact.name,
      phoneNumber: contact.phoneNumber,
      circleId,
      circleName,
      completed: false,
      bucket: "quick",
      sentAt: null
    });
  };

  for (const circle of circles) {
    for (const contact of circle.contacts) {
      seed(contact, circle.circleId, circle.circleName);
    }
  }

  for (const contact of ungrouped) {
    seed(contact, null, null);
  }

  await Promise.all(writes.map((person) => writeRecord(person)));
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
      completed: false,
      bucket: "quick" as const,
      sentAt: null
    }));

  await Promise.all(additions.map((person) => writeRecord(person)));
}

/** "+ Add person" — always ungrouped, always Personalise, one at a time. */
export async function addPerson(contact: { name: string; phoneNumber: string }): Promise<void> {
  const existing = await getAll();
  if (existing.some((person) => person.phoneNumber === contact.phoneNumber)) return;

  await writeRecord({
    id: createPersonId(),
    name: contact.name,
    phoneNumber: contact.phoneNumber,
    circleId: null,
    circleName: null,
    completed: false,
    bucket: "personalise",
    sentAt: null
  });
}

/**
 * Seeds a Going Quiet recipient who tapped "Personalise" straight into the
 * Personalise bucket, at Send time — unlike addPerson, preserves their
 * Circle so Library can still show the tag.
 */
export async function seedPersonaliseRecipient(contact: {
  name: string;
  phoneNumber: string;
  circleId: string;
  circleName: string;
}): Promise<void> {
  const existing = await getAll();
  if (existing.some((person) => person.phoneNumber === contact.phoneNumber)) return;

  await writeRecord({
    id: createPersonId(),
    name: contact.name,
    phoneNumber: contact.phoneNumber,
    circleId: contact.circleId,
    circleName: contact.circleName,
    completed: false,
    bucket: "personalise",
    sentAt: null
  });
}

export async function toggleComplete(id: string, completed: boolean): Promise<void> {
  const person = await readRecord(id);
  if (!person) return;

  await writeRecord({ ...person, completed });
}

/** Marks a batch of Quick message recipients as sent — a bulk send is atomic, so they share one timestamp. */
export async function markQuickSent(ids: string[]): Promise<void> {
  const sentAt = Date.now();
  await Promise.all(
    ids.map(async (id) => {
      const person = await readRecord(id);
      if (!person) return;
      await writeRecord({ ...person, completed: true, sentAt });
    })
  );
}

/**
 * Keeps sentAt truthfully in sync for an instant message sent outside the
 * Quick message flow (Reconnect) without marking the conversation complete —
 * unlike markQuickSent, an instant message alone doesn't answer "have you
 * replied properly," so completed must stay whatever it already was.
 */
export async function markContacted(ids: string[]): Promise<void> {
  const sentAt = Date.now();
  await Promise.all(
    ids.map(async (id) => {
      const person = await readRecord(id);
      if (!person) return;
      await writeRecord({ ...person, sentAt });
    })
  );
}

/** Unticking someone out of Quick message — they move to Personalise/Conversations. */
export async function moveToPersonalise(id: string): Promise<void> {
  const person = await readRecord(id);
  if (!person) return;

  await writeRecord({ ...person, bucket: "personalise" });
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
