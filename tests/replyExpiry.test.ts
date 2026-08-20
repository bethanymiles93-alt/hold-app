import { describe, expect, it } from "vitest";
import { HEADS_UP_WINDOW_MS, needsHeadsUp, partitionActiveReplies } from "../src/services/replyExpiry";
import type { StoredReply } from "../src/types/hold";

function reply(id: string, draftReplyExpiresAt: number, overrides: Partial<StoredReply> = {}): StoredReply {
  return {
    id,
    recipientName: "Sam",
    friendMessage: "hey, you around?",
    friendMessageExpiresAt: draftReplyExpiresAt,
    draftReply: "Thanks for your message.",
    draftReplyExpiresAt,
    createdAt: 0,
    ...overrides
  };
}

describe("partitionActiveReplies", () => {
  it("keeps replies whose draft-reply backstop has not passed", () => {
    const { active, expired } = partitionActiveReplies([reply("a", 2000)], 1000);

    expect(active.map((r) => r.id)).toEqual(["a"]);
    expect(expired).toEqual([]);
  });

  it("expires replies at or past their draft-reply backstop", () => {
    const { active, expired } = partitionActiveReplies([reply("a", 1000)], 1000);

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

  it("friendMessage and draftReply share one expiry — a record is active or expired as a whole, not per field", () => {
    const { active, expired } = partitionActiveReplies([reply("a", 5000)], 1000);

    expect(active.map((r) => r.id)).toEqual(["a"]);
    expect(active.find((r) => r.id === "a")?.friendMessage).toBe("hey, you around?");
    expect(expired).toEqual([]);
  });
});

describe("needsHeadsUp", () => {
  it("is false well before the heads-up window", () => {
    const now = 0;
    const draftReplyExpiresAt = HEADS_UP_WINDOW_MS * 3;
    expect(needsHeadsUp(reply("a", draftReplyExpiresAt), now)).toBe(false);
  });

  it("is true once within the heads-up window but not yet expired", () => {
    const now = 0;
    const draftReplyExpiresAt = HEADS_UP_WINDOW_MS - 1;
    expect(needsHeadsUp(reply("a", draftReplyExpiresAt), now)).toBe(true);
  });

  it("is false once already expired", () => {
    const now = 1000;
    expect(needsHeadsUp(reply("a", 1000), now)).toBe(false);
  });

  it("is false once already shown for this record", () => {
    const now = 0;
    const draftReplyExpiresAt = HEADS_UP_WINDOW_MS - 1;
    expect(needsHeadsUp(reply("a", draftReplyExpiresAt, { headsUpShownAt: now }), now)).toBe(false);
  });

  it("is false for an already-sent reply — nothing left to warn about", () => {
    const now = 0;
    const draftReplyExpiresAt = HEADS_UP_WINDOW_MS - 1;
    expect(needsHeadsUp(reply("a", draftReplyExpiresAt, { sentAt: now }), now)).toBe(false);
  });
});
