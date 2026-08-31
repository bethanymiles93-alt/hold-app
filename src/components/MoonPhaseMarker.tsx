import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useAppTheme } from "@/hooks/useAppTheme";
import { getMoonPhase } from "@/utils/moonPhase";

const SIZE = 14;
const RADIUS = SIZE / 2;

/**
 * Functional elapsed-time cue beside "Quiet since [date]" (2026-08-31 —
 * see moonPhase.ts for the calculation). Shape-based, not colour-based, per
 * the app's "never rely on colour alone" rule: two same-radius circles
 * overlapped inside a clipped container is the standard way to render a
 * crescent/gibbous silhouette without SVG (no react-native-svg dependency
 * in this project). Static render of the phase at mount — no animation,
 * matching Taking Time's "genuinely restful" intent.
 *
 * litFraction/shadowShift derivation: shadow circle starts perfectly
 * overlapping the lit base circle at new moon (age 0, litFraction 0, full
 * dark) and slides fully clear of it at full moon (age 0.5, litFraction 1,
 * all lit); direction flips at age 0.5 so the exposed sliver sits on the
 * conventional side for waxing vs waning.
 */
export function MoonPhaseMarker() {
  const { colors } = useAppTheme("quiet");
  const phase = useMemo(() => getMoonPhase(), []);

  const litFraction = (1 - Math.cos(2 * Math.PI * phase.age)) / 2;
  const isWaxing = phase.age <= 0.5;
  const shift = 2 * RADIUS * litFraction * (isWaxing ? -1 : 1);

  const styles = useMemo(() => createStyles(colors.primary, colors.border), [colors.primary, colors.border]);

  return (
    <View style={styles.container} accessibilityRole="image" accessibilityLabel={phase.name}>
      <View style={[styles.shadowCircle, { left: shift }]} />
    </View>
  );
}

function createStyles(litColor: string, shadowColor: string) {
  return StyleSheet.create({
    container: {
      width: SIZE,
      height: SIZE,
      borderRadius: RADIUS,
      overflow: "hidden",
      backgroundColor: litColor,
      borderWidth: 1,
      borderColor: shadowColor
    },
    shadowCircle: {
      position: "absolute",
      top: 0,
      width: SIZE,
      height: SIZE,
      borderRadius: RADIUS,
      backgroundColor: shadowColor
    }
  });
}
