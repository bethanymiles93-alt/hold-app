import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";

/**
 * The one place Reduce Motion preference is read from, app-wide —
 * extracted from Home's own original inline check (2026-08-21) so every
 * animation in the app can gate on the same live value, not just Home's.
 * Subscribes to live OS changes (`reduceMotionChanged`), not just a
 * one-time check on mount — Home's original version only checked once, so
 * toggling the OS setting mid-session wouldn't be picked up without a
 * restart; this closes that gap too. See docs/09-decision-log.md.
 *
 * **Additive with the in-app Reading override (2026-08-31)** — reduce
 * motion is active if EITHER the OS setting is on OR the app's own
 * `reduceMotionOverride` preference is on (Accessibility & Display →
 * Reading), matching that preference's own "can only add the
 * accommodation, never remove an OS-driven one" design. This is the ONE
 * component of the Reading sub-group's three items that genuinely applies
 * app-wide with no further work — every existing `useReducedMotion()`
 * caller picks this up automatically, unlike text size/font choice (see
 * `displaySettingsService.ts`'s own FontChoice/TextSize comments for why
 * those two remain storage-only for now).
 */
export function useReducedMotion(): boolean {
  const [osReduceMotion, setOsReduceMotion] = useState(false);
  const { reduceMotionOverride } = useDisplaySettings();

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setOsReduceMotion(value);
    });

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setOsReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return osReduceMotion || reduceMotionOverride;
}
