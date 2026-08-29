import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";

interface DropdownArrowBadgeProps {
  expanded: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  /** Positions the badge absolutely, overlapping its parent's corner — omit for a badge sitting in normal flow (e.g. beside a year label). */
  style?: StyleProp<ViewStyle>;
  /**
   * The chip this badge belongs to is currently showing AdaptiveCircleChip's
   * own sent fill (`hasSentThisSession && !isSelected`) — swaps the arrow
   * for a checkmark and the neutral translucent fill for the app's own
   * sent colours (solid `colors.primary`, white glyph), so the same corner
   * slot reads as "complete" instead of "expand/collapse." Never both at
   * once — a sent chip shows the checkmark, never the arrow, in the same
   * position. Still fully tappable and still expands/collapses exactly as
   * before: sent is never a locked state, this only changes which glyph
   * shows. See docs/09-decision-log.md, 2026-08-29 (item 14).
   */
  checked?: boolean;
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
export function DropdownArrowBadge({ expanded, onPress, accessibilityLabel, style, checked = false }: DropdownArrowBadgeProps) {
  const { colors } = useAppTheme("normal");
  const styles = createStyles();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded, checked }}
      hitSlop={8}
      onPress={onPress}
      style={style ?? styles.inlinePosition}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.badge,
            checked ? { backgroundColor: colors.primary } : null,
            pressed && styles.pressed
          ]}
        >
          <Text style={[styles.glyph, { color: checked ? colors.onPrimary : colors.textMuted }]}>
            {checked ? "✓" : expanded ? "▲" : "▼"}
          </Text>
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
      fontWeight: "700"
    }
  });
}
