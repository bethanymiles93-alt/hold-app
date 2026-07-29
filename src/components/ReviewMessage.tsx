import { useMemo } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface ReviewMessageProps {
  recipients: string[];
  circleName?: string | null;
  message: string;
  onChangeMessage: (message: string) => void;
}

export function ReviewMessage({
  recipients,
  circleName,
  message,
  onChangeMessage
}: ReviewMessageProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.recipientPanel}>
        <Text style={styles.label}>For</Text>
        <Text style={styles.recipients}>{circleName ?? recipients.join(", ")}</Text>
      </View>

      <View style={styles.messageGroup}>
        <Text style={styles.label}>Message</Text>
        <TextInput
          accessibilityLabel="Message to share"
          multiline
          onChangeText={onChangeMessage}
          style={styles.input}
          textAlignVertical="top"
          value={message}
        />
        <Text style={styles.helper}>
          Change any words you need. It does not have to explain everything.
        </Text>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.lg
    },
    recipientPanel: {
      gap: theme.spacing.xs,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surface,
      padding: theme.spacing.md
    },
    label: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "600"
    },
    recipients: {
      color: colors.text,
      fontSize: 17,
      lineHeight: 24
    },
    messageGroup: {
      gap: theme.spacing.sm
    },
    input: {
      minHeight: 220,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      color: colors.text,
      fontSize: 17,
      lineHeight: 25,
      backgroundColor: colors.surface
    },
    helper: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21
    }
  });
}
