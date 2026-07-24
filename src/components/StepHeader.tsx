import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/constants/theme";

interface StepHeaderProps {
  eyebrow?: string;
  title: string;
  body?: string;
  compact?: boolean;
}

export function StepHeader({ eyebrow, title, body, compact = false }: StepHeaderProps) {
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl
  },
  containerCompact: {
    marginBottom: theme.spacing.lg
  },
  eyebrow: {
    color: theme.colors.link,
    fontSize: 14,
    fontWeight: "600"
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "600",
    letterSpacing: -0.4
  },
  titleCompact: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3
  },
  body: {
    color: theme.colors.textMuted,
    fontSize: 17,
    lineHeight: 26
  }
});
