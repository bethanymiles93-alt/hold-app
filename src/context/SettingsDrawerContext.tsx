import { createContext, type PropsWithChildren, useContext, useMemo, useState } from "react";

interface SettingsDrawerContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const SettingsDrawerContext = createContext<SettingsDrawerContextValue | null>(null);

export function SettingsDrawerProvider({ children }: PropsWithChildren) {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo<SettingsDrawerContextValue>(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false)
    }),
    [isOpen]
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
