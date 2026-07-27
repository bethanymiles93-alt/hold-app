import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/constants/theme";

interface StepHeaderProps {
  eyebrow?: string;
  title: string;
  body?: string;
}

export function StepHeader({ eyebrow, title, body }: StepHeaderProps) {
  return (
    <View style={styles.container}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg
  },
  eyebrow: {
    color: theme.colors.link,
    fontSize: 14,
    fontWeight: "600"
  },
  title: {
    color: theme.colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.3
  },
  body: {
    color: theme.colors.textMuted,
    fontSize: 17,
    lineHeight: 26
  }
});
