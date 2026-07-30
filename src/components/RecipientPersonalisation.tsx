import { useMemo } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { SelectionCircle } from "@/components/SelectionCircle";
import type { GoingQuietRecipient } from "@/types/hold";

interface RecipientPersonalisationProps {
  recipients: GoingQuietRecipient[];
  onToggleIncluded: (contactId: string) => void;
  onSetIndividuallyRemoved: (contactId: string, removed: boolean) => void;
  onSetInstantMessage: (contactId: string, message: string) => void;
  onSetRouteToPersonalise: (contactId: string, route: boolean) => void;
}

/**
 * One Circle's full recipient list: a top-level include/exclude toggle for
 * everyone, then anyone excluded gets a second row below with their own
 * second-level toggle (individually-removed vs still getting their own
 * instant message), an editable message, and a Personalise link that routes
 * them to Conversations instead (seeded at Send time, not on tap).
 */
export function RecipientPersonalisation({
  recipients,
  onToggleIncluded,
  onSetIndividuallyRemoved,
  onSetInstantMessage,
  onSetRouteToPersonalise
}: RecipientPersonalisationProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const excluded = recipients.filter((recipient) => !recipient.included);
  // Excluding the only person in a Circle already has the same effect as not
  // selecting the Circle at all — the second-level "remove" toggle would just
  // offer a redundant way to reach the same outcome, so it's skipped here.
  const isSoleContact = recipients.length === 1;

  return (
    <View style={styles.container}>
      <View style={styles.mainList}>
        {recipients.map((recipient) => (
          <View key={recipient.contactId} style={styles.mainRow}>
            <SelectionCircle
              selected={recipient.included}
              onPress={() => onToggleIncluded(recipient.contactId)}
              accessibilityLabel={`${recipient.included ? "Included" : "Excluded"}: ${recipient.name}`}
            />
            <Text style={styles.name}>{recipient.name}</Text>
          </View>
        ))}
      </View>

      {excluded.length > 0 ? (
        <View style={styles.excludedList}>
          {excluded.map((recipient) => {
            if (!isSoleContact && recipient.individuallyRemoved) {
              return (
                <View key={recipient.contactId} style={styles.excludedRow}>
                  <SelectionCircle
                    selected={false}
                    onPress={() => onSetIndividuallyRemoved(recipient.contactId, false)}
                    accessibilityLabel={`Restore ${recipient.name}`}
                  />
                  <Text style={styles.nameRemoved}>{recipient.name}</Text>
                </View>
              );
            }

            return (
              <View key={recipient.contactId} style={styles.excludedBlock}>
                {isSoleContact ? (
                  <Text style={styles.name}>{recipient.name}</Text>
                ) : (
                  <View style={styles.excludedRow}>
                    <SelectionCircle
                      selected={true}
                      onPress={() => onSetIndividuallyRemoved(recipient.contactId, true)}
                      accessibilityLabel={`Remove ${recipient.name}`}
                    />
                    <Text style={styles.name}>{recipient.name}</Text>
                  </View>
                )}

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
                    <TextInput
                      accessibilityLabel={`Message for ${recipient.name}`}
                      multiline
                      onChangeText={(text) => onSetInstantMessage(recipient.contactId, text)}
                      style={styles.input}
                      textAlignVertical="top"
                      value={recipient.instantMessage}
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
    nameRemoved: {
      color: colors.textMuted
    },
    input: {
      minHeight: 60,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: theme.radius.sm,
      padding: theme.spacing.sm,
      color: colors.text,
      fontSize: 15,
      lineHeight: 21,
      backgroundColor: colors.surface
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
