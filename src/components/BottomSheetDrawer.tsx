import type { PropsWithChildren, ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const PANEL_HEIGHT = Dimensions.get("window").height * 0.55;
const ANIMATION_MS = 260;

interface BottomSheetDrawerProps extends PropsWithChildren {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** The compact Send button, rendered below the title, right-aligned. */
  sendSlot?: ReactNode;
}

/**
 * Shared shell for the Taking Time drawers ("Send an Update" / "Add to
 * Going Quiet") — a bottom sheet filling just over half the screen,
 * dismissed by tapping anywhere above/outside it. Mechanics deliberately
 * match `SettingsDrawer`'s own verified pattern (checked directly against
 * its code, not assumed, per direct instruction) rather than a new
 * invention: an absolutely-positioned, full-screen `overlay` with
 * `pointerEvents="box-none"` so only its own children intercept touches; a
 * semi-transparent `backdrop` whose own full-bleed `Pressable` closes on
 * tap; a sliding panel animated via a plain `Animated.Value` + `Easing.out`
 * cubic. SettingsDrawer slides in from the right (`translateX`); this
 * slides up from the bottom (`translateY`) instead, since it's a bottom
 * sheet, not a side drawer — same animation shape, different axis. See
 * docs/09-decision-log.md, 2026-08-13.
 */
export function BottomSheetDrawer({ visible, onClose, title, sendSlot, children }: BottomSheetDrawerProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : PANEL_HEIGHT,
      // Instant snap instead of a slide when Reduce Motion is on — closes a
      // real, audit-found gap: this drawer had no reduce-motion
      // accommodation at all before. See docs/09-decision-log.md, 2026-08-21.
      duration: reduceMotion ? 0 : ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [visible, translateY, reduceMotion]);

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, PANEL_HEIGHT],
    outputRange: [1, 0]
  });

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        pointerEvents={visible ? "auto" : "none"}
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${title}`}
          accessibilityElementsHidden={!visible}
          style={styles.backdropTouchable}
          onPress={onClose}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.panel,
          { height: PANEL_HEIGHT, paddingBottom: insets.bottom + theme.spacing.md, transform: [{ translateY }] }
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {sendSlot ? <View style={styles.sendRow}>{sendSlot}</View> : null}
        </View>
        <View style={styles.body}>{children}</View>
      </Animated.View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "flex-end",
      zIndex: 50
    },
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.3)"
    },
    backdropTouchable: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0
    },
    panel: {
      backgroundColor: colors.background,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 12,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg
    },
    header: {
      gap: theme.spacing.sm
    },
    title: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "700"
    },
    sendRow: {
      flexDirection: "row",
      justifyContent: "flex-end"
    },
    body: {
      flex: 1,
      marginTop: theme.spacing.md
    }
  });
}
