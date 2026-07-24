import * as SecureStore from "expo-secure-store";
import type { AudienceContact, HoldPeriod } from "@/types/hold";

const INDEX_KEY = "hold.history.index";
const OPEN_KEY = "hold.history.open";
const POST_RECONNECT_KEY = "hold.history.postReconnect";
const RECORD_PREFIX = "hold.history.";

function recordKey(id: string): string {
  return `${RECORD_PREFIX}${id}`;
}

function createHoldPeriodId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readIndex(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

async function writeIndex(ids: string[]): Promise<void> {
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(ids));
}

async function readRecord(id: string): Promise<HoldPeriod | null> {
  const raw = await SecureStore.getItemAsync(recordKey(id));
  return raw ? (JSON.parse(raw) as HoldPeriod) : null;
}

async function writeRecord(period: HoldPeriod): Promise<void> {
  await SecureStore.setItemAsync(recordKey(period.id), JSON.stringify(period));

  const ids = await readIndex();
  if (!ids.includes(period.id)) {
    await writeIndex([...ids, period.id]);
  }
}

export interface StartHoldPeriodInput {
  recipients: string[];
  audienceCircleNames: string[];
  audienceContacts: AudienceContact[];
}

/** Opens a new Hold period. Called the moment a Hold is actually shared. */
export async function startHoldPeriod(input: StartHoldPeriodInput): Promise<void> {
  const period: HoldPeriod = {
    id: createHoldPeriodId(),
    startedAt: Date.now(),
    endedAt: null,
    recipients: input.recipients,
    audienceCircleNames: input.audienceCircleNames,
    audienceContacts: input.audienceContacts
  };

  await writeRecord(period);
  await SecureStore.setItemAsync(OPEN_KEY, period.id);
}

/** The currently-open Hold period, if any. Null when the user is not in a Hold. */
export async function getOpenHoldPeriod(): Promise<HoldPeriod | null> {
  const openId = await SecureStore.getItemAsync(OPEN_KEY);
  if (!openId) return null;

  return readRecord(openId);
}

/** Closes the currently-open Hold period, if any. No-ops otherwise. */
export async function endOpenHoldPeriod(): Promise<void> {
  const openId = await SecureStore.getItemAsync(OPEN_KEY);
  if (!openId) return;

  const period = await readRecord(openId);
  if (period && period.endedAt === null) {
    await writeRecord({ ...period, endedAt: Date.now() });
  }

  await SecureStore.deleteItemAsync(OPEN_KEY);
}

export interface PostReconnectState {
  startReplyCount: number;
}

/**
 * Marks the deliberate Post-Reconnect exception active: the user sent a Quick
 * Reconnect instead of completing Thoughtful replies, so there's genuinely
 * something still open. `startReplyCount` snapshots how many Thoughtful-reply
 * drafts were in progress at that moment, for "X of Y sent" progress later.
 */
export async function setPostReconnectActive(startReplyCount: number): Promise<void> {
  const state: PostReconnectState = { startReplyCount };
  await SecureStore.setItemAsync(POST_RECONNECT_KEY, JSON.stringify(state));
}

export async function getPostReconnectState(): Promise<PostReconnectState | null> {
  const raw = await SecureStore.getItemAsync(POST_RECONNECT_KEY);
  return raw ? (JSON.parse(raw) as PostReconnectState) : null;
}

export async function clearPostReconnect(): Promise<void> {
  await SecureStore.deleteItemAsync(POST_RECONNECT_KEY);
}

/** Every closed Hold period, most recent first. */
export async function getHistory(): Promise<HoldPeriod[]> {
  const ids = await readIndex();
  const records = await Promise.all(ids.map((id) => readRecord(id)));

  return records
    .filter((period): period is HoldPeriod => period !== null && period.endedAt !== null)
    .sort((a, b) => b.startedAt - a.startedAt);
}

export async function deleteHoldPeriod(id: string): Promise<void> {
  await SecureStore.deleteItemAsync(recordKey(id));
  const ids = await readIndex();
  await writeIndex(ids.filter((existing) => existing !== id));
}

/** Wipes every Hold period, closed or currently open, and the open-period marker. */
export async function deleteAllHoldHistory(): Promise<void> {
  const ids = await readIndex();
  await Promise.all(ids.map((id) => SecureStore.deleteItemAsync(recordKey(id))));
  await SecureStore.deleteItemAsync(INDEX_KEY);
  await SecureStore.deleteItemAsync(OPEN_KEY);
  await SecureStore.deleteItemAsync(POST_RECONNECT_KEY);
}
