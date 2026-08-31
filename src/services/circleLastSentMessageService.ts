import * as SecureStore from "expo-secure-store";
import { combinationKey } from "@/services/templateService";

const RECORD_PREFIX = "hold.circleLastSentMessage.";

function recordKey(circleIds: string[]): string {
  return `${RECORD_PREFIX}${combinationKey(circleIds)}`;
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
 * Permanent (no expiry), no index kept — looked up on demand for a
 * known set of ids when a dropdown opens, never enumerated, same
 * reasoning as `lastSentMessageService.ts`'s own per-person store.
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
  await SecureStore.setItemAsync(recordKey(circleIds), trimmed);
}

export async function deleteCircleLastSentMessage(circleIds: string[]): Promise<void> {
  if (circleIds.length === 0) return;
  await SecureStore.deleteItemAsync(recordKey(circleIds));
}
