import { useMemo, useRef, useState } from "react";
import { PanResponder, View, StyleSheet, type GestureResponderEvent, type PanResponderGestureState } from "react-native";
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
 *
 * Uses `gestureState.moveX`/`x0` (absolute screen coordinates PanResponder
 * itself tracks) against the track's own measured screen position — NOT
 * `nativeEvent.locationX`, which a first build used and turned out to be
 * unreliable during `onPanResponderMove` (a known RN gotcha: locationX
 * during a move event isn't consistently relative to the responder view,
 * so the slider didn't visibly move while dragging). `.measure()` gives an
 * absolute `pageX` to anchor against instead. See docs/09-decision-log.md,
 * 2026-08-30.
 *
 * **Bug fixed 2026-08-31: dial stuck, couldn't move.** `PanResponder.create`
 * was wrapped in `useRef(...).current`, so it — and the `onPanResponderGrant`/
 * `onPanResponderMove` closures inside it — were created exactly once, on
 * the very first render, closing over `trackWidth`/`trackPageX` at their
 * initial value of 0. `measureTrack`'s later `setTrackWidth`/`setTrackPageX`
 * calls did update state and re-render (correctly positioning the thumb
 * visually), but the PanResponder itself was never recreated, so every
 * touch's `updateFromPageX` call kept reading the stale, permanently-zero
 * closure values — `trackWidth <= 0` was true forever, so every tap/drag
 * silently no-opped. Fixed by tracking the measured values in refs
 * (mutable, read fresh at call-time, no stale-closure risk) instead of
 * relying on state read from inside a one-time closure; state is kept
 * alongside purely to trigger the re-render the thumb's own visual
 * position needs.
 */
export function WarmthSlider({ value, onChange }: WarmthSliderProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const trackRef = useRef<View>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const trackPageXRef = useRef(0);

  const clamp = (n: number) => Math.max(0, Math.min(1, n));

  const measureTrack = () => {
    trackRef.current?.measure((_x, _y, width, _height, pageX) => {
      trackWidthRef.current = width;
      trackPageXRef.current = pageX;
      setTrackWidth(width);
    });
  };

  const updateFromPageX = (pageX: number) => {
    if (trackWidthRef.current <= 0) return;
    onChange(clamp((pageX - trackPageXRef.current) / trackWidthRef.current));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_event: GestureResponderEvent, gestureState: PanResponderGestureState) =>
        updateFromPageX(gestureState.x0),
      onPanResponderMove: (_event: GestureResponderEvent, gestureState: PanResponderGestureState) =>
        updateFromPageX(gestureState.moveX)
    })
  ).current;

  const thumbLeft = trackWidth > 0 ? value * trackWidth - THUMB_SIZE / 2 : -THUMB_SIZE / 2;

  return (
    <View
      ref={trackRef}
      style={styles.hitArea}
      onLayout={measureTrack}
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
