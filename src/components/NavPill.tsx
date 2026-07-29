import type { ReactNode } from "react";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface NavPillProps {
  label: string;
  icon: ReactNode;
  onPress: () => void;
}

export function NavPill({ label, icon, onPress }: NavPillProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    pill: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
      minHeight: 48,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: theme.spacing.sm
    },
    pressed: {
      backgroundColor: colors.surface
    },
    label: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600"
    }
  });
}
