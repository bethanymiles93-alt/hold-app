export type FlowMode = "hold" | "return";

/** SMS (native compose) or WhatsApp (wa.me deep link) — see sendingPreferencesService.ts for the global default and smsService.ts for delivery. */
export type SendingChannel = "sms" | "whatsapp";

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
  /** Carried over from CircleGroup.sendAsGroup at the point the audience was built — Reconnect needs this to honour the same per-Circle delivery setting Going Quiet used. See docs/09-decision-log.md, 2026-08-11. */
  sendAsGroup?: boolean;
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

export interface HoldFlowState {
  mode: FlowMode;
  recipients: string[];
  selectedGroups: CircleGroup[];
  returnStyle: ReturnStyle | null;
  audienceCircles: AudienceCircle[];
  audienceUngrouped: AudienceContact[];
  /** The Hold period Reconnect is targeting, known immediately on entry — separate from the durable RECONNECTING_KEY marker, which is only set at the first genuine send. */
  reconnectPeriodId: string | null;
  goingQuietRecipients: GoingQuietRecipient[];
  /**
   * contactId -> the id of a provisional Circle they've been split into
   * mid-flow (see GroupPicker/create/people.tsx's "+ New circle from
   * selected" action). A contact keeps being a real member of their
   * original Circle underneath — this only overrides which Circle their
   * Going Quiet recipient entry is attributed to for THIS session, the same
   * way individuallyRemoved never touches real Circle membership either.
   * See docs/09-decision-log.md, 2026-08-11.
   */
  recipientCircleOverrides: Record<string, string>;
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

/**
 * Which Reconnect steps a period reached this session — logged onto the
 * period's own record (Reconnect History stays one entry per Hold period,
 * deliberately, not one per message like Conversations) rather than
 * derived after the fact from conversationService's global, non-period-
 * scoped store, which can't be relied on retroactively (a later period's
 * seedFromAudience resets a person's own completed state). See
 * docs/09-decision-log.md, 2026-08-19.
 */
export type ReconnectStep = "instant_message_sent" | "personalise_completed";

/**
 * How a specific person was reached this Reconnect session — per-person,
 * matching `reconnectContactedIds`' own existing granularity (corrected
 * from per-Circle to per-person on 2026-08-13), not per-Circle. Layered
 * alongside `reconnectContactedIds` (which keeps doing exactly its
 * existing job: gate satisfaction) rather than replacing it — this map
 * adds the "how and when" dimension for Reconnect History.
 * - "sent": a real instant message went out — written by markReconnectContacted.
 * - "marked_no_send": "I've already told them" in Reconnect — satisfies
 *   the same completion gate as "sent", without an actual send.
 * - "marked_elsewhere": "Conversation complete" in Conversations, only
 *   ever attached while inside an active Continue-reconnecting session for
 *   this period (no lookup, no guessing — see markConversationComplete).
 * - "period_superseded": reserved for a future "restart Going Quiet
 *   mid-Taking-Time" feature — not written by anything yet.
 * See docs/09-decision-log.md, 2026-08-20.
 */
export type ReachedVia = "sent" | "marked_no_send" | "marked_elsewhere" | "period_superseded";

export interface HoldPeriod {
  id: string;
  startedAt: number;
  endedAt: number | null;
  recipients: string[];
  audienceCircles?: AudienceCircle[];
  audienceUngrouped?: AudienceContact[];
  /** Whether email out-of-office / wider-world status were turned on at Going Quiet's "Done" step. */
  emailOutOfOfficeEnabled?: boolean;
  widerWorldStatusEnabled?: boolean;
  /** Circle ids and ungrouped phone numbers already sent an instant message this Reconnect session — see docs/03-privacy-model.md. */
  reconnectContactedIds?: string[];
  /** Circle ids already sent a Taking Time "update" this Hold period — durable equivalent of Reconnect's reconnectContactedIds, scoped to the still-open period rather than a separate marker. */
  updateSentCircleIds?: string[];
  /**
   * Ids of pending (Going-Quiet-created, not-yet-real) Circles whose "add
   * permanently?" prompt has already been answered at Reconnect — a pending
   * Circle's own id already carries the "pending-" prefix GroupPicker gives
   * it, so this only needs to record which ones have been resolved, not a
   * separate pending-circle list of its own.
   */
  resolvedPendingCircleIds?: string[];
  /**
   * How each Circle's/ungrouped contact's message actually went out — process
   * metadata only, never message content. Key: Circle id or phone number,
   * value from smsService's channelKey (e.g. "sms", "shared", or
   * "shared:<iOS activityType>" when the OS reports one).
   */
  sendChannels?: Record<string, string>;
  /** Which Reconnect steps this period reached this session — see ReconnectStep. Written incrementally as each step happens, not just a final summary, so it survives a force-quit mid-flow. */
  reconnectStepsReached?: ReconnectStep[];
  /** How each person was reached this session — see ReachedVia. Keyed by phone number. */
  reconnectReachedVia?: Record<string, { at: number; via: ReachedVia }>;
  /**
   * Circles combined-sent together this period — Going Quiet's own trigger
   * for the linked-circles (Olympic-rings) mechanic already built for
   * Taking Time's "Send an Update". **Period-scoped, not a standing
   * relationship between Circles**: a new Hold period starts with no
   * inherited links, even if the same Circles are combined-sent again
   * later — that's a fresh link for the new period (direct instruction,
   * corrects an earlier "permanent per circle-set" framing this session
   * floated and the user then reversed). Keeps every historical record
   * rather than merging/overwriting on write, same as Taking Time's own
   * `UpdateCombinationTemplateRecord` — resolveLinkedClusters (see
   * src/utils/linkedCircleClusters.ts) resolves "most recent wins per
   * Circle" at read time. See docs/09-decision-log.md.
   */
  linkedCircleSets?: LinkedCircleSet[];
  /**
   * combinationKeys the person has explicitly ungrouped this period —
   * persisted (not session-local like Taking Time's own `ungroupedKeys`,
   * which deliberately resets every time that drawer reopens) so the
   * choice carries forward across screens within the same period:
   * Reconnect's instant-message screen and Conversations both read this
   * same field rather than each keeping their own separate decision.
   */
  ungroupedLinkKeys?: string[];
}

/** One combined-send record — see HoldPeriod.linkedCircleSets. */
export interface LinkedCircleSet {
  combinationKey: string;
  circleIds: string[];
  updatedAt: number;
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
  /**
   * Default false — delivery is individual/BCC-style by default: everyone
   * in this Circle gets a separate message, never a shared thread where
   * they can see each other, since people in the same Circle may not know
   * each other. Only when explicitly turned on does this Circle's messages
   * go out as one shared group thread instead. Set when creating a Circle
   * or from its own settings in Manage Circles. See docs/09-decision-log.md,
   * 2026-08-11.
   */
  sendAsGroup?: boolean;
  /**
   * True for a Circle created from Going Quiet's ad-hoc bundling flow
   * (removed people spun into a new Circle) — it exists fully-formed with
   * an auto-generated placeholder name (initials of its members) from the
   * moment it's created, never a yes/no "should this exist" question.
   * Drives Reconnect's optional rename opportunity; cleared (false) the
   * moment the person either renames it or explicitly leaves the
   * placeholder as-is — either way is a final acknowledgement, not
   * something to keep re-asking about. See docs/09-decision-log.md,
   * 2026-08-13.
   */
  needsNaming?: boolean;
}

export type EmailProvider = "gmail" | "outlook";

export interface EmailAccount {
  id: string;
  label: string;
  provider: EmailProvider;
  message: string;
  enabled: boolean;
}
