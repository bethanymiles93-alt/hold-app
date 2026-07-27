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

/** Blanks a stale pasted-in message while leaving the user's own reply untouched. */
export function clearStaleFriendMessage(reply: StoredReply, now: number): StoredReply {
  if (reply.friendMessage === "" || reply.friendMessageExpiresAt > now) {
    return reply;
  }

  return { ...reply, friendMessage: "" };
}
