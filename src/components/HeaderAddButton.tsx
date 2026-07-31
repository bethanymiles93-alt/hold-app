import { Pressable, StyleSheet, Text } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

interface HeaderAddButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
}

/**
 * A flush "+" header action, alongside the hamburger, for screens whose
 * primary create action belongs in the header bar rather than the page
 * body — e.g. Your Circles' "+ New Circle". Reusable wherever else this
 * pattern fits (checked per-screen, not assumed identical every time).
 */
export function HeaderAddButton({ onPress, accessibilityLabel }: HeaderAddButtonProps) {
  const { colors } = useAppTheme("normal");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      android_ripple={{ color: "transparent", borderless: true }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={[styles.plus, { color: colors.text }]}>+</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 32,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  pressed: {
    backgroundColor: "transparent",
    opacity: 0.6
  },
  plus: {
    fontSize: 26,
    fontWeight: "400"
  }
});
