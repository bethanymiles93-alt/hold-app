import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import {
  getDisplaySettings,
  setColorSchemeOverride as persistColorSchemeOverride,
  setDisplayTheme as persistDisplayTheme,
  setFontChoice as persistFontChoice,
  setMoonPhaseEnabled as persistMoonPhaseEnabled,
  setReduceMotionOverride as persistReduceMotionOverride,
  setTextSize as persistTextSize,
  setWarmthOffset as persistWarmthOffset,
  type ColorSchemeOverride,
  type DisplaySettings,
  type DisplayTheme,
  type FontChoice,
  type TextSize
} from "@/services/displaySettingsService";

interface DisplaySettingsContextValue extends DisplaySettings {
  setWarmthOffset: (value: number) => void;
  setColorSchemeOverride: (value: ColorSchemeOverride) => void;
  setDisplayTheme: (value: DisplayTheme) => void;
  setMoonPhaseEnabled: (value: boolean) => void;
  setTextSize: (value: TextSize) => void;
  setFontChoice: (value: FontChoice) => void;
  setReduceMotionOverride: (value: boolean) => void;
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

const DisplaySettingsContext = createContext<DisplaySettingsContextValue | null>(null);

/**
 * The single source of truth `useAppTheme` reads warmth/colour-scheme
 * override/display-theme from, app-wide — wraps the whole app in
 * `_layout.tsx`, same level as `QuietPaletteProvider`. Starts from
 * DEFAULTS (no warmth shift, follow OS, default theme, moon off) and loads
 * the real persisted values once on mount — every screen renders correctly
 * with defaults for that one frame before the load resolves, rather than
 * blocking on it. See docs/09-decision-log.md, 2026-08-22.
 */
export function DisplaySettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULTS);

  useEffect(() => {
    void getDisplaySettings().then(setSettings);
  }, []);

  const setWarmthOffset = (value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setSettings((current) => ({ ...current, warmthOffset: clamped }));
    void persistWarmthOffset(clamped);
  };

  const setColorSchemeOverride = (value: ColorSchemeOverride) => {
    setSettings((current) => ({ ...current, colorSchemeOverride: value }));
    void persistColorSchemeOverride(value);
  };

  const setDisplayTheme = (value: DisplayTheme) => {
    setSettings((current) => ({ ...current, displayTheme: value }));
    void persistDisplayTheme(value);
  };

  const setMoonPhaseEnabled = (value: boolean) => {
    setSettings((current) => ({ ...current, moonPhaseEnabled: value }));
    void persistMoonPhaseEnabled(value);
  };

  const setTextSize = (value: TextSize) => {
    setSettings((current) => ({ ...current, textSize: value }));
    void persistTextSize(value);
  };

  const setFontChoice = (value: FontChoice) => {
    setSettings((current) => ({ ...current, fontChoice: value }));
    void persistFontChoice(value);
  };

  const setReduceMotionOverride = (value: boolean) => {
    setSettings((current) => ({ ...current, reduceMotionOverride: value }));
    void persistReduceMotionOverride(value);
  };

  const value = useMemo(
    () => ({
      ...settings,
      setWarmthOffset,
      setColorSchemeOverride,
      setDisplayTheme,
      setMoonPhaseEnabled,
      setTextSize,
      setFontChoice,
      setReduceMotionOverride
    }),
    [settings]
  );

  return <DisplaySettingsContext.Provider value={value}>{children}</DisplaySettingsContext.Provider>;
}

export function useDisplaySettings(): DisplaySettingsContextValue {
  const value = useContext(DisplaySettingsContext);

  if (!value) {
    throw new Error("useDisplaySettings must be used inside DisplaySettingsProvider");
  }

  return value;
}
