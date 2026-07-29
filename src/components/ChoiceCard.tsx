import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface ChoiceCardProps {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}

export function ChoiceCard({
  title,
  description,
  selected,
  onPress
}: ChoiceCardProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.selected,
        pressed && styles.pressed
      ]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.dot} /> : null}
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
      minHeight: 68
    },
    selected: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceStrong
    },
    pressed: {
      opacity: 0.8
    },
    radio: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2
    },
    radioSelected: {
      backgroundColor: colors.white
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary
    },
    copy: {
      flex: 1,
      gap: 4
    },
    title: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "600"
    },
    description: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22
    }
  });
}
