import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { HistoryCalendar } from "@/components/HistoryCalendar";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { isHoldPlusActive } from "@/services/holdPlusService";
import {
  buildMonthGrid,
  formatDateTime,
  formatDuration,
  getDayBands,
  summariseSendChannels
} from "@/services/holdHistoryFormat";
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

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_ABBREVIATIONS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function dateKeyOf(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface PeriodCardProps {
  period: HoldPeriod;
  onDelete: (id: string) => void;
  /** Briefly borders this card in the accent colour — set when the calendar strip jumps the list here on a day-tap, so the destination is visually obvious, not just scrolled-to silently. */
  highlighted?: boolean;
}

function PeriodCard({ period, onDelete, highlighted = false }: PeriodCardProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const channelLabels = summariseSendChannels(period.sendChannels);

  return (
    <View style={[styles.item, highlighted && styles.itemHighlighted]}>
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

interface MonthCalendarViewProps {
  periods: HoldPeriod[];
  onDelete: (id: string) => void;
}

/**
 * A month grid with quiet days marked, tap a day for its period(s) — its
 * own independent month/selection state. **Hold+ gate, built 2026-08-31
 * alongside this interactivity, not before**: free tier is locked to the
 * current month (matching "one month at a time in Patterns, full history
 * in Hold+" — `07-business/02-pricing-principles.md`). Confirmed before
 * building that no such gate existed in this file at all — prev/next
 * previously navigated freely for every user. Month/year tap-to-pick
 * mirrors `HistoryCalendar.tsx`'s own pattern (that component was itself
 * forked from this one) but deliberately skips its year-list/expand-all
 * sub-feature — not requested for Patterns, and multi-month browsing is
 * exactly what free tier must not get anyway. Free-tier taps on any
 * navigation control (prev/next, month, year) go to the Hold+ screen
 * rather than silently doing nothing — an honest locked control, not a
 * dead one. Tap-a-day always works regardless of tier; it never leaves
 * the current month. See docs/09-decision-log.md.
 */
function MonthCalendarView({ periods, onDelete }: MonthCalendarViewProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [openPicker, setOpenPicker] = useState<"month" | "year" | null>(null);
  const [holdPlus, setHoldPlus] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void isHoldPlusActive().then(setHoldPlus);
    }, [])
  );

  const grid = buildMonthGrid(monthStart);
  const dayBands = getDayBands(periods, grid);
  const monthName = new Intl.DateTimeFormat(undefined, { month: "long" }).format(monthStart);
  const year = monthStart.getFullYear();

  const selectedDayPeriods = selectedDayKey
    ? periods.filter((period) => {
        if (period.endedAt === null) return false;
        const cursor = new Date(period.startedAt);
        cursor.setHours(0, 0, 0, 0);
        const end = new Date(period.endedAt);
        end.setHours(0, 0, 0, 0);
        while (cursor.getTime() <= end.getTime()) {
          if (dateKeyOf(cursor) === selectedDayKey) return true;
          cursor.setDate(cursor.getDate() + 1);
        }
        return false;
      })
    : [];

  const earliestYear = periods.reduce((earliest, period) => {
    const started = new Date(period.startedAt).getFullYear();
    return started < earliest ? started : earliest;
  }, new Date().getFullYear());
  const pickableYears: number[] = [];
  for (let candidate = new Date().getFullYear(); candidate >= earliestYear; candidate -= 1) {
    pickableYears.push(candidate);
  }

  const goToPreviousMonth = () => {
    setMonthStart((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };
  const goToNextMonth = () => {
    setMonthStart((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };
  const toggleMonthPicker = () => {
    setOpenPicker((current) => (current === "month" ? null : "month"));
  };
  const toggleYearPicker = () => {
    setOpenPicker((current) => (current === "year" ? null : "year"));
  };
  const pickMonth = (monthIndex: number) => {
    setMonthStart(new Date(year, monthIndex, 1));
    setOpenPicker(null);
  };
  const pickYear = (pickedYear: number) => {
    setMonthStart(new Date(pickedYear, monthStart.getMonth(), 1));
    setOpenPicker(null);
  };

  return (
    <View>
      <View style={styles.monthRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          accessibilityState={{ disabled: !holdPlus }}
          disabled={!holdPlus}
          onPress={goToPreviousMonth}
        >
          <Text style={[styles.monthNav, !holdPlus && styles.monthNavLocked]}>‹</Text>
        </Pressable>
        <View style={styles.monthLabelRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={holdPlus ? `Change month, currently ${monthName}` : monthName}
            accessibilityState={{ disabled: !holdPlus }}
            disabled={!holdPlus}
            onPress={toggleMonthPicker}
          >
            <Text style={styles.monthLabel}>{monthName}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={holdPlus ? `Change year, currently ${year}` : String(year)}
            accessibilityState={{ disabled: !holdPlus }}
            disabled={!holdPlus}
            onPress={toggleYearPicker}
          >
            <Text style={styles.monthLabel}>{year}</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: !holdPlus }}
          disabled={!holdPlus}
          onPress={goToNextMonth}
        >
          <Text style={[styles.monthNav, !holdPlus && styles.monthNavLocked]}>›</Text>
        </Pressable>
      </View>

      {/* Dimming alone isn't a valid non-colour differentiator (see the
          app's own "never rely on colour alone" rule) — this caption is
          the real signal for sighted users, same job the accessibility
          label already does for screen readers. Found missing in a
          same-night compliance pass, fixed immediately rather than just
          flagged. See docs/09-decision-log.md, 2026-08-31. */}
      {!holdPlus ? <Text style={styles.lockedCaption}>Hold+ unlocks other months</Text> : null}

      {holdPlus && openPicker === "month" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
          {MONTH_ABBREVIATIONS.map((label, index) => (
            <AdaptiveCircleChip
              key={label}
              label={label}
              compact
              isSelected={monthStart.getMonth() === index}
              onPress={() => pickMonth(index)}
            />
          ))}
        </ScrollView>
      ) : null}

      {holdPlus && openPicker === "year" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
          {pickableYears.map((candidate) => (
            <AdaptiveCircleChip
              key={candidate}
              label={String(candidate)}
              compact
              isSelected={year === candidate}
              onPress={() => pickYear(candidate)}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid} key={monthKey(monthStart)}>
        {grid.map((date, index) => {
          if (!date) {
            return <View key={`blank-${index}`} style={styles.dayCell} />;
          }

          const key = dateKeyOf(date);
          const band = dayBands.get(key);
          const selected = selectedDayKey === key;

          // Only days with a logged period are tappable — an empty-day
          // tap led to a dead "nothing here" state before, pure friction.
          // Plain View for empty days, not a Pressable with a no-op.
          if (!band) {
            return (
              <View key={key} style={styles.dayCell}>
                <View style={styles.dayCircle}>
                  <Text style={styles.dayNumber}>{date.getDate()}</Text>
                </View>
              </View>
            );
          }

          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`${monthName} ${date.getDate()}, has a Hold period`}
              onPress={() => setSelectedDayKey(selected ? null : key)}
              style={styles.dayCell}
            >
              <View
                style={[
                  styles.dayBand,
                  band.roundStart && styles.dayBandRoundStart,
                  band.roundEnd && styles.dayBandRoundEnd
                ]}
              />
              <View style={[styles.dayCircle, selected && styles.dayCircleSelected]}>
                <Text style={[styles.dayNumber, styles.dayNumberLogged]}>{date.getDate()}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {selectedDayKey ? (
        <View style={styles.dayDetail}>
          {selectedDayPeriods.length === 0 ? (
            <Text style={styles.empty}>No Hold period on this day.</Text>
          ) : (
            selectedDayPeriods.map((period) => (
              <PeriodCard key={period.id} period={period} onDelete={onDelete} />
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

export default function HoldHistoryScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [periods, setPeriods] = useState<HoldPeriod[]>([]);
  const [segment, setSegment] = useState<Segment>("history");
  /** List's own default scope, confirmed: most-recent 6 months, all-time reachable via this link. Calendar's own month/year pickers reach all-time separately — this doesn't share state with those, a deliberately simpler mechanism for a plain chronological list. See docs/09-decision-log.md, 2026-08-30. */
  const [listShowingAllTime, setListShowingAllTime] = useState(false);
  const [highlightedPeriodId, setHighlightedPeriodId] = useState<string | null>(null);

  // Calendar+list merge, 2026-09-01 (confirmed 30 August decision, not
  // previously propagated to hold-book) — no more List/Calendar toggle;
  // the list is always visible below the (collapsed-by-default) calendar.
  // Tapping a day with activity jumps/anchors the list to that entry,
  // per the confirmed spec. measureLayout against the Screen's own
  // ScrollView, not onLayout-based offset summing — more robust across
  // however many sibling sections sit between the calendar and a given
  // card, since it asks the native layer for the real relative position
  // rather than manually accumulating heights.
  const scrollRef = useRef<ScrollView>(null);
  const periodCardRefs = useRef<Map<string, View>>(new Map());

  const scrollToPeriod = (periodId: string) => {
    const cardNode = periodCardRefs.current.get(periodId);
    const scrollNode = scrollRef.current;
    if (!cardNode || !scrollNode) return;
    cardNode.measureLayout(
      scrollNode as unknown as number,
      (_x, y) => scrollNode.scrollTo({ y: Math.max(0, y - theme.spacing.md), animated: true }),
      () => {}
    );
  };

  const handleSelectDate = (_dateKey: string, matchingPeriods: HoldPeriod[]) => {
    const target = matchingPeriods[0];
    if (!target) return;
    setHighlightedPeriodId(target.id);
    // If the tapped day's period is older than the list's own default
    // 6-month scope, it isn't rendered yet — widen the scope first so
    // there's actually something to scroll to, matching "jump to it"
    // rather than silently doing nothing.
    if (!listShowingAllTime && !recentPeriods.some((p) => p.id === target.id)) {
      setListShowingAllTime(true);
      // Card refs for a newly-revealed period don't exist until after this
      // re-render commits — deferred one tick rather than scrolling
      // against a stale/missing ref.
      setTimeout(() => scrollToPeriod(target.id), 50);
    } else {
      scrollToPeriod(target.id);
    }
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

  const sixMonthsAgo = (() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    return cutoff.getTime();
  })();
  const recentPeriods = periods.filter((period) => period.startedAt >= sixMonthsAgo);

  const closedPeriods = periods.filter((period) => period.endedAt !== null);
  const totalDurationMs = closedPeriods.reduce(
    (sum, period) => sum + (period.endedAt! - period.startedAt),
    0
  );
  const averageDurationMs = closedPeriods.length > 0 ? totalDurationMs / closedPeriods.length : null;
  const mostRecentEndedAt =
    closedPeriods.length > 0 ? Math.max(...closedPeriods.map((period) => period.endedAt!)) : null;

  return (
    <Screen contentContainerStyle={styles.content} scrollRef={scrollRef}>
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
          <HistoryCalendar periods={periods} onDelete={remove} onSelectDate={handleSelectDate} />

          {periods.length === 0 ? (
            <Text style={styles.empty}>No Hold periods yet.</Text>
          ) : (
            <>
              <View style={styles.list}>
                {(listShowingAllTime ? periods : recentPeriods).map((period) => (
                  <View
                    key={period.id}
                    ref={(node) => {
                      if (node) periodCardRefs.current.set(period.id, node);
                      else periodCardRefs.current.delete(period.id);
                    }}
                  >
                    <PeriodCard period={period} onDelete={remove} highlighted={period.id === highlightedPeriodId} />
                  </View>
                ))}
              </View>
              {!listShowingAllTime && recentPeriods.length < periods.length ? (
                <Pressable accessibilityRole="button" onPress={() => setListShowingAllTime(true)}>
                  <Text style={styles.listScopeLink}>Show all time</Text>
                </Pressable>
              ) : listShowingAllTime ? (
                <Pressable accessibilityRole="button" onPress={() => setListShowingAllTime(false)}>
                  <Text style={styles.listScopeLink}>Show recent only</Text>
                </Pressable>
              ) : null}
            </>
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
            <>
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

              <MonthCalendarView periods={periods} onDelete={remove} />
            </>
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
  listScopeLink: {
    color: colors.link,
    fontSize: 14,
    fontWeight: "600",
    marginTop: theme.spacing.sm
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
  itemHighlighted: {
    borderColor: colors.primary
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
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm
  },
  monthNav: {
    color: colors.primary,
    fontSize: 24,
    paddingHorizontal: theme.spacing.md
  },
  monthNavLocked: {
    color: colors.textMuted,
    opacity: 0.5
  },
  lockedCaption: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginBottom: theme.spacing.sm
  },
  monthLabelRow: {
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  monthLabel: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600"
  },
  pickerRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.sm
  },
  weekdayRow: {
    flexDirection: "row"
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  dayBand: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 32,
    // Reuses AdaptiveCircleChip's own sent-state fill (colors.primary),
    // not a separate calendar-only convention — "this day has something"
    // should read the same way "sent" does everywhere else in the app.
    backgroundColor: colors.primary
  },
  dayBandRoundStart: {
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16
  },
  dayBandRoundEnd: {
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  dayCircleSelected: {
    borderWidth: 1.5,
    borderColor: colors.primary
  },
  dayNumber: {
    color: colors.text,
    fontSize: 14
  },
  dayNumberLogged: {
    color: colors.onPrimary,
    fontWeight: "600"
  },
  dayDetail: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg
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
