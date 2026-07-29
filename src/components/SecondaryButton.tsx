import { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function SecondaryButton({
  label,
  onPress,
  disabled = false
}: SecondaryButtonProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    button: {
      minHeight: 56,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.lg
    },
    pressed: {
      backgroundColor: colors.surface
    },
    disabled: {
      opacity: 0.45
    },
    label: {
      color: colors.primary,
      fontSize: 17,
      fontWeight: "600"
    }
  });
}
