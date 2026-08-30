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
  /** Carried over from CircleContact.preferredChannel at the point the audience was built — same "frozen at send time" principle as AudienceCircle.sendAsGroup. See docs/09-decision-log.md, 2026-08-29. */
  preferredChannel?: SendingChannel;
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
  /** Set once the quiet "this draft has been open a while" heads-up has been shown for this record, so it's shown at most once per draft, not every time the accordion opens near expiry. See hold-book 06-privacy-security/04-content-retention.md, "Heads-up before auto-clear". */
  headsUpShownAt?: number;
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
  /**
   * The real, OAuth-linked email accounts (EmailAccount.linkedAt set)
   * behind emailOutOfOfficeEnabled — id+provider only, enough for
   * Reconnect's own real deactivate call (setRealAutoReply per account),
   * without persisting anything else about the account. Empty/absent
   * means Email was drafted manually, no real account linked — Reconnect
   * shows a manual-removal reminder instead of a real "turn off" action
   * in that case. See docs/09-decision-log.md, 2026-08-21.
   */
  emailLinkedAccounts?: { id: string; provider: EmailProvider }[];
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
  /**
   * WiderWorldPlatform ids the person said, at Going Quiet, they posted
   * their status to (the "Where did you post this?" step, offered once
   * the status text is copied) — this is what Reconnect's own taken-down
   * checklist below reads to know exactly which platforms to ask about,
   * rather than the full configured list every time.
   */
  widerWorldPostedPlatforms?: string[];
  /**
   * A subset of widerWorldPostedPlatforms the person has since confirmed,
   * at Reconnect, they've taken down — drives the checklist's own
   * sent-style (dark-green/white/checkmark) visual treatment per item,
   * matching every other "resolved" pill treatment in the app.
   */
  widerWorldTakenDownPlatforms?: string[];
  /**
   * A subset of emailLinkedAccounts (by id) the person has since confirmed,
   * at Reconnect, they've turned off — per-account, matching the unified
   * platform row's own per-account granularity (2026-08-30), not one
   * blanket "email off" toggle for every linked account at once.
   */
  widerWorldEmailTurnedOffAccountIds?: string[];
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
  /** Overrides the global default sending channel (Settings → Sending channel) for this one person. Unset falls back to the global default. Set from Manage Circles. See docs/09-decision-log.md, 2026-08-29. */
  preferredChannel?: SendingChannel;
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

/**
 * Durable as of 2026-08-30 (was ephemeral, per-Going-Quiet-session local
 * state before this) — configured once in "Your Wider World" settings,
 * same pattern as social platform Contexts. No `message` field: an
 * account's out-of-office text now comes from whichever Context it's
 * selected into (via WiderWorldContext.selectedPlatformIds, alongside
 * social platform ids), same shared per-Context message model, not a
 * second, separate message per account. See docs/09-decision-log.md.
 */
export interface EmailAccount {
  id: string;
  label: string;
  provider: EmailProvider;
  enabled: boolean;
  /**
   * Present once a real OAuth token exchange has succeeded for this
   * account — its absence is what drives the manual-draft-text fallback
   * everywhere this account is used, not `enabled` (which only means
   * "include this account's out-of-office at all"). Never the raw
   * access/refresh token itself (kept in emailOAuthTokenService's own
   * SecureStore entry, this account record travels through app state and
   * UI far more freely than a token should). See docs/09-decision-log.md,
   * 2026-08-21.
   */
  linkedAt?: number;
}

/**
 * One platform a person might post a "wider world" status update to
 * (Instagram, WhatsApp, etc.) — user-configured via the "Your Wider
 * World" settings screen, not a fixed built-in list. No configured
 * platforms means no pills show at "Where did you post this?" or the
 * Reconnect taken-down checklist; both read from this same list. See
 * docs/09-decision-log.md, 2026-08-21.
 */
export interface WiderWorldPlatform {
  id: string;
  name: string;
}

/**
 * A custom platform someone adds themselves via the "+" pill on a Wider
 * World context row (see widerWorldContextService.ts) — deliberately a
 * separate pool from the legacy WiderWorldPlatform list above, not merged
 * into it, so this new Contexts system stays fully independent of the
 * older flat list Going Quiet's "Where did you post this?" step and
 * Reconnect's taken-down checklist still read (untouched this pass). Never
 * has an icon — same text-only treatment as a preset with no bundled
 * glyph (e.g. Substack).
 */
export interface WiderWorldCustomPlatform {
  id: string;
  name: string;
}

/**
 * One "Wider World" context (Personal, Work, Side Hustle...) — a named
 * bundle of platform selections and the one shared message that applies to
 * all of them. The first context created stays unlabeled while it's the
 * only one; the moment a second is added, the first retroactively reads as
 * "Personal" — but the stored `label` is always a real string ("Personal"
 * from creation), the unlabeled-while-alone behaviour is purely a display
 * rule in the Settings screen, not a null/undefined state to handle
 * elsewhere. `selectedPlatformIds` is an ordered array, not a Set — order
 * is what "selected pills move to the front as a group, relative order
 * preserved" (the inline row, a later pass) depends on.
 */
export interface WiderWorldContext {
  id: string;
  label: string;
  selectedPlatformIds: string[];
  message: string;
  /**
   * Manual "I've actually posted this" marker, reusing Conversations' own
   * checkbox treatment exactly — Hold has no way to auto-detect a real
   * post on any of these platforms, same reasoning as every other manual
   * completion marker in the app. Whole-context, not per-platform: one
   * shared message, one shared sent state. `null`/absent means not marked;
   * a timestamp means marked, and un-marking clears it back to null rather
   * than storing `false`, so there's one obvious way to check "is this
   * marked" (truthy) rather than two.
   */
  sentAt?: number | null;
}

/**
 * Opt-in reminder for a platform whose status genuinely expires (WhatsApp
 * today) — keyed by contextId+platformId, not a single global flag, since
 * the same platform can be selected across multiple contexts and each
 * pairing is its own independent choice. Deliberately platform-agnostic in
 * shape: nothing here names WhatsApp specifically — whether a pairing is
 * eligible at all is driven entirely by the selected platform's own
 * `expiresAfterHours` (see widerWorldPresets.ts), never a hardcoded check.
 * Off by default; set only once the person explicitly opts in, while well,
 * not mid-flow.
 */
export interface WiderWorldExpiryReminderOptIn {
  contextId: string;
  platformId: string;
  optedInAt: number;
}
