import { useCallback, useEffect } from "react";
import { useFocusEffect, useNavigation } from "expo-router";
import { useComposing } from "@/context/ComposingContext";

/**
 * Ties a screen's own "is a docked text field currently active" boolean to
 * two different accidental-exit paths at once, deliberately kept as one
 * shared mechanism rather than two separately-maintained ones (2026-08-13,
 * direct instruction): disables the stack's own swipe-back gesture via
 * `navigation.setOptions`, and writes to the shared `ComposingContext` the
 * root-level bottom nav bar reads to decide whether to hide itself.
 *
 * The nav bar used to read a per-screen `hideTabBar` option instead (set
 * via the same `navigation.setOptions` call) — that only worked while the
 * nav bar was itself the Tabs navigator's own `tabBar` render prop, scoped
 * to descriptors inside that one navigator, which naturally only ever
 * looked at the currently-*focused* tab's own value. Once the two-tier
 * visibility rule required the nav bar to also show on root-stack screens
 * (Settings) outside the Tabs group entirely (2026-08-13), it moved to a
 * root-level overlay reading one shared, non-scoped boolean instead — so
 * the focus-scoping this hook used to get for free from
 * `descriptors[focusedRoute.key]` has to be rebuilt explicitly here:
 * `useFocusEffect`, not a plain effect, so a screen only ever writes
 * `isComposing` while it's the one actually focused, and reliably clears
 * its own contribution on blur — not just on unmount, since a Tab
 * screen (Library) never unmounts when the user switches to another tab,
 * only loses focus. Without this, composing on Library then switching to
 * History would leave the nav bar wrongly hidden there too. See
 * docs/09-decision-log.md.
 */
export function useComposingGestureLock(isComposing: boolean): void {
  const navigation = useNavigation();
  const { setIsComposing } = useComposing();

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !isComposing } as never);
  }, [navigation, isComposing]);

  useFocusEffect(
    useCallback(() => {
      setIsComposing(isComposing);
      return () => setIsComposing(false);
    }, [isComposing, setIsComposing])
  );
}
