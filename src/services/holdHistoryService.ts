import * as SecureStore from "expo-secure-store";
import { initialsPlaceholderName, PENDING_CIRCLE_ID_PREFIX } from "@/services/circleService";
import type { AudienceCircle, HoldPeriod, ReachedVia, ReconnectStep } from "@/types/hold";

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
 * Appends a whole Circle to the currently-open period's tracked audience —
 * the "Add to Going Quiet" drawer's send-time counterpart to `addToAudience`
 * above, for a Circle rather than an ungrouped contact (2026-08-13: every
 * person added via this specific flow becomes their own Circle of one, not
 * an ungrouped entry, matching Going Quiet's own "+ New Circle" convention
 * — a deliberate change for this one flow; `addToAudience` and
 * `addToReconnectingAudience` are untouched and still add ungrouped,
 * flagged as a real inconsistency rather than silently also changed). A
 * no-op if there's no open period, or if this exact Circle id is already
 * present (re-sending to an already-added Circle shouldn't duplicate it).
 * See docs/09-decision-log.md.
 */
export async function addCircleToAudience(circle: AudienceCircle): Promise<void> {
  const openId = await SecureStore.getItemAsync(OPEN_KEY);
  if (!openId) return;

  const period = await readRecord(openId);
  if (!period) return;

  const circles = period.audienceCircles ?? [];
  if (circles.some((existing) => existing.circleId === circle.circleId)) return;

  await writeRecord({
    ...period,
    recipients: [...period.recipients, ...circle.contacts.map((contact) => contact.name)],
    audienceCircles: [...circles, circle]
  });
}

/**
 * Adds someone new to a specific period's audience mid-Reconnect, as their
 * own provisional Circle-of-one — the Reconnect-screen equivalent of
 * `addToAudience` above, which only ever targets the currently-OPEN period
 * and so can't be reused here: by the time someone's on the Reconnect
 * screen, that period is no longer open (`beginReconnecting` has already
 * fired). Takes the period id directly rather than re-deriving it from a
 * marker, since the caller already has it.
 *
 * **Changed 2026-08-20**, closing a previously-flagged inconsistency: this
 * used to add the contact ungrouped (`audienceUngrouped`), the one place
 * in the app that didn't follow the confirmed Circle-of-one convention
 * (see docs/09-decision-log.md, 2026-08-13). Now reuses the same
 * `PENDING_CIRCLE_ID_PREFIX` provisional-Circle convention Going Quiet's
 * own bundling already uses, since this person genuinely wasn't part of
 * the original Going Quiet audience and callers need a stable way to
 * identify that (their circle's own distinct visual treatment, and a
 * dedicated apology-wording suggestion — neither is meaningful for a
 * plain ungrouped contact with no Circle to mark).
 */
export async function addToReconnectingAudience(
  periodId: string,
  contact: { name: string; phoneNumber: string }
): Promise<void> {
  const period = await readRecord(periodId);
  if (!period) return;

  const circles = period.audienceCircles ?? [];
  const ungrouped = period.audienceUngrouped ?? [];
  const alreadyPresent =
    circles.some((circle) => circle.contacts.some((existing) => existing.phoneNumber === contact.phoneNumber)) ||
    ungrouped.some((existing) => existing.phoneNumber === contact.phoneNumber);
  if (alreadyPresent) return;

  const newCircle: AudienceCircle = {
    circleId: `${PENDING_CIRCLE_ID_PREFIX}${Date.now()}`,
    circleName: initialsPlaceholderName([contact]),
    contacts: [contact]
  };

  await writeRecord({ ...period, audienceCircles: [...circles, newCircle] });
}

/**
 * Bundles one or more currently-excluded people (by phone number, not
 * name — matching how ConversationPerson and everything else in Reconnect
 * is already keyed) into ONE new provisional Circle, mirroring Going
 * Quiet's own `bundleIntoNewCircle` — a lighter-capacity alternative to
 * Reconnect's own auto-spin-into-Circle-of-one, since someone with more
 * capacity mid-Reconnect may want to group several excluded people into
 * one shared instant message rather than handling them one at a time
 * (2026-08-20, corrects an earlier "automatic Circle-of-one on unselect"
 * instruction that was reversed before being built). Removes each bundled
 * contact from wherever they currently live (an existing Circle's
 * `contacts`, or `audienceUngrouped`) so they aren't double-counted, then
 * adds the new Circle. A no-op for any phone number not actually found in
 * the current audience.
 */
export async function bundleIntoReconnectCircle(periodId: string, phoneNumbers: string[]): Promise<void> {
  const period = await readRecord(periodId);
  if (!period) return;

  const targetSet = new Set(phoneNumbers);
  const bundled: { name: string; phoneNumber: string }[] = [];

  const remainingCircles = (period.audienceCircles ?? [])
    .map((circle) => {
      const [keep, remove] = circle.contacts.reduce<[AudienceCircle["contacts"], AudienceCircle["contacts"]]>(
        ([keep, remove], contact) => {
          if (targetSet.has(contact.phoneNumber)) {
            remove.push(contact);
          } else {
            keep.push(contact);
          }
          return [keep, remove];
        },
        [[], []]
      );
      bundled.push(...remove);
      return { ...circle, contacts: keep };
    })
    .filter((circle) => circle.contacts.length > 0);

  const remainingUngrouped = (period.audienceUngrouped ?? []).filter((contact) => {
    if (!targetSet.has(contact.phoneNumber)) return true;
    bundled.push(contact);
    return false;
  });

  if (bundled.length === 0) return;

  const newCircle: AudienceCircle = {
    circleId: `${PENDING_CIRCLE_ID_PREFIX}${Date.now()}`,
    circleName: initialsPlaceholderName(bundled),
    contacts: bundled
  };

  await writeRecord({
    ...period,
    audienceCircles: [...remainingCircles, newCircle],
    audienceUngrouped: remainingUngrouped
  });
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
 * Re-syncs the still-open period's audience to the current, full selection —
 * called at "Done", after every Send for this session has already happened.
 * audienceCircles is otherwise only ever set once, at the very first Send
 * (via startHoldPeriod): a Circle created or added to the selection AFTER
 * that first Send, with no further Send afterward, would otherwise never
 * appear in audienceCircles at all — silently dropping that person from
 * Reconnect's coverage entirely, with no "add permanently?" prompt and no
 * other signal anywhere that they need following up on. Safe to call
 * whether or not a period is open (no-ops if not) — Going Quiet can be left
 * without ever sending.
 */
export async function syncAudience(input: StartHoldPeriodInput): Promise<void> {
  const openId = await SecureStore.getItemAsync(OPEN_KEY);
  if (!openId) return;

  const period = await readRecord(openId);
  if (!period) return;

  await writeRecord({ ...period, recipients: input.recipients, audienceCircles: input.audienceCircles });
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

/**
 * Marks a pending (Going-Quiet-created, not-yet-real) Circle's "add
 * permanently?" prompt as resolved — Yes or Not now, both idempotent — so a
 * later Reconnect visit (possibly after a force-quit) doesn't re-ask. Takes
 * an explicit periodId rather than reading OPEN_KEY, since this prompt fires
 * at Reconnect, after the period has already closed.
 */
export async function markPendingCircleResolved(periodId: string, circleId: string): Promise<void> {
  const period = await readRecord(periodId);
  if (!period) return;

  const existing = period.resolvedPendingCircleIds ?? [];
  if (existing.includes(circleId)) return;

  await writeRecord({ ...period, resolvedPendingCircleIds: [...existing, circleId] });
}

/**
 * Swaps a still-pending audienceCircles entry for the now-real Circle it
 * became (2026-08-13) — a bundled ad-hoc Circle is made real automatically,
 * as soon as Reconnect loads, not behind a yes/no tap any more; this keeps
 * the period's own record of it (its circleId, and its name once renamed)
 * in sync with the real, persisted Circle going forward. Coverage tracking
 * itself is untouched by this — it's keyed by phone number, not circleId,
 * so the swap is purely a display-consistency fix, not a data-integrity
 * one. Also marks it resolved in the same write, so refresh() doesn't
 * reprocess it. See docs/09-decision-log.md.
 */
export async function resolvePendingCircleInPeriod(
  periodId: string,
  tempCircleId: string,
  realCircle: { circleId: string; circleName: string }
): Promise<void> {
  const period = await readRecord(periodId);
  if (!period) return;

  const audienceCircles = (period.audienceCircles ?? []).map((circle) =>
    circle.circleId === tempCircleId
      ? { ...circle, circleId: realCircle.circleId, circleName: realCircle.circleName }
      : circle
  );
  const resolved = period.resolvedPendingCircleIds ?? [];

  await writeRecord({
    ...period,
    audienceCircles,
    resolvedPendingCircleIds: resolved.includes(tempCircleId) ? resolved : [...resolved, tempCircleId]
  });
}

/** Syncs a Circle's current name into this period's own audienceCircles snapshot — used after a rename, so the current Reconnect session's display updates without needing a fresh visit. */
export async function renameCircleInPeriod(periodId: string, circleId: string, circleName: string): Promise<void> {
  const period = await readRecord(periodId);
  if (!period) return;

  const audienceCircles = (period.audienceCircles ?? []).map((circle) =>
    circle.circleId === circleId ? { ...circle, circleName } : circle
  );

  await writeRecord({ ...period, audienceCircles });
}

/**
 * Appends a phone number to the period's contacted list — idempotent.
 * Per-PERSON now, not per-Circle (2026-08-13, corrects the granularity
 * this was built at): coverage/completion is derived from every individual
 * circle member being reached, not the Circle as a whole, since Reconnect's
 * pill-selection model can send to a subset of a Circle's members. A
 * phone number is the one id every recipient already has, grouped or not
 * — using it uniformly here avoids needing a second id scheme just for
 * circle members. See docs/09-decision-log.md, 2026-08-13.
 */
export async function markReconnectContacted(periodId: string, phoneNumber: string): Promise<void> {
  const period = await readRecord(periodId);
  if (!period) return;

  const existing = period.reconnectContactedIds ?? [];
  if (existing.includes(phoneNumber)) return;

  await writeRecord({ ...period, reconnectContactedIds: [...existing, phoneNumber] });
}

/**
 * Records that a Reconnect step was reached this period — idempotent,
 * takes an explicit periodId (this fires from both the instant-message
 * send and, separately, a Personalise reply completing, potentially well
 * after the period's own OPEN_KEY has moved on). Written the moment each
 * step happens, not only summarised once at the end, so a force-quit
 * mid-flow doesn't lose it. Reconnect History stays one entry per Hold
 * period — this only ever appends to that same period's own record, never
 * creates a second one. See docs/09-decision-log.md, 2026-08-19.
 */
export async function recordReconnectStepReached(periodId: string, step: ReconnectStep): Promise<void> {
  const period = await readRecord(periodId);
  if (!period) return;

  const existing = period.reconnectStepsReached ?? [];
  if (existing.includes(step)) return;

  await writeRecord({ ...period, reconnectStepsReached: [...existing, step] });
}

/**
 * Records how a specific person was reached this session — see
 * `ReachedVia` for the full set and what writes each value. Layered
 * alongside `reconnectContactedIds` (untouched, still the sole source the
 * completion gate reads) rather than replacing it. Overwrites any existing
 * entry for this phone number — the most recent "how" wins, e.g. if
 * someone marked without a send later gets a real send too.
 */
export async function recordReachedVia(periodId: string, phoneNumber: string, via: ReachedVia): Promise<void> {
  const period = await readRecord(periodId);
  if (!period) return;

  const existing = period.reconnectReachedVia ?? {};
  await writeRecord({
    ...period,
    reconnectReachedVia: { ...existing, [phoneNumber]: { at: Date.now(), via } }
  });
}

/**
 * Clears a previously-recorded reachedVia entry — un-marking "Conversation
 * complete" should retract a `marked_elsewhere` write, not leave a stale
 * record of something no longer true. See docs/09-decision-log.md, 2026-08-20.
 */
export async function clearReachedVia(periodId: string, phoneNumber: string): Promise<void> {
  const period = await readRecord(periodId);
  if (!period) return;

  const existing = period.reconnectReachedVia ?? {};
  if (!(phoneNumber in existing)) return;

  const next = { ...existing };
  delete next[phoneNumber];
  await writeRecord({ ...period, reconnectReachedVia: next });
}

/**
 * "I've already told them" — Reconnect-only, satisfies the same completion
 * gate a real send does (appends to `reconnectContactedIds`, exactly like
 * `markReconnectContacted`), but records `"marked_no_send"` as how, not
 * "sent" — distinct code path from Conversations' own "Conversation
 * complete" (`recordReachedVia` directly, gated on an active session, see
 * `markConversationComplete` in library.tsx). See docs/09-decision-log.md,
 * 2026-08-20.
 */
export async function markReconnectCoveredWithoutSend(periodId: string, phoneNumber: string): Promise<void> {
  const period = await readRecord(periodId);
  if (!period) return;

  const existing = period.reconnectContactedIds ?? [];
  const contactedIds = existing.includes(phoneNumber) ? existing : [...existing, phoneNumber];
  const reachedVia = period.reconnectReachedVia ?? {};

  await writeRecord({
    ...period,
    reconnectContactedIds: contactedIds,
    reconnectReachedVia: { ...reachedVia, [phoneNumber]: { at: Date.now(), via: "marked_no_send" } }
  });
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

/**
 * Pure: whether every individual recipient in the period's audience has
 * been reached — per-person granularity throughout (phone numbers), not
 * per-Circle, since a Circle can now be partially reached (some members
 * messaged, some not) under Reconnect's per-person pill selection. A
 * person appearing in more than one Circle (or a Circle and the ungrouped
 * list) is naturally deduped by `totalIds.every`, which only needs their
 * number present once, not counted per appearance. See
 * docs/09-decision-log.md, 2026-08-13.
 */
export function getReconnectCoverage(period: HoldPeriod): ReconnectCoverage {
  const totalIds = [
    ...(period.audienceCircles ?? []).flatMap((circle) => circle.contacts.map((contact) => contact.phoneNumber)),
    ...(period.audienceUngrouped ?? []).map((contact) => contact.phoneNumber)
  ];
  const contactedIds = period.reconnectContactedIds ?? [];
  const complete = totalIds.length > 0 && totalIds.every((id) => contactedIds.includes(id));

  return { totalIds, contactedIds, complete };
}
