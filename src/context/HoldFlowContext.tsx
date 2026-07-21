import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useState
} from "react";
import type {
  FlowMode,
  HoldFlowState,
  HoldIntent,
  ReturnStyle
} from "@/types/hold";

interface HoldFlowContextValue extends HoldFlowState {
  setRecipients: (recipients: string[]) => void;
  setIntent: (intent: HoldIntent) => void;
  setReturnStyle: (style: ReturnStyle) => void;
  setMessage: (message: string) => void;
  resetFlow: (mode: FlowMode) => void;
}

const initialState: HoldFlowState = {
  mode: "hold",
  recipients: [],
  intent: null,
  returnStyle: null,
  message: ""
};

const HoldFlowContext = createContext<HoldFlowContextValue | null>(null);

export function HoldFlowProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<HoldFlowState>(initialState);

  const value = useMemo<HoldFlowContextValue>(
    () => ({
      ...state,
      setRecipients: (recipients) =>
        setState((current) => ({ ...current, recipients })),
      setIntent: (intent) =>
        setState((current) => ({ ...current, intent })),
      setReturnStyle: (returnStyle) =>
        setState((current) => ({ ...current, returnStyle })),
      setMessage: (message) =>
        setState((current) => ({ ...current, message })),
      resetFlow: (mode) =>
        setState({
          ...initialState,
          mode
        })
    }),
    [state]
  );

  return (
    <HoldFlowContext.Provider value={value}>
      {children}
    </HoldFlowContext.Provider>
  );
}

export function useHoldFlow(): HoldFlowContextValue {
  const value = useContext(HoldFlowContext);

  if (!value) {
    throw new Error("useHoldFlow must be used inside HoldFlowProvider");
  }

  return value;
}
