import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/constants/theme";

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

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    minHeight: 84
  },
  selected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceStrong
  },
  pressed: {
    opacity: 0.8
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  radioSelected: {
    backgroundColor: theme.colors.white
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.primary
  },
  copy: {
    flex: 1,
    gap: 4
  },
  title: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "600"
  },
  description: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22
  }
});
