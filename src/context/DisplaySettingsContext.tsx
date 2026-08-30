import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import {
  getDisplaySettings,
  setColorSchemeOverride as persistColorSchemeOverride,
  setDisplayTheme as persistDisplayTheme,
  setMoonPhaseEnabled as persistMoonPhaseEnabled,
  setWarmthOffset as persistWarmthOffset,
  type ColorSchemeOverride,
  type DisplaySettings,
  type DisplayTheme
} from "@/services/displaySettingsService";

interface DisplaySettingsContextValue extends DisplaySettings {
  setWarmthOffset: (value: number) => void;
  setColorSchemeOverride: (value: ColorSchemeOverride) => void;
  setDisplayTheme: (value: DisplayTheme) => void;
  setMoonPhaseEnabled: (value: boolean) => void;
}

const DEFAULTS: DisplaySettings = {
  warmthOffset: 0,
  colorSchemeOverride: "system",
  displayTheme: "default",
  moonPhaseEnabled: false
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

  const value = useMemo(
    () => ({ ...settings, setWarmthOffset, setColorSchemeOverride, setDisplayTheme, setMoonPhaseEnabled }),
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
