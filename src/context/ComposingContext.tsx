import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useState
} from "react";

/**
 * Whether a docked text-composition field is actively focused anywhere in
 * the app right now — read by the root-level bottom nav bar to decide
 * whether to hide itself on a Tier 2 screen (see
 * `04-ux-content/04-navigation-architecture.md`'s two-tier visibility
 * rule). Needed because the nav bar moved out of the Tabs navigator's own
 * `tabBar` render prop (2026-08-13) to a root-level overlay, so it can no
 * longer read per-screen options via `navigation.setOptions` the way it
 * used to — this is `useComposingGestureLock`'s replacement channel for
 * that half of what it used to communicate. See docs/09-decision-log.md.
 */
interface ComposingContextValue {
  isComposing: boolean;
  setIsComposing: (isComposing: boolean) => void;
}

const ComposingContext = createContext<ComposingContextValue | null>(null);

export function ComposingProvider({ children }: PropsWithChildren) {
  const [isComposing, setIsComposing] = useState(false);
  const value = useMemo(() => ({ isComposing, setIsComposing }), [isComposing]);

  return <ComposingContext.Provider value={value}>{children}</ComposingContext.Provider>;
}

export function useComposing(): ComposingContextValue {
  const value = useContext(ComposingContext);

  if (!value) {
    throw new Error("useComposing must be used inside ComposingProvider");
  }

  return value;
}
