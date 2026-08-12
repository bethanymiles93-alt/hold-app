import { useEffect } from "react";
import { useNavigation } from "expo-router";

/**
 * Ties a screen's own "is a docked text field currently active" boolean to
 * two different accidental-exit paths at once, deliberately kept as one
 * shared mechanism rather than two separately-maintained ones (2026-08-13,
 * direct instruction): disables the stack's own swipe-back gesture, and —
 * for a screen that's also a tab root (Library) — hides the bottom tab
 * bar, closing a second, easily-missed path to the same in-progress-
 * message data-loss risk an accidental tap or swipe mid-composition would
 * otherwise cause. `gestureEnabled` only matters on a pushed stack screen
 * (Going Quiet, Reconnect); `hideTabBar` only matters on a tab root
 * (Library) — each screen simply sets the option relevant to it, and the
 * other is a harmless no-op there. See docs/09-decision-log.md.
 */
export function useComposingGestureLock(isComposing: boolean): void {
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !isComposing, hideTabBar: isComposing } as never);
  }, [navigation, isComposing]);
}
