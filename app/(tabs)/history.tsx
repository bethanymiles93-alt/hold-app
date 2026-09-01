import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { HistoryCalendar } from "@/components/HistoryCalendar";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { formatDateTime, formatDuration, summariseSendChannels } from "@/services/holdHistoryFormat";
import { deleteHoldPeriod, getHistory } from "@/services/holdHistoryService";
import { requestHistoryExport, type HistoryExportResult } from "@/services/historyExportService";
import type { HoldPeriod } from "@/types/hold";

const EXPORT_FAILURE_MESSAGES: Record<Exclude<HistoryExportResult, { ok: true }>["reason"], string> = {
  "auth-unavailable":
    "Face ID, Touch ID, or a device passcode needs to be set up to export your History.",
  "auth-failed": "Authentication failed. Please try again.",
  "auth-cancelled": "Export cancelled.",
  "sharing-unavailable": "Sharing isn't available on this device.",
  "no-cache-directory": "Couldn't prepare the export file. Please try again."
};

type Segment = "history" | "patterns";

/**
 * What the always-visible list is currently scoped to — driven entirely
 * by the calendar above it, not by scrolling. "month" covers both the
 * calendar's default landing month and any month reached via prev/next
 * or the month picker — all the same case, since the list just reflects
 * whichever month the calendar is currently showing. See
 * docs/09-decision-log.md, 2026-09-01.
 */
type ListFilter =
  | { type: "month"; monthStart: Date }
  | { type: "year"; year: number }
  | { type: "day"; dateKey: string; periods: HoldPeriod[] };

interface PeriodCardProps {
  period: HoldPeriod;
  onDelete: (id: string) => void;
}

function PeriodCard({ period, onDelete }: PeriodCardProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const channelLabels = summariseSendChannels(period.sendChannels);

  return (
    <View style={styles.item}>
      <Text style={styles.itemRecipients}>{period.recipients.join(", ")}</Text>
      <Text style={styles.itemMeta}>Started {formatDateTime(period.startedAt)}</Text>
      <Text style={styles.itemMeta}>
        Ended {period.endedAt ? formatDateTime(period.endedAt) : ""}
      </Text>
      {channelLabels.length > 0 ? (
        <Text style={styles.itemMeta}>Sent via {channelLabels.join(", ")}</Text>
      ) : null}
      <Text style={styles.itemDuration}>
        {period.endedAt ? formatDuration(period.endedAt - period.startedAt) : ""}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => onDelete(period.id)}
        style={styles.deleteButton}
      >
        <Text style={styles.deleteLabel}>Delete</Text>
      </Pressable>
    </View>
  );
}

