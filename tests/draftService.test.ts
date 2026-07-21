import { describe, expect, it } from "vitest";
import { createLocalDraft } from "../src/services/draftService";

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
