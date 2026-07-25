export type FlowMode = "hold" | "return";

export type HoldIntent =
  | "quiet"
  | "unwell"
  | "overwhelmed"
  | "custom";

export type ReturnStyle =
  | "open-door"
  | "acknowledge"
  | "explain-little"
  | "custom";

export interface AudienceContact {
  name: string;
  phoneNumber: string;
}

export interface AudienceCircle {
  circleId: string;
  circleName: string;
  contacts: AudienceContact[];
}

export interface HoldFlowState {
  mode: FlowMode;
  recipients: string[];
  selectedGroups: CircleGroup[];
  intent: HoldIntent | null;
  returnStyle: ReturnStyle | null;
  message: string;
  audienceCircles: AudienceCircle[];
  audienceUngrouped: AudienceContact[];
}

export interface DraftRequest {
  mode: FlowMode;
  recipients: string[];
  intent?: HoldIntent | null;
  returnStyle?: ReturnStyle | null;
}

export interface StoredReply {
  id: string;
  recipientName: string;
  friendMessage: string;
  draftReply: string;
  windowHours: number;
  createdAt: number;
  expiresAt: number;
  sentAt?: number | null;
}

export interface HoldPeriod {
  id: string;
  startedAt: number;
  endedAt: number | null;
  recipients: string[];
  audienceCircles?: AudienceCircle[];
  audienceUngrouped?: AudienceContact[];
}

export interface CircleContact {
  id: string;
  name: string;
  phoneNumber: string;
}

export type SendMethod = "text" | "share";

export interface CircleGroup {
  id: string;
  name: string;
  isCloseCircle: boolean;
  contacts: CircleContact[];
  lastSendMethod: SendMethod | null;
}

export type EmailProvider = "gmail" | "outlook";

export interface EmailAccount {
  id: string;
  label: string;
  provider: EmailProvider;
  message: string;
  enabled: boolean;
}
