import { describe, expect, it } from "vitest";
import { partitionActiveReplies } from "../src/services/replyExpiry";
import type { StoredReply } from "../src/types/hold";

function reply(id: string, expiresAt: number): StoredReply {
  return {
    id,
    recipientName: "Sam",
    friendMessage: "hey, you around?",
    draftReply: "Thanks for your message.",
    windowHours: 8,
    createdAt: 0,
    expiresAt
  };
}

describe("partitionActiveReplies", () => {
  it("keeps replies whose window has not passed", () => {
    const { active, expired } = partitionActiveReplies(
      [reply("a", 2000)],
      1000
    );

    expect(active.map((r) => r.id)).toEqual(["a"]);
    expect(expired).toEqual([]);
  });

  it("expires replies at or past their window", () => {
    const { active, expired } = partitionActiveReplies(
      [reply("a", 1000)],
      1000
    );

    expect(active).toEqual([]);
    expect(expired.map((r) => r.id)).toEqual(["a"]);
  });

  it("tracks each reply independently", () => {
    const { active, expired } = partitionActiveReplies(
      [reply("expired", 500), reply("active", 5000)],
      1000
    );

    expect(active.map((r) => r.id)).toEqual(["active"]);
    expect(expired.map((r) => r.id)).toEqual(["expired"]);
  });
});
