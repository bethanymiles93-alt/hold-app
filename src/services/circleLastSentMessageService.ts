import * as SecureStore from "expo-secure-store";
import { combinationKey } from "@/services/templateService";

const RECORD_PREFIX = "hold.circleLastSentMessage.";
const INDEX_KEY = "hold.circleLastSentMessage.index";

function recordKey(circleIds: string[]): string {
  return `${RECORD_PREFIX}${combinationKey(circleIds)}`;
}

async function readIndex(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

async function writeIndex(keys: string[]): Promise<void> {
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(keys));
}

/**
 * The last message actually sent to a given SET of Circles together —
 * keyed by the exact combination sent to, reusing the same
 * `combinationKey()` templateService.ts already established (sorted,
 * "_"-joined), not a separate scheme invented for this feature.
 *
 * **Corrected 2026-08-31, same day as the original build**: it was
 * first shipped keyed per single circleId, storing one record per
 * Circle that *received* a send — which meant a Circle sent to only as
 * part of a larger group (Close+Friends) would show that group's
 * message inside its own, single-Circle dropdown, even though Close
 * alone was never actually sent that text. `combinationKey()` for a
 * one-element array degenerates to that circleId alone, so a single
 * Circle's own dropdown (which always looks up `[thatCircleId]`) now
 * only ever matches a send that went to that Circle **and no one
 * else** — exact-set match only, never a partial/fuzzy one. If "Close
 * alone" has never been sent as its own send, Close's dropdown shows
 * nothing, not the Close+Friends message. Multi-Circle combinations
 * are still written on every send (forward-compatible with any future
 * "last sent to this combination" surface) but nothing reads a
 * multi-Circle key back today — no dropdown currently represents more
 * than one Circle at a time.
 *
 * Permanent (no expiry). `get`/individual `delete` stay pure on-demand
 * lookups by known ids, same reasoning as `lastSentMessageService.ts`'s
 * own per-person store — no index needed for that. **A light index was
 * added 2026-08-31**, purely so "Delete my data" can actually enumerate
 * and clear this store — found missing in an overnight sweep: real
 * message content that survived a full data wipe. The index only ever
 * grows a key on save and is wiped wholesale by
 * `deleteAllCircleLastSentMessages`, never read for anything else.
 * Separate from History (metadata-only, never message text; untouched
 * by this service). See docs/09-decision-log.md.
 */
export async function getCircleLastSentMessage(circleIds: string[]): Promise<string | null> {
  if (circleIds.length === 0) return null;
  return SecureStore.getItemAsync(recordKey(circleIds));
}

export async function saveCircleLastSentMessage(circleIds: string[], text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed || circleIds.length === 0) return;
  const key = recordKey(circleIds);
  await SecureStore.setItemAsync(key, trimmed);

  const index = await readIndex();
  if (!index.includes(key)) {
    await writeIndex([...index, key]);
  }
}

export async function deleteCircleLastSentMessage(circleIds: string[]): Promise<void> {
  if (circleIds.length === 0) return;
  const key = recordKey(circleIds);
  await SecureStore.deleteItemAsync(key);
  const index = await readIndex();
  if (index.includes(key)) {
    await writeIndex(index.filter((existing) => existing !== key));
  }
}

/** Wipes every recorded circle-combination last-sent message — the "Delete my data" path. */
export async function deleteAllCircleLastSentMessages(): Promise<void> {
  const index = await readIndex();
  await Promise.all(index.map((key) => SecureStore.deleteItemAsync(key)));
  await SecureStore.deleteItemAsync(INDEX_KEY);
}