export default function HoldHistoryScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [periods, setPeriods] = useState<HoldPeriod[]>([]);
  const [segment, setSegment] = useState<Segment>("history");

  // Calendar+list merge, 2026-09-01 (confirmed 30 August decision), then
  // corrected the same day: the calendar actively FILTERS the list, not
  // just scrolls/anchors to an entry within an unfiltered one. Whichever
  // month the calendar is currently showing (default, prev/next, or the
  // month picker — all the same case) filters the list to that month;
  // picking a year filters to that whole year; tapping a specific logged
  // day filters the list down to just that one entry, at the top. The
  // calendar is the list's only filter control now — there's no
  // "show all time" escape hatch left, since that doesn't have an
  // obvious place in a filter-driven model; flagged for confirmation
  // rather than silently kept or dropped. See docs/09-decision-log.md.
  const [listFilter, setListFilter] = useState<ListFilter>(() => {
    const now = new Date();
    return { type: "month", monthStart: new Date(now.getFullYear(), now.getMonth(), 1) };
  });

  const handleMonthChange = (monthStart: Date) => setListFilter({ type: "month", monthStart });
  const handleYearSelect = (year: number) => setListFilter({ type: "year", year });
  const handleSelectDate = (dateKey: string, matchingPeriods: HoldPeriod[]) => {
    if (matchingPeriods.length === 0) return;
    setListFilter({ type: "day", dateKey, periods: matchingPeriods });
  };

  const refresh = useCallback(async () => {
    setPeriods(await getHistory());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = async (id: string) => {
    await deleteHoldPeriod(id);
    setPeriods((current) => current.filter((period) => period.id !== id));
  };

  const exportHistory = async () => {
    const result = await requestHistoryExport(periods);
    if (!result.ok) {
      if (result.reason === "auth-cancelled") return;
      Alert.alert("Couldn't export History", EXPORT_FAILURE_MESSAGES[result.reason]);
    }
  };

  const filteredPeriods = (() => {
    if (listFilter.type === "day") return listFilter.periods;
    if (listFilter.type === "year") {
      return periods.filter((period) => new Date(period.startedAt).getFullYear() === listFilter.year);
    }
    const monthStart = listFilter.monthStart;
    const nextMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    return periods.filter(
      (period) => period.startedAt >= monthStart.getTime() && period.startedAt < nextMonthStart.getTime()
    );
  })();

  const closedPeriods = periods.filter((period) => period.endedAt !== null);
  const totalDurationMs = closedPeriods.reduce(
    (sum, period) => sum + (period.endedAt! - period.startedAt),
    0
  );
  const averageDurationMs = closedPeriods.length > 0 ? totalDurationMs / closedPeriods.length : null;
  const mostRecentEndedAt =
    closedPeriods.length > 0 ? Math.max(...closedPeriods.map((period) => period.endedAt!)) : null;

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.toggle}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setSegment("history")}
          style={[styles.toggleButton, segment === "history" && styles.toggleActive]}
        >
          <Text style={[styles.toggleLabel, segment === "history" && styles.toggleLabelActive]}>
            Your History
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setSegment("patterns")}
          style={[styles.toggleButton, segment === "patterns" && styles.toggleActive]}
        >
          <Text style={[styles.toggleLabel, segment === "patterns" && styles.toggleLabelActive]}>
            Your Patterns
          </Text>
        </Pressable>
      </View>

      {/* Eyebrow + title removed (2026-09-01) — both were redundant with
          the tab label directly above ("Your History"/"Your Patterns"
          already says what page this is), and the eyebrow was hardcoded
          "History" on both segments regardless, which was its own latent
          inconsistency. Body text kept. A dedicated subtitle under
          History's own tab ("evidence of your effort and care") is
          planned separately — wording not yet confirmed, not built here. */}
      {segment === "history" ? (
        <StepHeader body="Just the record: when, how long, and who you told. Nothing else." />
      ) : (
        <StepHeader body="What your quiet periods have looked like, in your own data. No comparisons, no judgment." />
      )}

      {segment === "history" ? (
        <>
          <HistoryCalendar
            periods={periods}
            onDelete={remove}
            onSelectDate={handleSelectDate}
            onMonthChange={handleMonthChange}
            onYearSelect={handleYearSelect}
            selectedDayKey={listFilter.type === "day" ? listFilter.dateKey : null}
          />

          {periods.length === 0 ? (
            <Text style={styles.empty}>No Hold periods yet.</Text>
          ) : filteredPeriods.length === 0 ? (
            <Text style={styles.empty}>Nothing here.</Text>
          ) : (
            <View style={styles.list}>
              {filteredPeriods.map((period) => (
                <PeriodCard key={period.id} period={period} onDelete={remove} />
              ))}
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Request History"
            onPress={() => void exportHistory()}
            style={({ pressed }) => [styles.exportRow, pressed && styles.exportRowPressed]}
          >
            <Text style={styles.exportRowText}>Request History</Text>
          </Pressable>
          <Text style={styles.exportRowNote}>
            A plain-text export of your full History, for your own records — confirmed with Face ID or your
            passcode, since this is the point it leaves your device.
          </Text>
        </>
      ) : (
        <View style={styles.patternsSection}>
          {periods.length === 0 ? (
            <Text style={styles.empty}>No Hold periods yet.</Text>
          ) : (
            <View style={styles.statsGrid}>
              <View style={styles.statTile}>
                <Text style={styles.statTileValue}>{periods.length}</Text>
                <Text style={styles.statTileLabel}>Quiet periods</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statTileValue}>
                  {averageDurationMs !== null ? formatDuration(averageDurationMs) : "—"}
                </Text>
                <Text style={styles.statTileLabel}>Average duration</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statTileValue}>
                  {mostRecentEndedAt !== null ? formatDuration(Date.now() - mostRecentEndedAt) : "—"}
                </Text>
                <Text style={styles.statTileLabel}>Time since last quiet period</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statTileValue}>{formatDuration(totalDurationMs)}</Text>
                <Text style={styles.statTileLabel}>Days spent Taking Time</Text>
              </View>
            </View>
          )}

          <View style={styles.exportNote}>
            <Text style={styles.exportNoteText}>
              Also available separately: a one-time formatted PDF report for your GP or
              therapist, no subscription needed — not open to purchase yet.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/settings/hold-plus")}
            style={({ pressed }) => [styles.holdPlusCard, pressed && styles.holdPlusCardPressed]}
          >
            <Text style={styles.holdPlusTitle}>More with Hold+</Text>
            <Text style={styles.holdPlusBody}>
              A multi-month view, seasonal and recurring-timing trends, how things change over
              time, and optional health-note correlations — here's more depth if it'd help you.
            </Text>
            <Text style={styles.holdPlusLink}>Learn more ›</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  content: {
    gap: theme.spacing.lg
  },
  toggle: {
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  toggleButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: colors.border
  },
  toggleActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceStrong
  },
  toggleLabel: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "600"
  },
  toggleLabelActive: {
    color: colors.text
  },
  empty: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24
  },
  list: {
    gap: theme.spacing.md
  },
  exportRow: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginTop: theme.spacing.sm
  },
  exportRowPressed: {
    opacity: 0.6
  },
  exportRowText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600"
  },
  exportRowNote: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  item: {
    gap: 2,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: theme.spacing.md
  },
  itemRecipients: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
    marginBottom: theme.spacing.xs
  },
  itemMeta: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  itemDuration: {
    color: colors.link,
    fontSize: 14,
    fontWeight: "600",
    marginTop: theme.spacing.xs
  },
  deleteButton: {
    alignSelf: "flex-start",
    marginTop: theme.spacing.sm,
    minHeight: 32,
    justifyContent: "center"
  },
  deleteLabel: {
    color: colors.error,
    fontSize: 14,
    fontWeight: "600"
  },
  patternsSection: {
    gap: theme.spacing.lg
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  statTile: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.xs
  },
  statTileValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700"
  },
  statTileLabel: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  exportNote: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: colors.border
  },
  exportNoteText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22
  },
  holdPlusCard: {
    borderRadius: theme.radius.md,
    backgroundColor: colors.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.xs
  },
  holdPlusCardPressed: {
    opacity: 0.7
  },
  holdPlusTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600"
  },
  holdPlusBody: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22
  },
  holdPlusLink: {
    color: colors.link,
    fontSize: 13,
    fontWeight: "600"
  }
  });
}
