import type { StoredReply } from "@/types/hold";

export interface PartitionedReplies {
  active: StoredReply[];
  expired: StoredReply[];
}

export function partitionActiveReplies(
  replies: StoredReply[],
  now: number
): PartitionedReplies {
  const active: StoredReply[] = [];
  const expired: StoredReply[] = [];

  for (const reply of replies) {
    if (reply.expiresAt <= now) {
      expired.push(reply);
    } else {
      active.push(reply);
    }
  }

  return { active, expired };
}
