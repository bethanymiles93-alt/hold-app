import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { DropdownArrowBadge } from "@/components/DropdownArrowBadge";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  buildMonthGrid,
  formatDateTime,
  formatDuration,
  getDayBands,
  summariseSendChannels
} from "@/services/holdHistoryFormat";
import type { HoldPeriod } from "@/types/hold";

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
}

/**
 * Duplicated from history.tsx's own PeriodCard rather than imported —
 * deliberate, matching the "fork a separate component" instruction: this
 * file is meant to stand alone, not stay entangled with history.tsx's own
 * internals. See docs/09-decision-log.md, 2026-08-30.
 */
function PeriodCard({ period, onDelete }: PeriodCardProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const channelLabels = summariseSendChannels(period.sendChannels);

  return (
    <View style={styles.item}>
      <Text style={styles.itemRecipients}>{period.recipients.join(", ")}</Text>
      <Text style={styles.itemMeta}>Started {formatDateTime(period.startedAt)}</Text>
      <Text style={styles.itemMeta}>Ended {period.endedAt ? formatDateTime(period.endedAt) : ""}</Text>
      {channelLabels.length > 0 ? <Text style={styles.itemMeta}>Sent via {channelLabels.join(", ")}</Text> : null}
      <Text style={styles.itemDuration}>{period.endedAt ? formatDuration(period.endedAt - period.startedAt) : ""}</Text>
      <Pressable accessibilityRole="button" onPress={() => onDelete(period.id)} style={styles.deleteButton}>
        <Text style={styles.deleteLabel}>Delete</Text>
      </Pressable>
    </View>
  );
}

interface HistoryCalendarProps {
  periods: HoldPeriod[];
  onDelete: (id: string) => void;
  /**
   * Fires when a day with at least one period on it is tapped — the
   * caller (history.tsx) uses this to scroll/anchor the always-visible
   * list below to the matching entry, per the confirmed 2026-09-01 merge
   * spec. Empty-day taps don't fire this at all, matching the app's own
   * "no dead taps" convention. Replaces the old inline `dayDetail` block
   * this component used to render itself — that responsibility moved up
   * to the list now that List/Calendar is one page, not two.
   */
  onSelectDate: (dateKey: string, matchingPeriods: HoldPeriod[]) => void;
}

/**
 * History's own calendar — forked from Patterns' MonthCalendarView
 * (history.tsx), which stays untouched for Patterns' own use. Confirmed
 * scope (given across two messages, one a correction to the first): the
 * day-grid is the persistent core view at all times, never replaced by
 * anything below it. The month and year in the header are independently
 * tappable, opening their own picker row. Selecting a year reveals a
 * supplementary list of that year's twelve months below the calendar,
 * each with its own DropdownArrowBadge to expand that month's periods
 * inline, plus one more badge next to the year heading to expand/collapse
 * every month in that year at once. This is a quick way to browse a full
 * year — it sits underneath the calendar, it doesn't replace it. See
 * docs/09-decision-log.md, 2026-08-30.
 *
 * **Merged into one page with the list, 2026-09-01** (confirmed 30 August
 * decision, not previously propagated to hold-book) — no more separate
 * List/Calendar toggle in history.tsx; this calendar and the list below
 * it are both always visible now, no toggle either way. **Briefly built
 * collapsed-by-default (tap to expand) the same day, then corrected**:
 * History's calendar is primary navigation, not a secondary aid, so it
 * stays always visible like the list below it — the collapse mechanic
 * is gone entirely, not just defaulted open. Day-tap no longer shows an
 * inline detail block here — it calls `onSelectDate` so the list below
 * can scroll/anchor to the matching entry instead. Only days with an
 * actual logged period are tappable at all (2026-09-01) — an empty-day
 * tap led nowhere, pure friction. See docs/09-decision-log.md.
 */
