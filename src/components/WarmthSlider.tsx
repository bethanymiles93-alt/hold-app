import { useMemo, useRef, useState } from "react";
import { PanResponder, View, StyleSheet, type GestureResponderEvent } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

interface WarmthSliderProps {
  /** 0 (base) to 1 (warmest) — see src/utils/warmth.ts. */
  value: number;
  onChange: (value: number) => void;
}

const TRACK_HEIGHT = 6;
const THUMB_SIZE = 28;
/** Increment/decrement step for VoiceOver/TalkBack's own adjustable actions — a custom PanResponder control has no built-in a11y, this is its whole accessible interface for anyone not dragging directly. */
const A11Y_STEP = 0.05;

/**
 * Continuous warmth control (2026-08-30, replaces discrete pills — see
 * docs/09-decision-log.md for the drift this corrects). No slider library
 * is installed in this app, so this is a plain PanResponder drag over a
 * track, not react-native-community/slider or similar. `value`/`onChange`
 * are fully controlled by the caller, same pattern as any other input here.
 */
export function WarmthSlider({ value, onChange }: WarmthSliderProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [trackWidth, setTrackWidth] = useState(0);

  const clamp = (n: number) => Math.max(0, Math.min(1, n));

  const updateFromTouch = (event: GestureResponderEvent) => {
    if (trackWidth <= 0) return;
    onChange(clamp(event.nativeEvent.locationX / trackWidth));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: updateFromTouch,
      onPanResponderMove: updateFromTouch
    })
  ).current;

  const thumbLeft = trackWidth > 0 ? value * trackWidth - THUMB_SIZE / 2 : -THUMB_SIZE / 2;

  return (
    <View
      style={styles.hitArea}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      {...panResponder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel="Warmth"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment") onChange(clamp(value + A11Y_STEP));
        else if (event.nativeEvent.actionName === "decrement") onChange(clamp(value - A11Y_STEP));
      }}
    >
      <View style={styles.track}>
        <View style={[styles.trackFill, { width: `${value * 100}%` }]} />
      </View>
      <View style={[styles.thumb, { left: thumbLeft }]} />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    hitArea: {
      position: "relative",
      minHeight: 44,
      justifyContent: "center"
    },
    track: {
      height: TRACK_HEIGHT,
      borderRadius: TRACK_HEIGHT / 2,
      backgroundColor: colors.border,
      overflow: "hidden"
    },
    trackFill: {
      height: "100%",
      borderRadius: TRACK_HEIGHT / 2,
      backgroundColor: colors.primary
    },
    thumb: {
      position: "absolute",
      top: "50%",
      marginTop: -THUMB_SIZE / 2,
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: THUMB_SIZE / 2,
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.background
    }
  });
}
