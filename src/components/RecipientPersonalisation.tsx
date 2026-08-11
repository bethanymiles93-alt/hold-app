import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { SelectionCircle } from "@/components/SelectionCircle";
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
 * GroupPicker.tsx). A selection circle per person: solid when included in
 * the current group message, tap to exclude — which now removes them from
 * this list outright rather than revealing a second-level sub-row, since
 * excluded people live in the screen-level removed-people list instead
 * (2026-08-11).
 *
 * A Circle with only one contact never shows the selection control at all
 * — excluding your only recipient already has the same effect as not
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add person"
        hitSlop={8}
        onPress={onAddPerson}
        style={styles.addRow}
      >
        {({ pressed }) => (
          <View style={[styles.addGlyphCircle, pressed && styles.addGlyphPressed]}>
            <Text style={styles.addGlyphText}>+</Text>
          </View>
        )}
      </Pressable>

      <View style={styles.mainList}>
        {visible.map((recipient) =>
          isSoleContact ? (
            <View key={recipient.contactId} style={styles.mainRow}>
              <Text style={styles.name}>{recipient.name}</Text>
            </View>
          ) : (
            <View key={recipient.contactId} style={styles.mainRow}>
              <SelectionCircle
                selected={recipient.included}
                onPress={() => onToggleIncluded(recipient.contactId)}
                accessibilityLabel={`${recipient.name}, included. Tap to remove.`}
              />
              <Text style={styles.name}>{recipient.name}</Text>
            </View>
          )
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
    // Deliberately reads as a control, not a name row — a bordered circular
    // "+" badge rather than plain text, so it can't be mistaken for a
    // person while scanning the list. See docs/09-decision-log.md, 2026-08-11.
    addRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 44
    },
    addGlyphCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center"
    },
    addGlyphPressed: {
      opacity: 0.6
    },
    addGlyphText: {
      color: colors.primary,
      fontSize: 20,
      fontWeight: "700",
      lineHeight: 22
    },
    mainList: {
      gap: theme.spacing.xs
    },
    mainRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      minHeight: 36
    },
    name: {
      color: colors.text,
      fontSize: 16
    }
  });
}
