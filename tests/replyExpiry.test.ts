import { describe, expect, it } from "vitest";
import { clearStaleFriendMessage, partitionActiveReplies } from "../src/services/replyExpiry";
import type { StoredReply } from "../src/types/hold";

function reply(
  id: string,
  draftReplyExpiresAt: number,
  friendMessageExpiresAt: number = draftReplyExpiresAt
): StoredReply {
  return {
    id,
    recipientName: "Sam",
    friendMessage: "hey, you around?",
    friendMessageExpiresAt,
    draftReply: "Thanks for your message.",
    draftReplyExpiresAt,
    createdAt: 0
  };
}

describe("partitionActiveReplies", () => {
  it("keeps replies whose draft-reply backstop has not passed", () => {
    const { active, expired } = partitionActiveReplies(
      [reply("a", 2000)],
      1000
    );

    expect(active.map((r) => r.id)).toEqual(["a"]);
    expect(expired).toEqual([]);
  });

  it("expires replies at or past their draft-reply backstop", () => {
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

  it("keeps a reply active on its draft-reply timer even once its shorter friend-message window has passed", () => {
    const { active, expired } = partitionActiveReplies(
      [reply("a", 5000, 500)],
      1000
    );

    expect(active.map((r) => r.id)).toEqual(["a"]);
    expect(expired).toEqual([]);
  });
});

describe("clearStaleFriendMessage", () => {
  it("leaves the friend message untouched before its window passes", () => {
    const cleared = clearStaleFriendMessage(reply("a", 5000, 2000), 1000);
    expect(cleared.friendMessage).toBe("hey, you around?");
  });

  it("blanks the friend message once its window has passed, leaving the draft reply intact", () => {
    const cleared = clearStaleFriendMessage(reply("a", 5000, 500), 1000);
    expect(cleared.friendMessage).toBe("");
    expect(cleared.draftReply).toBe("Thanks for your message.");
  });

  it("is a no-op once the friend message is already blank", () => {
    const original = { ...reply("a", 5000, 500), friendMessage: "" };
    const cleared = clearStaleFriendMessage(original, 1000);
    expect(cleared).toBe(original);
  });
});
