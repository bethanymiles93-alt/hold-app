import { useCallback, useEffect } from "react";
import { useFocusEffect, useNavigation } from "expo-router";
import { useComposing } from "@/context/ComposingContext";

/**
 * Composition-driven nav bar hiding, for Tier 2 screens only (see
 * src/utils/navTier.ts) — Library is this hook's one remaining caller.
 * Going Quiet and Reconnect (Tier 1) used to call this too, tying their
 * swipe-back disable to composition state; as of 2026-08-13 their nav bar
 * visibility is unconditional by route (Tier 1 hides throughout regardless
 * of this hook) and their swipe-back is now a static `gestureEnabled:
 * false` in `app/_layout.tsx`'s `Stack.Screen` options instead — neither
 * needs this hook anymore, so both stopped calling it rather than leaving
 * a now-pointless call in place. The `navigation.setOptions({
 * gestureEnabled })` call below is a harmless no-op on Library specifically
 * (a Tab screen, not a pushed stack screen — swipe-back doesn't apply the
 * same way), kept only because Library's own gesture handling was never
 * the point of calling this here; writing `ComposingContext` is.
 *
 * Writes to `ComposingContext`, which the root-level bottom nav bar reads
 * to decide whether to hide itself on Tier 2. `useFocusEffect`, not a
 * plain effect: a screen must only ever write `isComposing` while it's the
 * one actually focused, clearing its own contribution on blur — not just
 * on unmount, since a Tab screen like Library never unmounts when the user
 * switches to another tab, only loses focus. Without this, composing on
 * Library then switching to History would leave the nav bar wrongly hidden
 * there too. See docs/09-decision-log.md.
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
