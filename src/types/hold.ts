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

export interface GoingQuietRecipient {
  contactId: string;
  name: string;
  phoneNumber: string;
  circleId: string;
  circleName: string;
  /** In the Circle's shared group message. */
  included: boolean;
  /**
   * Only meaningful when included is false. False = excluded from the group
   * message but still has their own instant message; true = fully removed
   * (name only, nothing sent this round).
   */
  individuallyRemoved: boolean;
  /** This person's own short message, used when excluded but not fully removed. */
  instantMessage: string;
  /** Set via "Personalise" — routes them to Conversations instead of an instant send. */
  routeToPersonalise: boolean;
}

export interface GoingQuietCircleDraft {
  circleId: string;
  circleName: string;
  intent: HoldIntent | null;
  message: string;
  /** Exact text currently saved as this Circle's Library default; null if none has ever been saved. */
  savedMessage: string | null;
}

export interface HoldFlowState {
  mode: FlowMode;
  recipients: string[];
  selectedGroups: CircleGroup[];
  returnStyle: ReturnStyle | null;
  audienceCircles: AudienceCircle[];
  audienceUngrouped: AudienceContact[];
  goingQuietRecipients: GoingQuietRecipient[];
  circleDrafts: GoingQuietCircleDraft[];
  /** Circle ids already sent a Taking Time update this period — resets whenever resetFlow runs. */
  updatedCircleIds: string[];
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
  friendMessageExpiresAt: number;
  draftReply: string;
  draftReplyExpiresAt: number;
  createdAt: number;
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

export interface CircleGroup {
  id: string;
  name: string;
  isCloseCircle: boolean;
  contacts: CircleContact[];
}

export type EmailProvider = "gmail" | "outlook";

export interface EmailAccount {
  id: string;
  label: string;
  provider: EmailProvider;
  message: string;
  enabled: boolean;
}
