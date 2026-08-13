import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useState
} from "react";

/**
 * The single source of truth for "is the app currently showing the quiet
 * (Taking Time) palette or the normal one" — needed by BottomTabBar, which
 * sits alongside the screens in the tab navigator rather than inside Home's
 * own render tree, so it has no other way to know which palette Home is
 * currently resting in. Home writes to this whenever its own `homeState`
 * changes; nothing else should call `setIsQuiet` directly. See
 * docs/09-decision-log.md, 2026-08-13.
 */
interface QuietPaletteContextValue {
  isQuiet: boolean;
  setIsQuiet: (isQuiet: boolean) => void;
}

const QuietPaletteContext = createContext<QuietPaletteContextValue | null>(null);

export function QuietPaletteProvider({ children }: PropsWithChildren) {
  const [isQuiet, setIsQuiet] = useState(false);
  const value = useMemo(() => ({ isQuiet, setIsQuiet }), [isQuiet]);

  return <QuietPaletteContext.Provider value={value}>{children}</QuietPaletteContext.Provider>;
}

export function useQuietPalette(): QuietPaletteContextValue {
  const value = useContext(QuietPaletteContext);

  if (!value) {
    throw new Error("useQuietPalette must be used inside QuietPaletteProvider");
  }

  return value;
}
