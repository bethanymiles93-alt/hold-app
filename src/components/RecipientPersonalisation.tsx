import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { theme } from "@/constants/theme";
import type { GoingQuietRecipient } from "@/types/hold";

interface RecipientPersonalisationProps {
  recipients: GoingQuietRecipient[];
  onToggleIncluded: (contactId: string) => void;
  onChangePersonalisedMessage: (contactId: string, message: string | null) => void;
  defaultMessage: string;
}

/**
 * Renders one Circle's people at a time — the box shown beneath a Circle pill
 * when its down-arrow is expanded (GroupPicker decides which Circle, if any).
 */
export function RecipientPersonalisation({
  recipients,
  onToggleIncluded,
  onChangePersonalisedMessage,
  defaultMessage
}: RecipientPersonalisationProps) {
  return (
    <View style={styles.container}>
      {recipients.map((recipient) => (
        <View key={recipient.contactId} style={styles.row}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: recipient.included }}
            onPress={() => onToggleIncluded(recipient.contactId)}
            style={styles.tapArea}
          >
            <View style={[styles.checkbox, recipient.included && styles.checkboxChecked]} />
            <Text style={[styles.name, !recipient.included && styles.nameExcluded]}>
              {recipient.name}
            </Text>
          </Pressable>

          {recipient.included ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                onChangePersonalisedMessage(
                  recipient.contactId,
                  recipient.personalisedMessage === null ? defaultMessage : null
                )
              }
            >
              <Text style={styles.linkText}>
                {recipient.personalisedMessage === null ? "Personalise" : "Use default message"}
              </Text>
            </Pressable>
          ) : null}

          {recipient.included && recipient.personalisedMessage !== null ? (
            <TextInput
              accessibilityLabel={`Message for ${recipient.name}`}
              multiline
              onChangeText={(text) => onChangePersonalisedMessage(recipient.contactId, text)}
              style={styles.input}
              textAlignVertical="top"
              value={recipient.personalisedMessage}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm
  },
  row: {
    gap: theme.spacing.xs
  },
  tapArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: 40
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: theme.radius.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.primary
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary
  },
  name: {
    color: theme.colors.text,
    fontSize: 16
  },
  nameExcluded: {
    color: theme.colors.textMuted,
    textDecorationLine: "line-through"
  },
  linkText: {
    color: theme.colors.link,
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 32
  },
  input: {
    marginLeft: 32,
    minHeight: 60,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 21,
    backgroundColor: theme.colors.white
  }
});
