import * as SecureStore from "expo-secure-store";

const WARMTH_OFFSET_KEY = "hold.display.warmthOffset";
const COLOR_SCHEME_OVERRIDE_KEY = "hold.display.colorSchemeOverride";
const DISPLAY_THEME_KEY = "hold.display.theme";
const MOON_PHASE_ENABLED_KEY = "hold.display.moonPhaseEnabled";
const TEXT_SIZE_KEY = "hold.display.textSize";
const FONT_CHOICE_KEY = "hold.display.fontChoice";
const REDUCE_MOTION_OVERRIDE_KEY = "hold.display.reduceMotionOverride";
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

/**
 * Four-option choice, per the confirmed 2026-08-12 spec (Verdana/Arial/Open
 * Sans considered and cut as redundant with System default). **Stored and
 * available via `useAppTheme()`, not yet applied app-wide** — this
 * codebase has 200+ hardcoded `fontSize`/no explicit `fontFamily` literals
 * across 50+ component files with no shared typography scale to hook a
 * multiplier or font swap into; retrofitting every component is a real,
 * separate piece of work, flagged rather than silently claimed done. See
 * docs/09-decision-log.md, 2026-08-31.
 */
export type FontChoice = "system" | "lexend" | "atkinsonHyperlegible" | "openDyslexic";

/** Four steps, not a continuous slider — matches the low-capacity "avoid too many simultaneous choices" principle better than an unbounded range for a binary-ish "bigger/smaller" need. Same app-wide-application caveat as FontChoice above. */
export type TextSize = "small" | "default" | "large" | "extraLarge";

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
  textSize: TextSize;
  fontChoice: FontChoice;
  /**
   * Additive, not a replacement for the OS setting — reduce motion is
   * active if EITHER this is true OR the OS-level accessibility setting is
   * on (see `useReducedMotion.ts`). An accessibility "override" here means
   * "let me turn this accommodation on even without touching my OS
   * settings," not "let me force it off despite an OS-level need" — this
   * can only ever add reduce-motion behaviour, never remove an OS-driven
   * one.
   */
  reduceMotionOverride: boolean;
}

const DEFAULTS: DisplaySettings = {
  warmthOffset: 0,
  colorSchemeOverride: "system",
  displayTheme: "default",
  moonPhaseEnabled: false,
  textSize: "default",
  fontChoice: "system",
  reduceMotionOverride: false
};

export async function getDisplaySettings(): Promise<DisplaySettings> {
  const [warmthRaw, schemeRaw, themeRaw, moonRaw, warmthMigrated, textSizeRaw, fontChoiceRaw, reduceMotionRaw] =
    await Promise.all([
      SecureStore.getItemAsync(WARMTH_OFFSET_KEY),
      SecureStore.getItemAsync(COLOR_SCHEME_OVERRIDE_KEY),
      SecureStore.getItemAsync(DISPLAY_THEME_KEY),
      SecureStore.getItemAsync(MOON_PHASE_ENABLED_KEY),
      SecureStore.getItemAsync(WARMTH_BASE_MIGRATED_KEY),
      SecureStore.getItemAsync(TEXT_SIZE_KEY),
      SecureStore.getItemAsync(FONT_CHOICE_KEY),
      SecureStore.getItemAsync(REDUCE_MOTION_OVERRIDE_KEY)
    ]);

  const colorSchemeOverride =
    schemeRaw === "light" || schemeRaw === "dark" || schemeRaw === "system" ? schemeRaw : DEFAULTS.colorSchemeOverride;
  const displayTheme: DisplayTheme =
    themeRaw === "beach" || themeRaw === "forest" || themeRaw === "meadow" || themeRaw === "seasonal"
      ? themeRaw
      : DEFAULTS.displayTheme;
  const moonPhaseEnabled = moonRaw === "true";
  const textSize: TextSize =
    textSizeRaw === "small" || textSizeRaw === "large" || textSizeRaw === "extraLarge" ? textSizeRaw : DEFAULTS.textSize;
  const fontChoice: FontChoice =
    fontChoiceRaw === "lexend" || fontChoiceRaw === "atkinsonHyperlegible" || fontChoiceRaw === "openDyslexic"
      ? fontChoiceRaw
      : DEFAULTS.fontChoice;
  const reduceMotionOverride = reduceMotionRaw === "true";

  if (!warmthMigrated) {
    // First load since the base-colour change — any persisted value is
    // guaranteed to be from the old scale (this migration ships in the
    // same build as the new slider, so nothing could have set a
    // new-scale value yet). Reset unconditionally rather than clamp.
    await Promise.all([
      SecureStore.setItemAsync(WARMTH_OFFSET_KEY, String(DEFAULTS.warmthOffset)),
      SecureStore.setItemAsync(WARMTH_BASE_MIGRATED_KEY, "true")
    ]);
    return {
      warmthOffset: DEFAULTS.warmthOffset,
      colorSchemeOverride,
      displayTheme,
      moonPhaseEnabled,
      textSize,
      fontChoice,
      reduceMotionOverride
    };
  }

  const warmthOffset = warmthRaw ? Number(warmthRaw) : DEFAULTS.warmthOffset;

  return {
    warmthOffset: Number.isFinite(warmthOffset) ? Math.max(0, Math.min(1, warmthOffset)) : DEFAULTS.warmthOffset,
    colorSchemeOverride,
    displayTheme,
    moonPhaseEnabled,
    textSize,
    fontChoice,
    reduceMotionOverride
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

export async function setTextSize(value: TextSize): Promise<void> {
  await SecureStore.setItemAsync(TEXT_SIZE_KEY, value);
}

export async function setFontChoice(value: FontChoice): Promise<void> {
  await SecureStore.setItemAsync(FONT_CHOICE_KEY, value);
}

export async function setReduceMotionOverride(value: boolean): Promise<void> {
  await SecureStore.setItemAsync(REDUCE_MOTION_OVERRIDE_KEY, value ? "true" : "false");
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
    SecureStore.deleteItemAsync(WARMTH_BASE_MIGRATED_KEY),
    SecureStore.deleteItemAsync(TEXT_SIZE_KEY),
    SecureStore.deleteItemAsync(FONT_CHOICE_KEY),
    SecureStore.deleteItemAsync(REDUCE_MOTION_OVERRIDE_KEY)
  ]);
}
