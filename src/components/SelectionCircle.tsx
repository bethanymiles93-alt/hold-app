import { useMemo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface SelectionCircleProps {
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
}

/**
 * Selection control matching Home's main action-circle visual language:
 * filled primary when selected, white with a primary border when not —
 * colour paired with a fill change, never colour alone.
 */
export function SelectionCircle({
  selected,
  onPress,
  accessibilityLabel,
  size = 22
}: SelectionCircleProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      hitSlop={8}
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
        selected ? styles.selected : styles.unselected
      ]}
    />
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    circle: {
      borderWidth: 2,
      borderColor: colors.primary
    },
    selected: {
      backgroundColor: colors.primary
    },
    unselected: {
      backgroundColor: colors.white
    }
  });
}
