import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface StepHeaderProps {
  eyebrow?: string;
  title: string;
  body?: string;
}

export function StepHeader({ eyebrow, title, body }: StepHeaderProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg
    },
    eyebrow: {
      color: colors.link,
      fontSize: 14,
      fontWeight: "600"
    },
    title: {
      color: colors.text,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: "600",
      letterSpacing: -0.3
    },
    body: {
      color: colors.textMuted,
      fontSize: 17,
      lineHeight: 26
    }
  });
}
