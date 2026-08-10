import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface DockedFieldPreviewProps {
  value: string;
  placeholder: string;
  onPress: () => void;
  /** True while this field's text currently lives in the docked bar below. */
  isActive: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The on-page trigger for DockedInputBar — every field that used to be its
 * own in-page TextInput is now one of these: empty shows `placeholder`
 * (tap to start typing, which activates the docked bar), non-empty shows
 * the current value plus a small "Edit" affordance (tap to load it back
 * into the docked bar for editing) — the same interaction whether starting
 * fresh or editing something existing, everywhere in the app. See
 * docs/09-decision-log.md, 2026-08-10.
 */
export function DockedFieldPreview({
  value,
  placeholder,
  onPress,
  isActive,
  accessibilityLabel,
  style
}: DockedFieldPreviewProps) {
  const { colors } = useAppTheme("normal");
  const styles = createStyles(colors);
  const hasValue = value.trim().length > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (hasValue ? `Edit: ${value}` : placeholder)}
      onPress={onPress}
      style={[styles.box, isActive && styles.boxActive, style]}
    >
      <Text style={hasValue ? styles.valueText : styles.placeholderText}>
        {hasValue ? value : placeholder}
      </Text>
      {hasValue && !isActive ? <Text style={styles.editLabel}>Edit</Text> : null}
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    box: {
      minHeight: 60,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      backgroundColor: colors.surface,
      gap: theme.spacing.xs
    },
    boxActive: {
      borderColor: colors.primary
    },
    valueText: {
      color: colors.text,
      fontSize: 17,
      lineHeight: 25
    },
    placeholderText: {
      color: colors.textMuted,
      fontSize: 17,
      lineHeight: 25
    },
    editLabel: {
      alignSelf: "flex-start",
      color: colors.link,
      fontSize: 13,
      fontWeight: "600"
    }
  });
}
