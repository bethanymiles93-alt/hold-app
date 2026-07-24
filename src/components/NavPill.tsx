import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { theme } from "@/constants/theme";

interface NavPillProps {
  label: string;
  icon: ReactNode;
  onPress: () => void;
}

export function NavPill({ label, icon, onPress }: NavPillProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      {icon}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    minHeight: 48,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.sm
  },
  pressed: {
    backgroundColor: theme.colors.surface
  },
  label: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600"
  }
});
