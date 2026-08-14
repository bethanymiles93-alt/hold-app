import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import type { GoingQuietRecipient } from "@/types/hold";

interface RecipientPersonalisationProps {
  /** Full Circle membership, unfiltered — isSoleContact is judged against real membership, not whichever subset happens to still be included. */
  recipients: GoingQuietRecipient[];
  /**
   * Excluding someone here moves them out of this list entirely and into
   * the screen-level removed-people roster (2026-08-11 — replaces the
   * earlier inline excluded-row/instant-message/Personalise sub-flow,
   * itself replaced screen-wide by the ad-hoc-circle mechanic). The parent
   * owns both the context toggle and the roster bookkeeping; this only
   * reports which person was tapped.
   */
  onToggleIncluded: (contactId: string) => void;
  /** "+" row, pinned first — opens the contact picker to add a new member to this Circle, reusing the same mechanism Settings' Manage Circles already uses. See docs/09-decision-log.md, 2026-08-11. */
  onAddPerson: () => void;
}

/**
 * One Circle's member list, on demand (behind its own dropdown arrow — see
 * GroupPicker.tsx). Pinned "+" beside a horizontal row of AdaptiveCircleChip
 * pills, one per included person — matching the same pill-row convention
 * Reconnect and Library use for their own per-person rows. Tapping a pill
 * excludes that person, which removes them from this list outright rather
 * than revealing a second-level sub-row, since excluded people live in the
 * screen-level removed-people list instead (2026-08-11).
 *
 * A Circle with only one contact never shows a removable pill at all —
 * excluding your only recipient already has the same effect as not
 * selecting the Circle in the first place (that's GroupPicker's own chip),
 * so a second way to reach the same outcome here would just be confusing.
 */
export function RecipientPersonalisation({
  recipients,
  onToggleIncluded,
  onAddPerson
}: RecipientPersonalisationProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isSoleContact = recipients.length === 1;
  const visible = recipients.filter((recipient) => recipient.included);

  return (
    <View style={styles.container}>
      <View style={styles.pinnedRow}>
        <AdaptiveCircleChip
          label="+"
          accessibilityLabel="Add person"
          accessibilityRole="button"
          outline
          isSelected={false}
          labelFontSize={28}
          labelBold
          onPress={onAddPerson}
        />

        {isSoleContact ? (
          <View style={styles.soleContactRow}>
            <Text style={styles.name}>{visible[0]?.name}</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            style={styles.pillScroll}
          >
            {visible.map((recipient) => (
              <AdaptiveCircleChip
                key={recipient.contactId}
                label={recipient.name}
                isSelected
                onPress={() => onToggleIncluded(recipient.contactId)}
                accessibilityRole="button"
                accessibilityLabel={`${recipient.name}, included. Tap to remove.`}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.sm
    },
    pinnedRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm
    },
    pillScroll: {
      flex: 1
    },
    chipRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
    },
    soleContactRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 44
    },
    name: {
      color: colors.text,
      fontSize: 16
    }
  });
}
