import * as SecureStore from "expo-secure-store";

const RECORD_PREFIX = "hold.lastSentMessage.";

function recordKey(personId: string): string {
  return `${RECORD_PREFIX}${personId}`;
}

/**
 * The last message actually sent to one Conversations person — a single
 * overwritten string per person, permanent (no expiry), deliberately
 * separate from `replyStorageService.ts`'s own `StoredReply.draftReply`
 * (which is a temporary in-progress draft that auto-clears per
 * hold-book's own content-retention policy) and from Hold History (which
 * stays metadata-only — sendChannels/contactedIds/reachedVia, never
 * message content). Read-only, shown via a down-arrow reveal in
 * PersonaliseAccordion; insertable into a fresh reply via the same
 * green-highlight/whole-block-revert mechanic Template already uses, never
 * auto-inserted. See docs/09-decision-log.md, 2026-08-31.
 */
export async function getLastSentMessage(personId: string): Promise<string | null> {
  return SecureStore.getItemAsync(recordKey(personId));
}

export async function saveLastSentMessage(personId: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await SecureStore.setItemAsync(recordKey(personId), trimmed);
}

/**
 * No index of ids is kept (unlike replyStorageService's own INDEX_KEY) —
 * this is looked up one person at a time, on demand, when their own
 * accordion opens, never listed/enumerated anywhere. "Delete my data"
 * therefore can't iterate these directly; see conversationService.ts's
 * own deleteAllConversations for where person ids come from, and clear
 * each one's last-sent record alongside it there instead of duplicating
 * an id index solely for this deletion path.
 */
export async function deleteLastSentMessage(personId: string): Promise<void> {
  await SecureStore.deleteItemAsync(recordKey(personId));
}
