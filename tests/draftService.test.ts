import { describe, expect, it } from "vitest";
import { createDraft, createLocalDraft, createLocalReplyDraft, createReplyDraft } from "../src/services/draftService";

describe("createLocalDraft", () => {
  it("creates a hold draft without requiring a diagnosis", () => {
    const message = createLocalDraft({
      mode: "hold",
      recipients: ["Sam"],
      intent: "quiet"
    });

    expect(message).toContain("quiet");
    expect(message).toContain("isn’t about you");
  });

  it("creates a gentle return draft", () => {
    const message = createLocalDraft({
      mode: "return",
      recipients: ["Sam"],
      returnStyle: "open-door"
    });

    expect(message).toContain("starting to resurface");
  });

  it("returns a blank draft for custom writing", () => {
    expect(
      createLocalDraft({
        mode: "hold",
        recipients: ["Sam"],
        intent: "custom"
      })
    ).toBe("");
  });
});

describe("createLocalReplyDraft", () => {
  it("creates a reply that acknowledges the other person's message", () => {
    expect(createLocalReplyDraft("open-door")).toContain("Thanks for your message");
  });

  it("returns a blank draft for custom writing", () => {
    expect(createLocalReplyDraft("custom")).toBe("");
  });
});

describe("createDraft / createReplyDraft — non-AI route stays available", () => {
  // No EXPO_PUBLIC_AI_PROXY_URL/EXPO_PUBLIC_AI_CLIENT_KEY are set in this test
  // environment, so the AI proxy is unconfigured — these confirm the local
  // template fallback actually fires rather than throwing, per the
  // "non-AI route remaining available" requirement this replaces.
  it("falls back to the local hold draft when the AI proxy isn't configured", async () => {
    const message = await createDraft({ mode: "hold", recipients: ["Sam"], intent: "quiet" });
    expect(message).toBe(createLocalDraft({ mode: "hold", recipients: ["Sam"], intent: "quiet" }));
  });

  it("falls back to the local reply draft when the AI proxy isn't configured", async () => {
    const message = await createReplyDraft("open-door");
    expect(message).toBe(createLocalReplyDraft("open-door"));
  });
});
