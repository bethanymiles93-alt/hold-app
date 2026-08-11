import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { SelectionCircle } from "@/components/SelectionCircle";
import { DockedFieldPreview } from "@/components/DockedFieldPreview";
import type { GoingQuietRecipient } from "@/types/hold";

interface RecipientPersonalisationProps {
  recipients: GoingQuietRecipient[];
  onToggleIncluded: (contactId: string) => void;
  onSetIndividuallyRemoved: (contactId: string, removed: boolean) => void;
  onSetRouteToPersonalise: (contactId: string, route: boolean) => void;
  /** Whether this recipient's instant-message field currently lives in the parent screen's docked bar. */
  isFieldActive: (contactId: string) => boolean;
  onActivateField: (contactId: string) => void;
  /**
   * Which already-removed recipients are currently checked for bundling
   * into a new provisional Circle — the "+ New circle from selected"
   * action lives in the parent screen (it can span people removed from
   * several different Circles' cards at once), this just renders the
   * per-person checkbox. See docs/09-decision-log.md, 2026-08-11.
   */
  bundleSelectedIds: Set<string>;
  onToggleBundleSelected: (contactId: string) => void;
}

/**
 * One Circle's full recipient list: a top-level include/exclude toggle for
 * everyone, then anyone excluded gets a second row below with their own
 * second-level toggle (individually-removed vs still getting their own
 * instant message), an editable message, and a Personalise link that routes
 * them to Conversations instead (seeded at Send time, not on tap).
 *
 * A Circle with only one contact never shows any exclusion control at all —
 * excluding your only recipient already has the same effect as not
 * selecting the Circle in the first place (that's the GroupPicker pill),
 * so offering a second way to reach the same outcome here would just be a
 * confusing, easy-to-get-stuck-in dead end.
 */
export function RecipientPersonalisation({
  recipients,
  onToggleIncluded,
  onSetIndividuallyRemoved,
  onSetRouteToPersonalise,
  isFieldActive,
  onActivateField,
  bundleSelectedIds,
  onToggleBundleSelected
}: RecipientPersonalisationProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isSoleContact = recipients.length === 1;
  const excluded = isSoleContact ? [] : recipients.filter((recipient) => !recipient.included);

  return (
    <View style={styles.container}>
      <View style={styles.mainList}>
        {recipients.map((recipient) =>
          isSoleContact ? (
            <View key={recipient.contactId} style={styles.mainRow}>
              <Text style={styles.name}>{recipient.name}</Text>
            </View>
          ) : (
            <View key={recipient.contactId} style={styles.mainRow}>
              <SelectionCircle
                selected={recipient.included}
                onPress={() => onToggleIncluded(recipient.contactId)}
                accessibilityLabel={`${recipient.included ? "Included" : "Excluded"}: ${recipient.name}`}
              />
              <Text style={styles.name}>{recipient.name}</Text>
            </View>
          )
        )}
      </View>

      {excluded.length > 0 ? (
        <View style={styles.excludedList}>
          {excluded.map((recipient) => {
            if (recipient.individuallyRemoved) {
              return (
                <View key={recipient.contactId} style={styles.removedRow}>
                  <View style={styles.removedRowStart}>
                    <SelectionCircle
                      selected={false}
                      onPress={() => onSetIndividuallyRemoved(recipient.contactId, false)}
                      accessibilityLabel={`Restore ${recipient.name}`}
                    />
                    <Text style={styles.nameRemoved}>{recipient.name}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Select ${recipient.name} for a new Circle`}
                    accessibilityState={{ checked: bundleSelectedIds.has(recipient.contactId) }}
                    hitSlop={8}
                    onPress={() => onToggleBundleSelected(recipient.contactId)}
                    style={styles.bundleCheckboxWrap}
                  >
                    <View
                      style={[
                        styles.bundleCheckbox,
                        bundleSelectedIds.has(recipient.contactId) && styles.bundleCheckboxChecked
                      ]}
                    />
                  </Pressable>
                </View>
              );
            }

            return (
              <View key={recipient.contactId} style={styles.excludedBlock}>
                <View style={styles.excludedRow}>
                  <SelectionCircle
                    selected={true}
                    onPress={() => onSetIndividuallyRemoved(recipient.contactId, true)}
                    accessibilityLabel={`Remove ${recipient.name}`}
                  />
                  <Text style={styles.name}>{recipient.name}</Text>
                </View>

                {recipient.routeToPersonalise ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onSetRouteToPersonalise(recipient.contactId, false)}
                    style={styles.personaliseNote}
                  >
                    <Text style={styles.personaliseNoteText}>
                      Will personalise in Conversations
                    </Text>
                  </Pressable>
                ) : (
                  <>
                    <DockedFieldPreview
                      value={recipient.instantMessage}
                      placeholder={`Message for ${recipient.name}`}
                      isActive={isFieldActive(recipient.contactId)}
                      onPress={() => onActivateField(recipient.contactId)}
                      accessibilityLabel={`Message for ${recipient.name}`}
                    />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => onSetRouteToPersonalise(recipient.contactId, true)}
                    >
                      <Text style={styles.linkText}>Personalise</Text>
                    </Pressable>
                  </>
                )}
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
    container: {
      gap: theme.spacing.sm
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
    },
    excludedList: {
      gap: theme.spacing.sm,
      marginLeft: 32,
      paddingLeft: theme.spacing.sm,
      borderLeftWidth: 1.5,
      borderLeftColor: colors.border
    },
    excludedBlock: {
      gap: theme.spacing.xs
    },
    excludedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      minHeight: 36
    },
    removedRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 36
    },
    removedRowStart: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
    },
    nameRemoved: {
      color: colors.textMuted
    },
    bundleCheckboxWrap: {
      alignItems: "center",
      justifyContent: "center"
    },
    bundleCheckbox: {
      width: 22,
      height: 22,
      borderRadius: theme.radius.sm,
      borderWidth: 1.5,
      borderColor: colors.primary
    },
    bundleCheckboxChecked: {
      backgroundColor: colors.primary
    },
    linkText: {
      color: colors.link,
      fontSize: 13,
      fontWeight: "600"
    },
    personaliseNote: {
      minHeight: 32,
      justifyContent: "center"
    },
    personaliseNoteText: {
      color: colors.textMuted,
      fontSize: 13,
      fontStyle: "italic"
    }
  });
}
