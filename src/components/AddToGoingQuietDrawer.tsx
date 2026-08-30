import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { BottomSheetDrawer } from "@/components/BottomSheetDrawer";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { DropdownArrowBadge } from "@/components/DropdownArrowBadge";
import { CompactSendButton } from "@/components/CompactSendButton";
import type { CircleGroup } from "@/types/hold";

interface AddToGoingQuietDrawerProps {
  visible: boolean;
  onClose: () => void;
  /** Every Circle created via this flow this session (Home stays mounted across tab switches, so this persists across drawer open/close). */
  circles: CircleGroup[];
  /** "+" on the top circle row — picks another contact, creates another Circle-of-one, appends it here. */
  onAddAnother: () => void;
  /** "+" on a specific Circle's own pill row — adds another person into that one Circle. */
  onAddPersonToCircle: (circleId: string) => void;
  onSend: (selectedCircleIds: Set<string>, excludedPersonIds: Set<string>, message: string) => void | Promise<void>;
  /** Pre-filled into the text box on open — the always-available-Send pattern lets this send unedited. */
  defaultMessage: string;
}

/**
 * "Add to Going Quiet" — works like Going Quiet's own screen (dropdown
 * arrow reveals a Circle's recipients on a horizontal pill row), not like
 * "Send an Update"'s Circle-only browsing: every contact added through
 * this flow becomes their own new Circle first (Home's own
 * `addToGoingQuiet`, before this drawer ever opens), matching Going
 * Quiet's own "+ New Circle" convention — there's no separate
 * "individual, non-Circle" category anywhere in this app, confirmed
 * 2026-08-13. This drawer is just the review/compose/send step for
 * whichever Circles were created this way this session; sending is what
 * actually adds each selected Circle to the tracked audience
 * (`addCircleToAudience`), not Circle creation itself. See
 * docs/09-decision-log.md.
 */
