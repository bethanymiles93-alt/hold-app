import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  formatChannelLabel,
  formatDuration,
  getDayBands,
  summariseSendChannels
} from "../src/services/holdHistoryFormat";
import type { HoldPeriod } from "../src/types/hold";

function period(startedAt: number, endedAt: number | null): HoldPeriod {
  return { id: "id", recipients: ["Sam"], startedAt, endedAt };
}

describe("formatDuration", () => {
  it("formats minutes only", () => {
    expect(formatDuration(45 * 60000)).toBe("45m");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration((3 * 60 + 20) * 60000)).toBe("3h 20m");
  });

  it("drops minutes once days are involved", () => {
    expect(formatDuration((28 * 60) * 60000)).toBe("1d 4h");
  });

  it("floors at zero minutes for non-positive durations", () => {
    expect(formatDuration(0)).toBe("0m");
  });
});

describe("getDayBands", () => {
  // July 2026: the 1st is a Wednesday, so the grid's second row runs
  // Sun 5 -> Sat 11, and the third row Sun 12 -> Sat 18.
  const grid = buildMonthGrid(new Date(2026, 6, 1));

  it("rounds both edges of a single-day period", () => {
    const start = new Date(2026, 6, 21, 9, 0).getTime();
    const end = new Date(2026, 6, 21, 17, 0).getTime();

    const bands = getDayBands([period(start, end)], grid);

    expect(bands.get("2026-07-21")).toEqual({
      periodId: "id",
      roundStart: true,
      roundEnd: true
    });
    expect(bands.has("2026-07-20")).toBe(false);
    expect(bands.has("2026-07-22")).toBe(false);
  });

  it("joins consecutive days of a multi-day period within one row", () => {
    const start = new Date(2026, 6, 7, 22, 0).getTime();
    const end = new Date(2026, 6, 9, 6, 0).getTime();

    const bands = getDayBands([period(start, end)], grid);

    expect(bands.get("2026-07-07")).toEqual({
      periodId: "id",
      roundStart: true,
      roundEnd: false
    });
    expect(bands.get("2026-07-08")).toEqual({
      periodId: "id",
      roundStart: false,
      roundEnd: false
    });
    expect(bands.get("2026-07-09")).toEqual({
      periodId: "id",
      roundStart: false,
      roundEnd: true
    });
  });

  it("starts a fresh rounded segment on each row for a period spanning a week boundary", () => {
    const start = new Date(2026, 6, 10).getTime();
    const end = new Date(2026, 6, 13).getTime();

    const bands = getDayBands([period(start, end)], grid);

    // Row 1 (Sun 5 - Sat 11): Fri 10 - Sat 11
    expect(bands.get("2026-07-10")).toEqual({
      periodId: "id",
      roundStart: true,
      roundEnd: false
    });
    expect(bands.get("2026-07-11")).toEqual({
      periodId: "id",
      roundStart: false,
      roundEnd: true
    });

    // Row 2 (Sun 12 - Sat 18): Sun 12 - Mon 13, a fresh segment
    expect(bands.get("2026-07-12")).toEqual({
      periodId: "id",
      roundStart: true,
      roundEnd: false
    });
    expect(bands.get("2026-07-13")).toEqual({
      periodId: "id",
      roundStart: false,
      roundEnd: true
    });
  });

  it("excludes still-open periods", () => {
    const start = new Date(2026, 6, 21).getTime();

    expect(getDayBands([period(start, null)], grid).size).toBe(0);
  });
});

describe("formatChannelLabel", () => {
  it("labels a plain SMS send", () => {
    expect(formatChannelLabel("sms")).toBe("Text message");
  });

  it("labels a generic share with no known activity type", () => {
    expect(formatChannelLabel("shared")).toBe("Shared");
    expect(formatChannelLabel("shared:com.example.unknown")).toBe("Shared");
  });

  it("labels a known iOS share activity type", () => {
    expect(formatChannelLabel("shared:net.whatsapp.WhatsApp.ShareExtension")).toBe("WhatsApp");
    expect(formatChannelLabel("shared:com.apple.UIKit.activity.CopyToPasteboard")).toBe("Copied");
  });
});

describe("summariseSendChannels", () => {
  it("returns an empty list when nothing is recorded", () => {
    expect(summariseSendChannels(undefined)).toEqual([]);
  });

  it("dedupes to distinct labels in first-seen order", () => {
    const channels = {
      circleA: "sms",
      circleB: "shared:net.whatsapp.WhatsApp.ShareExtension",
      "+1555": "sms"
    };

    expect(summariseSendChannels(channels)).toEqual(["Text message", "WhatsApp"]);
  });
});
