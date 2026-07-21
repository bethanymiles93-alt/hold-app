import { Pressable, StyleSheet, Text } from "react-native";
import { theme } from "@/constants/theme";

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

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg
  },
  pressed: {
    backgroundColor: theme.colors.surface
  },
  disabled: {
    opacity: 0.45
  },
  label: {
    color: theme.colors.primary,
    fontSize: 17,
    fontWeight: "600"
  }
});
