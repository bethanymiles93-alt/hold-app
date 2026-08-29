import { formatChannelLabel, formatDateTime, formatDuration } from "@/services/holdHistoryFormat";
import type { HoldPeriod } from "@/types/hold";

/**
 * Pure text formatting, kept separate from historyExportService.ts (which
 * imports expo-file-system/expo-sharing/expo-local-authentication) so this
 * is directly unit-testable — importing native Expo modules pulls in
 * react-native's own Flow-typed source, which vitest's SSR transform can't
 * parse. See tests/historyExportFormat.test.ts.
 */
export function formatHistoryExportText(periods: HoldPeriod[]): string {
  const lines: string[] = ["Your Hold History", `Exported ${formatDateTime(Date.now())}`, ""];

  if (periods.length === 0) {
    lines.push("No Hold periods yet.");
    return lines.join("\n");
  }

  for (const period of periods) {
    lines.push(`— ${period.recipients.join(", ")}`);
    lines.push(`Started: ${formatDateTime(period.startedAt)}`);
    lines.push(`Ended: ${period.endedAt ? formatDateTime(period.endedAt) : "Still open"}`);
    if (period.endedAt) lines.push(`Duration: ${formatDuration(period.endedAt - period.startedAt)}`);

    const channelLabels = Array.from(new Set(Object.values(period.sendChannels ?? {}).map(formatChannelLabel)));
    if (channelLabels.length > 0) lines.push(`Sent via: ${channelLabels.join(", ")}`);

    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
