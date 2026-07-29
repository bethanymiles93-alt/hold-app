import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { theme } from "@/constants/theme";
import {
  buildMonthGrid,
  formatDateTime,
  formatDuration,
  getDayBands
} from "@/services/holdHistoryFormat";
import { deleteHoldPeriod, getHistory } from "@/services/holdHistoryService";
import type { HoldPeriod } from "@/types/hold";

type Segment = "history" | "patterns";
type ViewMode = "list" | "calendar";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

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

function PeriodCard({ period, onDelete }: PeriodCardProps) {
  return (
    <View style={styles.item}>
      <Text style={styles.itemRecipients}>{period.recipients.join(", ")}</Text>
      <Text style={styles.itemMeta}>Started {formatDateTime(period.startedAt)}</Text>
      <Text style={styles.itemMeta}>
        Ended {period.endedAt ? formatDateTime(period.endedAt) : ""}
      </Text>
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

/** A month grid with quiet days marked, tap a day for its period(s) — its own independent month/selection state. */
function MonthCalendarView({ periods, onDelete }: MonthCalendarViewProps) {
  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const grid = buildMonthGrid(monthStart);
  const dayBands = getDayBands(periods, grid);
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric"
  }).format(monthStart);

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

  return (
    <View>
      <View style={styles.monthRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() =>
            setMonthStart((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
          }
        >
          <Text style={styles.monthNav}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() =>
            setMonthStart((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
          }
        >
          <Text style={styles.monthNav}>›</Text>
        </Pressable>
      </View>

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

          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              onPress={() => setSelectedDayKey(selected ? null : key)}
              style={styles.dayCell}
            >
              {band ? (
                <View
                  style={[
                    styles.dayBand,
                    band.roundStart && styles.dayBandRoundStart,
                    band.roundEnd && styles.dayBandRoundEnd
                  ]}
                />
              ) : null}
              <View style={[styles.dayCircle, selected && styles.dayCircleSelected]}>
                <Text style={styles.dayNumber}>{date.getDate()}</Text>
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
  const [periods, setPeriods] = useState<HoldPeriod[]>([]);
  const [segment, setSegment] = useState<Segment>("history");
  const [view, setView] = useState<ViewMode>("list");

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
            History
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setSegment("patterns")}
          style={[styles.toggleButton, segment === "patterns" && styles.toggleActive]}
        >
          <Text style={[styles.toggleLabel, segment === "patterns" && styles.toggleLabelActive]}>
            Patterns
          </Text>
        </Pressable>
      </View>

      {segment === "history" ? (
        <StepHeader
          eyebrow="History"
          title="Your Hold history"
          body="Just the record: when, how long, and who you told. Nothing else."
        />
      ) : (
        <StepHeader
          eyebrow="History"
          title="Your patterns"
          body="What your quiet periods have looked like, in your own data. No comparisons, no judgment."
        />
      )}

      {segment === "history" ? (
        <>
          <View style={styles.toggle}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setView("list")}
              style={[styles.toggleButton, view === "list" && styles.toggleActive]}
            >
              <Text
                style={[
                  styles.toggleLabel,
                  view === "list" && styles.toggleLabelActive
                ]}
              >
                List
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setView("calendar")}
              style={[styles.toggleButton, view === "calendar" && styles.toggleActive]}
            >
              <Text
                style={[
                  styles.toggleLabel,
                  view === "calendar" && styles.toggleLabelActive
                ]}
              >
                Calendar
              </Text>
            </Pressable>
          </View>

          {view === "list" ? (
            periods.length === 0 ? (
              <Text style={styles.empty}>No Hold periods yet.</Text>
            ) : (
              <View style={styles.list}>
                {periods.map((period) => (
                  <PeriodCard key={period.id} period={period} onDelete={remove} />
                ))}
              </View>
            )
          ) : (
            <MonthCalendarView periods={periods} onDelete={remove} />
          )}
        </>
      ) : (
        <View style={styles.patternsSection}>
          {periods.length === 0 ? (
            <Text style={styles.empty}>No Hold periods yet.</Text>
          ) : (
            <>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Quiet periods</Text>
                <Text style={styles.statValue}>{periods.length}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Average duration</Text>
                <Text style={styles.statValue}>
                  {averageDurationMs !== null ? formatDuration(averageDurationMs) : "—"}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Time since last quiet period</Text>
                <Text style={styles.statValue}>
                  {mostRecentEndedAt !== null ? formatDuration(Date.now() - mostRecentEndedAt) : "—"}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Days spent Taking Time</Text>
                <Text style={styles.statValue}>{formatDuration(totalDurationMs)}</Text>
              </View>

              <MonthCalendarView periods={periods} onDelete={remove} />
            </>
          )}

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

const styles = StyleSheet.create({
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
    borderColor: theme.colors.border
  },
  toggleActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceStrong
  },
  toggleLabel: {
    color: theme.colors.textMuted,
    fontSize: 15,
    fontWeight: "600"
  },
  toggleLabelActive: {
    color: theme.colors.text
  },
  empty: {
    color: theme.colors.textMuted,
    fontSize: 16,
    lineHeight: 24
  },
  list: {
    gap: theme.spacing.md
  },
  item: {
    gap: 2,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: theme.spacing.md
  },
  itemRecipients: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "600",
    marginBottom: theme.spacing.xs
  },
  itemMeta: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  itemDuration: {
    color: theme.colors.link,
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
    color: theme.colors.error,
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
    color: theme.colors.primary,
    fontSize: 24,
    paddingHorizontal: theme.spacing.md
  },
  monthLabel: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "600"
  },
  weekdayRow: {
    flexDirection: "row"
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    color: theme.colors.textMuted,
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
    backgroundColor: theme.colors.surfaceStrong
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
    borderColor: theme.colors.primary
  },
  dayNumber: {
    color: theme.colors.text,
    fontSize: 14
  },
  dayDetail: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg
  },
  patternsSection: {
    gap: theme.spacing.lg
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.spacing.sm
  },
  statLabel: {
    color: theme.colors.textMuted,
    fontSize: 15
  },
  statValue: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "600"
  },
  holdPlusCard: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.xs
  },
  holdPlusCardPressed: {
    opacity: 0.7
  },
  holdPlusTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "600"
  },
  holdPlusBody: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19
  },
  holdPlusLink: {
    color: theme.colors.link,
    fontSize: 13,
    fontWeight: "600"
  }
});
