import type { StoredReply } from "@/types/hold";

export interface PartitionedReplies {
  active: StoredReply[];
  expired: StoredReply[];
}

/** A record survives as long as the user's own reply hasn't hit its backstop — losing the pasted message doesn't mean losing the reply. */
export function partitionActiveReplies(
  replies: StoredReply[],
  now: number
): PartitionedReplies {
  const active: StoredReply[] = [];
  const expired: StoredReply[] = [];

  for (const reply of replies) {
    if (reply.draftReplyExpiresAt <= now) {
      expired.push(reply);
    } else {
      active.push(reply);
    }
  }

  return { active, expired };
}

/**
 * How long before its own expiry a Conversations reply draft starts
 * offering the quiet heads-up — 24 hours, a reasonable reading of hold-book's
 * "while the app is open around that time" rather than an exact figure
 * given there. Not a countdown surfaced to the user — see needsHeadsUp.
 */
export const HEADS_UP_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Whether an active, unsent reply draft is due its one-time, quiet
 * "this draft has been open a while" heads-up — within HEADS_UP_WINDOW_MS
 * of its own expiry, not already shown once for this record, and not yet
 * sent (a sent record has nothing left to warn about). See hold-book
 * 06-privacy-security/04-content-retention.md, "Heads-up before auto-clear".
 */
export function needsHeadsUp(reply: StoredReply, now: number): boolean {
  if (reply.sentAt != null) return false;
  if (reply.headsUpShownAt != null) return false;
  return reply.draftReplyExpiresAt - now <= HEADS_UP_WINDOW_MS && reply.draftReplyExpiresAt > now;
}

