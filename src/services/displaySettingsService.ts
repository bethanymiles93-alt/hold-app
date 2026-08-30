import * as SecureStore from "expo-secure-store";

const WARMTH_OFFSET_KEY = "hold.display.warmthOffset";
const COLOR_SCHEME_OVERRIDE_KEY = "hold.display.colorSchemeOverride";
const DISPLAY_THEME_KEY = "hold.display.theme";
const MOON_PHASE_ENABLED_KEY = "hold.display.moonPhaseEnabled";
/**
 * One-time migration flag (2026-08-30 base-colour change) — a persisted
 * warmthOffset from before this change means something completely
 * different now: the whole scale was redefined (old max "Warm" is the new
 * zero-point base; cool removed entirely), not just re-clamped at one end.
 * Simply clamping a legacy value into the new [0,1] range (as the old
 * negative-only migration did) left any pre-existing POSITIVE value
 * (0.5 or 1, common — "Warm"/"Warm+" were the two old warm pill options)
 * silently reinterpreted as "already near/at the new maximum," reading as
 * "stuck at the far right" on the new slider — confirmed on-device. This
 * flag makes the reset happen exactly once, ever, per install.
 */
const WARMTH_BASE_MIGRATED_KEY = "hold.display.warmthBaseMigrated";

export type ColorSchemeOverride = "light" | "dark" | "system";

/**
 * Only "default" actually renders anything today — the other three exist
 * so the settings UI can show the intended option set without silently
 * inventing palettes nobody has designed yet. See
 * app/settings/accessibility-display.tsx.
 */
export type DisplayTheme = "default" | "beach" | "forest" | "meadow" | "seasonal";

export interface DisplaySettings {
  /**
   * 0 (the new warm base, no additional shift) to 1 (warmest) — no cool
   * direction any more (2026-08-30, see src/utils/warmth.ts). A legacy
   * negative value from before that change clamps to 0 on load/save, same
   * as any other out-of-range value.
   */
  warmthOffset: number;
  colorSchemeOverride: ColorSchemeOverride;
  displayTheme: DisplayTheme;
  moonPhaseEnabled: boolean;
}

const DEFAULTS: DisplaySettings = {
  warmthOffset: 0,
  colorSchemeOverride: "system",
  displayTheme: "default",
  moonPhaseEnabled: false
};

export async function getDisplaySettings(): Promise<DisplaySettings> {
  const [warmthRaw, schemeRaw, themeRaw, moonRaw, warmthMigrated] = await Promise.all([
    SecureStore.getItemAsync(WARMTH_OFFSET_KEY),
    SecureStore.getItemAsync(COLOR_SCHEME_OVERRIDE_KEY),
    SecureStore.getItemAsync(DISPLAY_THEME_KEY),
    SecureStore.getItemAsync(MOON_PHASE_ENABLED_KEY),
    SecureStore.getItemAsync(WARMTH_BASE_MIGRATED_KEY)
  ]);

  const colorSchemeOverride =
    schemeRaw === "light" || schemeRaw === "dark" || schemeRaw === "system" ? schemeRaw : DEFAULTS.colorSchemeOverride;
  const displayTheme: DisplayTheme =
    themeRaw === "beach" || themeRaw === "forest" || themeRaw === "meadow" || themeRaw === "seasonal"
      ? themeRaw
      : DEFAULTS.displayTheme;
  const moonPhaseEnabled = moonRaw === "true";

  if (!warmthMigrated) {
    // First load since the base-colour change — any persisted value is
    // guaranteed to be from the old scale (this migration ships in the
    // same build as the new slider, so nothing could have set a
    // new-scale value yet). Reset unconditionally rather than clamp.
    await Promise.all([
      SecureStore.setItemAsync(WARMTH_OFFSET_KEY, String(DEFAULTS.warmthOffset)),
      SecureStore.setItemAsync(WARMTH_BASE_MIGRATED_KEY, "true")
    ]);
    return { warmthOffset: DEFAULTS.warmthOffset, colorSchemeOverride, displayTheme, moonPhaseEnabled };
  }

  const warmthOffset = warmthRaw ? Number(warmthRaw) : DEFAULTS.warmthOffset;

  return {
    warmthOffset: Number.isFinite(warmthOffset) ? Math.max(0, Math.min(1, warmthOffset)) : DEFAULTS.warmthOffset,
    colorSchemeOverride,
    displayTheme,
    moonPhaseEnabled
  };
}

export async function setWarmthOffset(value: number): Promise<void> {
  await SecureStore.setItemAsync(WARMTH_OFFSET_KEY, String(Math.max(0, Math.min(1, value))));
}

export async function setColorSchemeOverride(value: ColorSchemeOverride): Promise<void> {
  await SecureStore.setItemAsync(COLOR_SCHEME_OVERRIDE_KEY, value);
}

export async function setDisplayTheme(value: DisplayTheme): Promise<void> {
  await SecureStore.setItemAsync(DISPLAY_THEME_KEY, value);
}

export async function setMoonPhaseEnabled(value: boolean): Promise<void> {
  await SecureStore.setItemAsync(MOON_PHASE_ENABLED_KEY, value ? "true" : "false");
}

/**
 * Deliberately NOT wired into "Delete my data" — these are accessibility/
 * display preferences (how the app looks and reads for this person), not
 * personal content, same category as sendingPreferencesService's own
 * default-channel setting and the app's existing hasSeenWelcome-style
 * flags: "Delete my data" wipes content, not app state, so someone who
 * configured these for a genuine accessibility need doesn't have to
 * reconfigure them after a wipe. Exported for symmetry with every other
 * service's own deleteAllX() naming, in case a future "reset display
 * settings" action wants it specifically.
 */
export async function deleteAllDisplaySettings(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(WARMTH_OFFSET_KEY),
    SecureStore.deleteItemAsync(COLOR_SCHEME_OVERRIDE_KEY),
    SecureStore.deleteItemAsync(DISPLAY_THEME_KEY),
    SecureStore.deleteItemAsync(MOON_PHASE_ENABLED_KEY),
    SecureStore.deleteItemAsync(WARMTH_BASE_MIGRATED_KEY)
  ]);
}
