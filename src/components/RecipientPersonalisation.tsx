import { useState, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import type { GoingQuietRecipient } from "@/types/hold";

interface RecipientPersonalisationProps {
  /** Full Circle membership, unfiltered — isSoleContact is judged against real membership, not whichever subset happens to still be included. */
  recipients: GoingQuietRecipient[];
  /** Toggles a person between included/excluded for this send, in place — never removes them from view. See docs/09-decision-log.md, 2026-08-31. */
  onToggleIncluded: (contactId: string) => void;
  /** "+" row, pinned first — opens the contact picker to add a new member to this Circle, reusing the same mechanism Settings' Manage Circles already uses. See docs/09-decision-log.md, 2026-08-11. */
  onAddPerson: () => void;
  /**
   * True when this Circle isn't currently selected for the message — the
   * dropdown arrow that reveals this list is independent of selection
   * (2026-08-14), so a Circle can be previewed without being part of the
   * current send. There's no meaningful "exclude" action for a person who
   * isn't part of any active send yet, so pills render as plain,
   * non-interactive name labels in that case; "+" still works regardless,
   * since adding a member to a Circle has no such ambiguity. See
   * docs/09-decision-log.md, 2026-08-14.
   */
  readOnly?: boolean;
  /**
   * Core's own case, distinct from `readOnly` above — Core is locked
   * (editable only via Your Circles), so unlike a merely-unselected
   * Circle being previewed, there's no "+" to add someone here either.
   * Implies `readOnly` (no need to also pass both). See
   * docs/09-decision-log.md, 2026-08-31.
   */
  locked?: boolean;
}

/**
 * One Circle's full member list, on demand (behind its own dropdown arrow —
 * see GroupPicker.tsx). Pinned "+" beside a horizontal row of
 * AdaptiveCircleChip pills — one per member, always, whether currently
 * included or not. Tapping a pill toggles it between included (thick
 * outline, AdaptiveCircleChip's own selected treatment) and excluded
 * (hollow, thin outline) in place — nothing disappears or moves to a
 * second line. **Redesigned 2026-08-31**, superseding the earlier design
 * where excluding someone removed their pill from this list entirely and
 * surfaced them instead on a separate passive excluded-line below —
 * confirmed as one unified row for a reason: exclusion here is temporary
 * and per-send only (it never touches the Circle's real membership, which
 * only changes via Your Circles), so a person who's momentarily excluded
 * is still fully part of what this row is showing, not demoted to a
 * different visual class. See docs/09-decision-log.md.
 *
 * **Order freezes on open, not live.** Included members sort first,
 * excluded last, computed once — this component unmounts on collapse and
 * remounts fresh on reopen (see its own conditional render at the call
 * site), so a plain one-time sort on mount already gives "reorder on
 * close→reopen, never while open" for free, with no extra state needed.
 * Reordering live while someone's actively tapping pills would make pills
 * jump position under their finger mid-tap — deliberately avoided.
 *
 * A Circle with only one contact never shows a removable pill at all —
 * excluding your only recipient already has the same effect as not
 * selecting the Circle in the first place (that's GroupPicker's own chip),
 * so a second way to reach the same outcome here would just be confusing.
 */
export function RecipientPersonalisation({
  recipients,
  onToggleIncluded,
  onAddPerson,
  readOnly = false,
  locked = false
}: RecipientPersonalisationProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const effectiveReadOnly = readOnly || locked;
  const isSoleContact = recipients.length === 1;

  const [orderedIds] = useState(() =>
    [...recipients]
      .sort((a, b) => Number(b.included) - Number(a.included))
      .map((recipient) => recipient.contactId)
  );
  const visible = orderedIds
    .map((contactId) => recipients.find((recipient) => recipient.contactId === contactId))
    .filter((recipient): recipient is GoingQuietRecipient => recipient !== undefined);

  return (
    <View style={styles.container}>
      <View style={styles.pinnedRow}>
        {locked ? null : (
          <AdaptiveCircleChip
            label="+"
            accessibilityLabel="Add person"
            accessibilityRole="button"
            outline
            compact
            isSelected={false}
            labelBold
            onPress={onAddPerson}
          />
        )}

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
            {visible.map((recipient) =>
              effectiveReadOnly ? (
                <AdaptiveCircleChip
                  key={recipient.contactId}
                  label={recipient.name}
                  compact
                  isSelected
                  onPress={() => {}}
                  accessibilityRole="text"
                  accessibilityLabel={recipient.name}
                />
              ) : (
                <AdaptiveCircleChip
                  key={recipient.contactId}
                  label={recipient.name}
                  compact
                  isSelected={recipient.included}
                  onPress={() => onToggleIncluded(recipient.contactId)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    recipient.included
                      ? `${recipient.name}, included. Tap to exclude.`
                      : `${recipient.name}, excluded. Tap to include.`
                  }
                />
              )
            )}
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