export function HistoryCalendar({ periods, onDelete, onSelectDate }: HistoryCalendarProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [openPicker, setOpenPicker] = useState<"month" | "year" | null>(null);
  // Set only once a year is actually picked — the supplementary month list
  // has nothing to show before that, per the confirmed spec.
  const [browsingYear, setBrowsingYear] = useState<number | null>(null);
  const [expandedMonthKeys, setExpandedMonthKeys] = useState<Set<string>>(new Set());

  const grid = buildMonthGrid(monthStart);
  const dayBands = getDayBands(periods, grid);
  const monthName = new Intl.DateTimeFormat(undefined, { month: "long" }).format(monthStart);
  const year = monthStart.getFullYear();

  const periodsOnDay = (dayKey: string): HoldPeriod[] =>
    periods.filter((period) => {
      if (period.endedAt === null) return false;
      const cursor = new Date(period.startedAt);
      cursor.setHours(0, 0, 0, 0);
      const end = new Date(period.endedAt);
      end.setHours(0, 0, 0, 0);
      while (cursor.getTime() <= end.getTime()) {
        if (dateKeyOf(cursor) === dayKey) return true;
        cursor.setDate(cursor.getDate() + 1);
      }
      return false;
    });

  // Earliest period's year up through the current year — a reasonable,
  // real range rather than an arbitrary fixed window either direction.
  const earliestYear = periods.reduce((earliest, period) => {
    const started = new Date(period.startedAt).getFullYear();
    return started < earliest ? started : earliest;
  }, new Date().getFullYear());
  const pickableYears: number[] = [];
  for (let candidate = new Date().getFullYear(); candidate >= earliestYear; candidate -= 1) {
    pickableYears.push(candidate);
  }

  const pickMonth = (monthIndex: number) => {
    setMonthStart(new Date(year, monthIndex, 1));
    setOpenPicker(null);
  };

  const pickYear = (pickedYear: number) => {
    setMonthStart(new Date(pickedYear, monthStart.getMonth(), 1));
    setBrowsingYear(pickedYear);
    setOpenPicker(null);
  };

  const toggleMonthExpanded = (key: string) => {
    setExpandedMonthKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const yearMonthKeys = browsingYear !== null ? Array.from({ length: 12 }, (_, index) => `${browsingYear}-${index}`) : [];
  const allYearMonthsExpanded = yearMonthKeys.length > 0 && yearMonthKeys.every((key) => expandedMonthKeys.has(key));
  const toggleAllYearMonths = () => {
    setExpandedMonthKeys((current) => {
      const next = new Set(current);
      if (allYearMonthsExpanded) {
        for (const key of yearMonthKeys) next.delete(key);
      } else {
        for (const key of yearMonthKeys) next.add(key);
      }
      return next;
    });
  };

  const periodsInMonth = (year: number, monthIndex: number): HoldPeriod[] =>
    periods.filter((period) => {
      const started = new Date(period.startedAt);
      return started.getFullYear() === year && started.getMonth() === monthIndex;
    });

  return (
    <View>
      <Text style={styles.stripHeaderLabel}>Calendar</Text>

      <View style={styles.monthRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              onPress={() => setMonthStart((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            >
              <Text style={styles.monthNav}>‹</Text>
            </Pressable>
            <View style={styles.monthLabelRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Change month, currently ${monthName}`}
                onPress={() => setOpenPicker((current) => (current === "month" ? null : "month"))}
              >
                <Text style={styles.monthLabel}>{monthName}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Change year, currently ${year}`}
                onPress={() => setOpenPicker((current) => (current === "year" ? null : "year"))}
              >
                <Text style={styles.monthLabel}>{year}</Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              onPress={() => setMonthStart((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            >
              <Text style={styles.monthNav}>›</Text>
            </Pressable>
          </View>

          {openPicker === "month" ? (
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

          {openPicker === "year" ? (
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

              // Only days with a logged period are tappable at all
              // (2026-09-01) — an empty day led to a dead "nothing here"
              // tap before, pure friction for no benefit. A plain View
              // for empty days rather than a Pressable with a no-op
              // handler, matching the app's own "no dead taps" rule.
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
                  onPress={() => onSelectDate(key, periodsOnDay(key))}
                  style={styles.dayCell}
                >
                  {/* Solid dark-green fill, reusing AdaptiveCircleChip's
                      own sent-state colour pairing (colors.primary fill,
                      colors.onPrimary text) rather than a separate
                      lighter convention — "this day has something" reads
                      the same way "sent" does everywhere else. */}
                  <View style={[styles.dayBand, band.roundStart && styles.dayBandRoundStart, band.roundEnd && styles.dayBandRoundEnd]} />
                  <View style={styles.dayCircle}>
                    <Text style={[styles.dayNumber, styles.dayNumberLogged]}>{date.getDate()}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

      {browsingYear !== null ? (
        <View style={styles.yearBrowseSection}>
          <View style={styles.yearBrowseHeaderRow}>
            <Text style={styles.yearBrowseHeading}>{browsingYear}, month by month</Text>
            <DropdownArrowBadge
              expanded={allYearMonthsExpanded}
              onPress={toggleAllYearMonths}
              accessibilityLabel={`${allYearMonthsExpanded ? "Collapse" : "Expand"} every month in ${browsingYear}`}
            />
          </View>

          {MONTH_ABBREVIATIONS.map((label, index) => {
            const key = `${browsingYear}-${index}`;
            const expanded = expandedMonthKeys.has(key);
            const monthPeriods = periodsInMonth(browsingYear, index);
            return (
              <View key={key} style={styles.yearBrowseMonthBlock}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => toggleMonthExpanded(key)}
                  style={styles.yearBrowseMonthRow}
                >
                  <Text style={styles.yearBrowseMonthLabel}>{label}</Text>
                  <DropdownArrowBadge
                    expanded={expanded}
                    onPress={() => toggleMonthExpanded(key)}
                    accessibilityLabel={`${expanded ? "Collapse" : "Expand"} ${label} ${browsingYear}`}
                  />
                </Pressable>
                {expanded ? (
                  monthPeriods.length === 0 ? (
                    <Text style={styles.empty}>No Hold periods that month.</Text>
                  ) : (
                    monthPeriods.map((period) => <PeriodCard key={period.id} period={period} onDelete={onDelete} />)
                  )
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    stripHeaderLabel: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "600",
      marginBottom: theme.spacing.sm
    },
    monthRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.spacing.sm
    },
    monthLabelRow: {
      flexDirection: "row",
      gap: theme.spacing.sm
    },
    monthNav: {
      fontSize: 22,
      color: colors.primary,
      paddingHorizontal: theme.spacing.sm
    },
    monthLabel: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.text
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
      width: "14.28%",
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center"
    },
    dayBand: {
      position: "absolute",
      left: 0,
      right: 0,
      top: "20%",
      height: "60%",
      backgroundColor: colors.primary
    },
    dayBandRoundStart: {
      left: "20%",
      borderTopLeftRadius: 999,
      borderBottomLeftRadius: 999
    },
    dayBandRoundEnd: {
      right: "20%",
      borderTopRightRadius: 999,
      borderBottomRightRadius: 999
    },
    dayCircle: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center"
    },
    dayNumber: {
      fontSize: 13,
      color: colors.text
    },
    dayNumberLogged: {
      color: colors.onPrimary,
      fontWeight: "600"
    },
    empty: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22
    },
    yearBrowseSection: {
      marginTop: theme.spacing.lg,
      gap: theme.spacing.sm
    },
    yearBrowseHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: theme.spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    yearBrowseHeading: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700"
    },
    yearBrowseMonthBlock: {
      gap: theme.spacing.sm
    },
    yearBrowseMonthRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 40
    },
    yearBrowseMonthLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "500"
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
      fontSize: 16,
      fontWeight: "600"
    },
    itemMeta: {
      color: colors.textMuted,
      fontSize: 13
    },
    itemDuration: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
      marginTop: 2
    },
    deleteButton: {
      alignSelf: "flex-start",
      marginTop: theme.spacing.xs
    },
    deleteLabel: {
      color: colors.error,
      fontSize: 13,
      fontWeight: "600"
    }
  });
}
