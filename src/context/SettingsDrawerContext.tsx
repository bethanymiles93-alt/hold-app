import { createContext, type PropsWithChildren, useContext, useMemo, useState } from "react";

interface SettingsDrawerContextValue {
  isOpen: boolean;
  /** Where "Back" should return to for every settings screen reached this session, if anywhere. */
  originRoute: string | null;
  open: (fromRoute: string) => void;
  close: () => void;
  clearOriginRoute: () => void;
}

const SettingsDrawerContext = createContext<SettingsDrawerContextValue | null>(null);

export function SettingsDrawerProvider({ children }: PropsWithChildren) {
  const [isOpen, setIsOpen] = useState(false);
  const [originRoute, setOriginRoute] = useState<string | null>(null);

  const value = useMemo<SettingsDrawerContextValue>(
    () => ({
      isOpen,
      originRoute,
      open: (fromRoute: string) => {
        setIsOpen(true);
        // Reopening the drawer from a nested settings screen must not
        // overwrite the flow screen we originally came from — only a
        // non-settings route ever becomes the new "Back" destination.
        if (!fromRoute.startsWith("/settings")) {
          setOriginRoute(fromRoute);
        }
      },
      close: () => setIsOpen(false),
      clearOriginRoute: () => setOriginRoute(null)
    }),
    [isOpen, originRoute]
  );

  return <SettingsDrawerContext.Provider value={value}>{children}</SettingsDrawerContext.Provider>;
}

export function useSettingsDrawer(): SettingsDrawerContextValue {
  const value = useContext(SettingsDrawerContext);

  if (!value) {
    throw new Error("useSettingsDrawer must be used inside SettingsDrawerProvider");
  }

  return value;
}
