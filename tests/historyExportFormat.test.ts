import { describe, expect, it } from "vitest";
import { formatHistoryExportText } from "../src/utils/historyExportFormat";
import type { HoldPeriod } from "../src/types/hold";

function period(overrides: Partial<HoldPeriod> = {}): HoldPeriod {
  return {
    id: "p1",
    startedAt: Date.UTC(2026, 0, 1, 10, 0),
    endedAt: Date.UTC(2026, 0, 3, 10, 0),
    recipients: ["Alex"],
    ...overrides
  };
}

describe("formatHistoryExportText", () => {
  it("says so plainly when there's nothing to export", () => {
    const text = formatHistoryExportText([]);
    expect(text).toContain("No Hold periods yet.");
  });

  it("includes each period's recipients, dates, and duration", () => {
    const text = formatHistoryExportText([period()]);
    expect(text).toContain("Alex");
    expect(text).toContain("Started:");
    expect(text).toContain("Ended:");
    expect(text).toContain("Duration:");
  });

  it("marks a still-open period instead of computing a duration for it", () => {
    const text = formatHistoryExportText([period({ endedAt: null })]);
    expect(text).toContain("Still open");
    expect(text).not.toContain("Duration:");
  });

  it("lists distinct send channels once each, in a friendly form", () => {
    const text = formatHistoryExportText([
      period({ sendChannels: { "+1555": "sms", "+1556": "sms", "+1557": "whatsapp" } })
    ]);
    expect(text).toContain("Sent via: Text message, WhatsApp");
  });
});
