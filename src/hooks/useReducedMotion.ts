import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * The one place OS-level Reduce Motion preference is read from, app-wide —
 * extracted from Home's own original inline check (2026-08-21) so every
 * animation in the app can gate on the same live value, not just Home's.
 * Subscribes to live changes (`reduceMotionChanged`), not just a one-time
 * check on mount — Home's original version only checked once, so toggling
 * the OS setting mid-session wouldn't be picked up without a restart; this
 * closes that gap too. See docs/09-decision-log.md.
 */
export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
