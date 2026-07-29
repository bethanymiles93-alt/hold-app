import { useMemo, useRef, type ReactNode } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

const DELETE_WIDTH = 88;
const SWIPE_OPEN_THRESHOLD = DELETE_WIDTH / 2;
const DRAG_CLAIM_THRESHOLD = 8;

interface SwipeableRowProps {
  children: ReactNode;
  onDelete: () => void;
  disabled?: boolean;
}

/**
 * Hand-built swipe-to-reveal-delete row (Animated + PanResponder, both plain
 * react-native core). Tapping the revealed action deletes immediately, no
 * confirmation — the swipe-then-tap gesture is the confirmation, matching
 * Mail/Reminders. `disabled` opts a row out of the gesture entirely (used for
 * Close Circle, which can't be deleted).
 */
export function SwipeableRow({ children, onDelete, disabled = false }: SwipeableRowProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > DRAG_CLAIM_THRESHOLD && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_event, gesture) => {
        const base = isOpen.current ? -DELETE_WIDTH : 0;
        translateX.setValue(Math.min(0, Math.max(-DELETE_WIDTH, base + gesture.dx)));
      },
      onPanResponderRelease: (_event, gesture) => {
        const base = isOpen.current ? -DELETE_WIDTH : 0;
        const released = Math.min(0, Math.max(-DELETE_WIDTH, base + gesture.dx));
        const shouldOpen = released < -SWIPE_OPEN_THRESHOLD;
        isOpen.current = shouldOpen;

        Animated.spring(translateX, {
          toValue: shouldOpen ? -DELETE_WIDTH : 0,
          useNativeDriver: true,
          bounciness: 0
        }).start();
      }
    })
  ).current;

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.deleteAction}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete"
          onPress={onDelete}
          style={styles.deleteButton}
        >
          <Text style={styles.deleteLabel}>Delete</Text>
        </Pressable>
      </View>

      <Animated.View
        style={[styles.front, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      overflow: "hidden",
      borderRadius: theme.radius.md
    },
    deleteAction: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "flex-end",
      justifyContent: "center"
    },
    deleteButton: {
      width: DELETE_WIDTH,
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.error
    },
    deleteLabel: {
      color: colors.white,
      fontSize: 15,
      fontWeight: "600"
    },
    front: {
      backgroundColor: colors.background
    }
  });
}
