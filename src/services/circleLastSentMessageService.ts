import * as SecureStore from "expo-secure-store";

const RECORD_PREFIX = "hold.circleLastSentMessage.";

function recordKey(circleId: string): string {
  return `${RECORD_PREFIX}${circleId}`;
}

/**
 * The last message actually sent to one Circle — a single overwritten
 * string per Circle, permanent (no expiry), shown read-only inside that
 * Circle's own expanded dropdown on Going Quiet and Reconnect. Separate
 * from `lastSentMessageService.ts` (per-person, Conversations only) and
 * from History (metadata-only — channel/timestamp/recipient, never
 * message text; this service never touches it). See
 * docs/09-decision-log.md, 2026-08-31.
 */
export async function getCircleLastSentMessage(circleId: string): Promise<string | null> {
  return SecureStore.getItemAsync(recordKey(circleId));
}

export async function saveCircleLastSentMessage(circleId: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await SecureStore.setItemAsync(recordKey(circleId), trimmed);
}

export async function deleteCircleLastSentMessage(circleId: string): Promise<void> {
  await SecureStore.deleteItemAsync(recordKey(circleId));
}
