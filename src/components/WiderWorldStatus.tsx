import { useMemo } from "react";
import { Alert, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SecondaryButton } from "@/components/SecondaryButton";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { copyToClipboard } from "@/services/clipboardService";

interface WiderWorldStatusProps {
  enabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  text: string;
  onChangeText: (text: string) => void;
}

export function WiderWorldStatus({
  enabled,
  onToggleEnabled,
  text,
  onChangeText
}: WiderWorldStatusProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const copy = async () => {
    await copyToClipboard(text.trim());
    Alert.alert("Copied", "Paste it to your story or status when you’re ready.");
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Wider-world status</Text>
          <Text style={styles.subtext}>
            {enabled
              ? "Hold can’t post to WhatsApp or Instagram directly. Copy this and paste it to your story or status when you’re ready."
              : "Add a short line for your WhatsApp or Instagram status."}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Enable wider-world status"
          value={enabled}
          onValueChange={onToggleEnabled}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>

      {enabled ? (
        <View style={styles.body}>
          <TextInput
            accessibilityLabel="Wider-world status line"
            multiline
            onChangeText={onChangeText}
            style={styles.input}
            textAlignVertical="top"
            value={text}
          />
          <SecondaryButton label="Copy" onPress={() => void copy()} />
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: theme.spacing.md
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md
    },
    headerText: {
      flex: 1,
      gap: 4
    },
    title: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "600"
    },
    subtext: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20
    },
    body: {
      gap: theme.spacing.md
    },
    input: {
      minHeight: 70,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm,
      color: colors.text,
      fontSize: 16,
      lineHeight: 22,
      backgroundColor: colors.white
    }
  });
}
