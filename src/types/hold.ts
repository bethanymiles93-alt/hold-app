export type FlowMode = "hold" | "return";

export type HoldIntent =
  | "quiet"
  | "unwell"
  | "overwhelmed"
  | "time"
  | "custom";

export type ReturnStyle =
  | "open-door"
  | "acknowledge"
  | "explain-little"
  | "custom";

export interface HoldFlowState {
  mode: FlowMode;
  recipients: string[];
  intent: HoldIntent | null;
  returnStyle: ReturnStyle | null;
  message: string;
}

export interface DraftRequest {
  mode: FlowMode;
  recipients: string[];
  intent?: HoldIntent | null;
  returnStyle?: ReturnStyle | null;
}
