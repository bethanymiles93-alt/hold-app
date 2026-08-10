import * as SecureStore from "expo-secure-store";
import type { CircleGroup } from "@/types/hold";

const INDEX_KEY = "hold.circle.index";
const GROUP_PREFIX = "hold.circle.group.";
const CLOSE_CIRCLE_ID = "close-circle";
const CLOSE_CIRCLE_NAME = "Close";
/** Pre-rename default, kept only to migrate already-persisted installs — see ensureCloseCircle(). */
const LEGACY_CLOSE_CIRCLE_NAME = "Close Circle";

function groupKey(id: string): string {
  return `${GROUP_PREFIX}${id}`;
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readIndex(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

async function writeIndex(ids: string[]): Promise<void> {
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(ids));
}

async function readGroup(id: string): Promise<CircleGroup | null> {
  const raw = await SecureStore.getItemAsync(groupKey(id));
  return raw ? (JSON.parse(raw) as CircleGroup) : null;
}

async function writeGroup(group: CircleGroup): Promise<void> {
  await SecureStore.setItemAsync(groupKey(group.id), JSON.stringify(group));

  const ids = await readIndex();
  if (!ids.includes(group.id)) {
    await writeIndex([...ids, group.id]);
  }
}

async function ensureCloseCircle(): Promise<CircleGroup> {
  const existing = await readGroup(CLOSE_CIRCLE_ID);
  if (existing) {
    // One-time migration for installs that already created Close Circle
    // under its old name — the name itself was never user-editable, so
    // this is safe to correct unconditionally rather than leaving already-
    // persisted installs stuck on the pre-rename string forever.
    if (existing.name === LEGACY_CLOSE_CIRCLE_NAME) {
      const renamed = { ...existing, name: CLOSE_CIRCLE_NAME };
      await writeGroup(renamed);
      return renamed;
    }
    return existing;
  }

  const closeCircle: CircleGroup = {
    id: CLOSE_CIRCLE_ID,
    name: CLOSE_CIRCLE_NAME,
    isCloseCircle: true,
    contacts: []
  };

  await writeGroup(closeCircle);
  return closeCircle;
}

/** Every saved group, Close Circle first. Creates Close Circle on first call. */
export async function getGroups(): Promise<CircleGroup[]> {
  const closeCircle = await ensureCloseCircle();
  const ids = await readIndex();
  const others = await Promise.all(
    ids.filter((id) => id !== CLOSE_CIRCLE_ID).map((id) => readGroup(id))
  );

  return [
    closeCircle,
    ...others.filter((group): group is CircleGroup => group !== null)
  ];
}

export async function getGroup(id: string): Promise<CircleGroup | null> {
  if (id === CLOSE_CIRCLE_ID) return ensureCloseCircle();
  return readGroup(id);
}

export async function createGroup(name: string): Promise<CircleGroup> {
  const group: CircleGroup = {
    id: createId(),
    name,
    isCloseCircle: false,
    contacts: []
  };

  await writeGroup(group);
  return group;
}

/** No-ops for Close Circle, which can't be deleted. */
export async function deleteGroup(id: string): Promise<void> {
  if (id === CLOSE_CIRCLE_ID) return;

  await SecureStore.deleteItemAsync(groupKey(id));
  const ids = await readIndex();
  await writeIndex(ids.filter((existing) => existing !== id));
}

/** Adds a contact to a group, deduping by phone number. Returns the updated group. */
export async function addContactToGroup(
  groupId: string,
  contact: { name: string; phoneNumber: string }
): Promise<CircleGroup | null> {
  const group = await readGroup(groupId);
  if (!group) return null;

  if (group.contacts.some((existing) => existing.phoneNumber === contact.phoneNumber)) {
    return group;
  }

  const updated: CircleGroup = {
    ...group,
    contacts: [
      ...group.contacts,
      { id: createId(), name: contact.name, phoneNumber: contact.phoneNumber }
    ]
  };

  await writeGroup(updated);
  return updated;
}

export async function removeContactFromGroup(
  groupId: string,
  contactId: string
): Promise<CircleGroup | null> {
  const group = await readGroup(groupId);
  if (!group) return null;

  const updated: CircleGroup = {
    ...group,
    contacts: group.contacts.filter((contact) => contact.id !== contactId)
  };

  await writeGroup(updated);
  return updated;
}

/** Wipes every saved Circle, including Close Circle (it's recreated empty on next read). */
export async function deleteAllCircles(): Promise<void> {
  const ids = await readIndex();
  await Promise.all(ids.map((id) => SecureStore.deleteItemAsync(groupKey(id))));
  await SecureStore.deleteItemAsync(INDEX_KEY);
}
