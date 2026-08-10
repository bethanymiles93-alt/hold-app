import * as SecureStore from "expo-secure-store";
import type { AudienceCircle, HoldPeriod } from "@/types/hold";

const INDEX_KEY = "hold.history.index";
const OPEN_KEY = "hold.history.open";
const RECONNECTING_KEY = "hold.history.reconnecting";
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
  audienceCircles: AudienceCircle[];
}

/** Opens a new Hold period. Called the moment a Hold is actually shared. Returns its id. */
export async function startHoldPeriod(input: StartHoldPeriodInput): Promise<string> {
  const period: HoldPeriod = {
    id: createHoldPeriodId(),
    startedAt: Date.now(),
    endedAt: null,
    recipients: input.recipients,
    audienceCircles: input.audienceCircles
  };

  await writeRecord(period);
  await SecureStore.setItemAsync(OPEN_KEY, period.id);
  // A fresh Hold period makes any previous, unfinished Reconnect moot.
  await endReconnecting();

  return period.id;
}

/**
 * Records how a Circle's/ungrouped contact's message actually went out —
 * process metadata only, never message content. Keyed by Circle id or phone
 * number; safe to call repeatedly (e.g. once per send within Reconnect's
 * multi-session flow) as it simply overwrites that id's latest channel.
 */
export async function recordSendChannel(periodId: string, id: string, channel: string): Promise<void> {
  const period = await readRecord(periodId);
  if (!period) return;

  await writeRecord({
    ...period,
    sendChannels: { ...(period.sendChannels ?? {}), [id]: channel }
  });
}

/**
 * Appends someone new to the currently-open period's audience — the "Add to Going
 * Quiet" edge case (a new contact messages while the user is away). No-ops if there's
 * no open period. Added to the ungrouped bucket, same convention Conversations uses
 * for its own "+ Add person" — not part of an original Circle.
 */
export async function addToAudience(contact: { name: string; phoneNumber: string }): Promise<void> {
  const openId = await SecureStore.getItemAsync(OPEN_KEY);
  if (!openId) return;

  const period = await readRecord(openId);
  if (!period) return;

  const circles = period.audienceCircles ?? [];
  const ungrouped = period.audienceUngrouped ?? [];
  const alreadyPresent =
    circles.some((circle) => circle.contacts.some((existing) => existing.phoneNumber === contact.phoneNumber)) ||
    ungrouped.some((existing) => existing.phoneNumber === contact.phoneNumber);
  if (alreadyPresent) return;

  const updated: HoldPeriod = {
    ...period,
    recipients: [...period.recipients, contact.name],
    audienceUngrouped: [...ungrouped, contact]
  };

  await writeRecord(updated);
}

/**
 * A specific Hold period by id, independent of OPEN_KEY/RECONNECTING_KEY — lets
 * Reconnect source its target period as soon as it's known (right when "Reconnect"
 * is tapped), before the durable reconnecting marker exists yet.
 */
export async function getHoldPeriodById(id: string): Promise<HoldPeriod | null> {
  return readRecord(id);
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
  await SecureStore.deleteItemAsync(RECONNECTING_KEY);
}

/**
 * Writes the OOO/status choices made at Going Quiet's "Done" step onto the
 * still-open period (Send already started it; Done is when these are set).
 */
export async function recordPostSendChoices(choices: {
  emailOutOfOfficeEnabled: boolean;
  widerWorldStatusEnabled: boolean;
}): Promise<void> {
  const openId = await SecureStore.getItemAsync(OPEN_KEY);
  if (!openId) return;

  const period = await readRecord(openId);
  if (!period) return;

  await writeRecord({ ...period, ...choices });
}

/**
 * Marks which period is currently being reconnected from — a durable marker,
 * separate from OPEN_KEY, since endOpenHoldPeriod() closes the period the
 * moment Reconnect begins. Lets the app resume correctly after a force-quit:
 * see docs/03-privacy-model.md for why this is stored at all.
 */
export async function beginReconnecting(periodId: string): Promise<void> {
  await SecureStore.setItemAsync(RECONNECTING_KEY, periodId);
}

/** The period currently being reconnected from, if any — read fresh, not from in-memory context. */
export async function getReconnectingPeriod(): Promise<HoldPeriod | null> {
  const periodId = await SecureStore.getItemAsync(RECONNECTING_KEY);
  if (!periodId) return null;

  return readRecord(periodId);
}

/**
 * Appends a Circle id to the currently-open period's "already sent a Taking
 * Time update" list — idempotent, no-ops if there's no open period. Reads
 * OPEN_KEY directly rather than taking a periodId, matching
 * recordPostSendChoices's pattern: this always operates on whichever period
 * is currently open, not a captured id from an earlier point.
 */
export async function markUpdateSent(circleId: string): Promise<void> {
  const openId = await SecureStore.getItemAsync(OPEN_KEY);
  if (!openId) return;

  const period = await readRecord(openId);
  if (!period) return;

  const existing = period.updateSentCircleIds ?? [];
  if (existing.includes(circleId)) return;

  await writeRecord({ ...period, updateSentCircleIds: [...existing, circleId] });
}

/** Appends a Circle id or ungrouped phone number to the period's contacted list — idempotent. */
export async function markReconnectContacted(periodId: string, contactedId: string): Promise<void> {
  const period = await readRecord(periodId);
  if (!period) return;

  const existing = period.reconnectContactedIds ?? [];
  if (existing.includes(contactedId)) return;

  await writeRecord({ ...period, reconnectContactedIds: [...existing, contactedId] });
}

/** Clears the reconnecting marker once Reconnect has genuinely finished. */
export async function endReconnecting(): Promise<void> {
  await SecureStore.deleteItemAsync(RECONNECTING_KEY);
}

export interface ReconnectCoverage {
  totalIds: string[];
  contactedIds: string[];
  complete: boolean;
}

/** Pure: whether every Circle/ungrouped person in the period's audience has been reached. */
export function getReconnectCoverage(period: HoldPeriod): ReconnectCoverage {
  const totalIds = [
    ...(period.audienceCircles ?? []).map((circle) => circle.circleId),
    ...(period.audienceUngrouped ?? []).map((contact) => contact.phoneNumber)
  ];
  const contactedIds = period.reconnectContactedIds ?? [];
  const complete = totalIds.length > 0 && totalIds.every((id) => contactedIds.includes(id));

  return { totalIds, contactedIds, complete };
}