export function AddToGoingQuietDrawer({
  visible,
  onClose,
  circles,
  onAddAnother,
  onAddPersonToCircle,
  onSend,
  defaultMessage
}: AddToGoingQuietDrawerProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [selectedCircleIds, setSelectedCircleIds] = useState<Set<string>>(new Set());
  const [expandedCircleIds, setExpandedCircleIds] = useState<Set<string>>(new Set());
  const [excludedPersonIds, setExcludedPersonIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState(defaultMessage);

  useEffect(() => {
    if (!visible) return;
    // Newly-created Circles default into the current selection — the
    // point of this drawer is reviewing/sending to what was just added,
    // not a fresh empty pick every time it opens.
    setSelectedCircleIds(new Set(circles.map((circle) => circle.id)));
  }, [visible, circles]);

  const allSelected = circles.length > 0 && circles.every((circle) => selectedCircleIds.has(circle.id));
  // Same "All" gate as GroupPicker.tsx/Manage Circles/Reconnect's own
  // circle row (2026-08-30 sweep, found via the same anti-pattern already
  // fixed elsewhere tonight): with only one non-empty Circle to act on,
  // "All" is redundant with tapping that Circle's own chip directly. See
  // docs/09-decision-log.md.
  const nonEmptyCircleCount = circles.filter((circle) => circle.contacts.length > 0).length;

  const toggleAll = () => {
    setSelectedCircleIds(allSelected ? new Set() : new Set(circles.map((circle) => circle.id)));
  };

  const toggleCircle = (circleId: string) => {
    setSelectedCircleIds((current) => {
      const next = new Set(current);
      if (next.has(circleId)) next.delete(circleId);
      else next.add(circleId);
      return next;
    });
  };

  const toggleArrow = (circleId: string) => {
    setExpandedCircleIds((current) => {
      const next = new Set(current);
      if (next.has(circleId)) next.delete(circleId);
      else next.add(circleId);
      return next;
    });
  };

  const visibleCircles = circles.filter((circle) => expandedCircleIds.has(circle.id));
  const pillPeople = visibleCircles.flatMap((circle) =>
    circle.contacts.map((contact) => ({ key: `${circle.id}:${contact.phoneNumber}`, id: contact.phoneNumber, name: contact.name }))
  );
  const allPillsIncluded = pillPeople.length > 0 && pillPeople.every((person) => !excludedPersonIds.has(person.id));

  const toggleAllPills = () => {
    setExcludedPersonIds((current) => {
      if (allPillsIncluded) return new Set([...current, ...pillPeople.map((person) => person.id)]);
      const next = new Set(current);
      for (const person of pillPeople) next.delete(person.id);
      return next;
    });
  };

  const togglePerson = (personId: string) => {
    setExcludedPersonIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  };

  const send = () => {
    void onSend(selectedCircleIds, excludedPersonIds, message.trim());
    setMessage("");
  };

  return (
    <BottomSheetDrawer
      visible={visible}
      onClose={onClose}
      title="Add to Going Quiet"
      sendSlot={<CompactSendButton onPress={send} disabled={selectedCircleIds.size === 0 || !message.trim()} />}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.pinnedRow}>
          <AdaptiveCircleChip
            label="+"
            accessibilityLabel="Add another person"
            accessibilityRole="button"
            outline
            isSelected={false}
            labelFontSize={28}
            labelBold
            onPress={onAddAnother}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {nonEmptyCircleCount >= 2 ? (
              <AdaptiveCircleChip label="All" isSelected={allSelected} labelBold onPress={toggleAll} accessibilityRole="button" />
            ) : null}
            {circles.map((circle) => {
              const isExpanded = expandedCircleIds.has(circle.id);
              return (
                <View key={circle.id} style={styles.circleUnit}>
                  <AdaptiveCircleChip
                    label={circle.name}
                    isSelected={selectedCircleIds.has(circle.id)}
                    onPress={() => toggleCircle(circle.id)}
                    accessibilityRole="button"
                  />
                  <DropdownArrowBadge
                    expanded={isExpanded}
                    onPress={() => toggleArrow(circle.id)}
                    accessibilityLabel={`${circle.name}, ${isExpanded ? "hide" : "show"} people`}
                    style={styles.arrowButton}
                  />
                </View>
              );
            })}
          </ScrollView>
        </View>

        {pillPeople.length > 0 ? (
          <View style={styles.pinnedRow}>
            <AdaptiveCircleChip
              label="+"
              accessibilityLabel="Add person to this Circle"
              accessibilityRole="button"
              outline
              isSelected={false}
              labelFontSize={28}
              labelBold
              onPress={() => {
                const onlyExpanded = visibleCircles[0];
                if (onlyExpanded) onAddPersonToCircle(onlyExpanded.id);
              }}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <AdaptiveCircleChip label="All" compact isSelected={allPillsIncluded} labelBold onPress={toggleAllPills} accessibilityRole="button" />
              {pillPeople.map((person) => (
                <AdaptiveCircleChip
                  key={person.key}
                  label={person.name}
                  compact
                  isSelected={!excludedPersonIds.has(person.id)}
                  onPress={() => togglePerson(person.id)}
                  accessibilityRole="button"
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {selectedCircleIds.size > 0 ? (
          <TextInput
            multiline
            value={message}
            onChangeText={setMessage}
            placeholder="Not feeling very well, will get back to you when I can"
            placeholderTextColor={colors.textMuted}
            style={styles.textBox}
          />
        ) : null}
      </ScrollView>
    </BottomSheetDrawer>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scrollContent: {
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.xl
    },
    pinnedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
    },
    chipRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
    },
    circleUnit: {
      position: "relative",
      alignSelf: "flex-start"
    },
    arrowButton: {
      position: "absolute",
      right: 10,
      bottom: 12,
      alignItems: "center",
      justifyContent: "center"
    },
    textBox: {
      minHeight: 100,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: 16,
      textAlignVertical: "top"
    }
  });
}
