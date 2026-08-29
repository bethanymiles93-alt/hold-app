import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

interface DropdownArrowBadgeProps {
  expanded: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  /** Positions the badge absolutely, overlapping its parent's corner — omit for a badge sitting in normal flow (e.g. beside a year label). */
  style?: StyleProp<ViewStyle>;
}

/**
 * The one dropdown/expand-arrow treatment used everywhere a Circle-style
 * chip or accordion row can expand — extracted 2026-08-29 after an audit
 * found two competing treatments in use (a corner-overlapping badge here,
 * vs. a plain triangle sitting below the shape elsewhere) and standardised
 * on this one: a small translucent circular badge, since it was both the
 * more common treatment and the one the canonical reference component
 * (GroupPicker, Going Quiet's own Circle row) already used. See
 * docs/09-decision-log.md.
 */
export function DropdownArrowBadge({ expanded, onPress, accessibilityLabel, style }: DropdownArrowBadgeProps) {
  const { colors } = useAppTheme("normal");
  const styles = createStyles();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded }}
      hitSlop={8}
      onPress={onPress}
      style={style ?? styles.inlinePosition}
    >
      {({ pressed }) => (
        <View style={[styles.badge, pressed && styles.pressed]}>
          <Text style={[styles.glyph, { color: colors.textMuted }]}>{expanded ? "▲" : "▼"}</Text>
        </View>
      )}
    </Pressable>
  );
}

function createStyles() {
  return StyleSheet.create({
    inlinePosition: {
      alignItems: "center",
      justifyContent: "center"
    },
    badge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0, 0, 0, 0.12)"
    },
    pressed: {
      opacity: 0.6
    },
    glyph: {
      fontSize: 13,
      fontWeight: "600"
    }
  });
}
