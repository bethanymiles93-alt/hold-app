import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { GroupPicker, PENDING_CIRCLE_ID_PREFIX } from "@/components/GroupPicker";
import { ChoiceCard } from "@/components/ChoiceCard";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { RecipientPersonalisation } from "@/components/RecipientPersonalisation";
import { SecondaryButton } from "@/components/SecondaryButton";
import { CompactSendButton } from "@/components/CompactSendButton";
import { DockedInputBar } from "@/components/DockedInputBar";
import { DockedFieldPreview } from "@/components/DockedFieldPreview";
import { WiderWorldStatus } from "@/components/WiderWorldStatus";
import { WiderWorldPlatformRow } from "@/components/WiderWorldPlatformRow";
import { SafeguardingBanner } from "@/components/SafeguardingBanner";
import { useSafeguardingCheck } from "@/hooks/useSafeguardingCheck";
import { HOLD_INTENTS } from "@/constants/copy";
import {
  HAS_SEEN_CORE_ONBOARDING_HINT_KEY,
  HAS_SEEN_NEW_CIRCLE_ONBOARDING_HINT_KEY
} from "@/constants/storageKeys";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { buildAudienceCircles, useHoldFlow } from "@/context/HoldFlowContext";
import { createDraft } from "@/services/draftService";
import {
  getOpenHoldPeriod,
  linkCirclesInPeriod,
  recordPostSendChoices,
  recordSendChannel,
  startHoldPeriod,
  syncAudience
} from "@/services/holdHistoryService";
import { activateOutOfOffice, deactivateOutOfOffice, getEmailAccounts } from "@/services/emailAccountService";
import {
  getUnionOfSelectedWiderWorldPlatforms,
  getWiderWorldContexts,
  type SelectableWiderWorldPlatform
} from "@/services/widerWorldContextService";
import { copyToClipboard } from "@/services/clipboardService";
import { channelKey, sendToCircles } from "@/services/smsService";
import { getDefaultSendingChannel } from "@/services/sendingPreferencesService";
import { pickContact } from "@/services/contactPickerService";
import { addContactToGroup, CLOSE_CIRCLE_ID, getGroup, getGroups } from "@/services/circleService";
import {
  getCircleTemplate,
  getCombinationTemplate,
  getStartingPointsForCombination,
  saveCircleTemplate,
  saveCombinationTemplate
} from "@/services/templateService";
import type { CircleGroup, EmailAccount, GoingQuietRecipient, HoldIntent, HoldPeriod } from "@/types/hold";

const SUGGESTED_CIRCLES = ["Friends", "Work", "Book Club"];

/** Every distinct docked-bar field on this screen, keyed by a string tag so exactly one DockedInputBar can serve all of them. */
type ActiveField = "new-circle" | "group-message" | "wider-world-status";

const DEFAULT_STATUS_LINE = "Taking some quiet time. Back soon.";

/**
 * Queue-based Going Quiet (2026-08-11 redesign — supersedes the
 * generalised-All-only version from earlier today). A person picks their
 * Circles for the session from the full chip row; that becomes a
 * (monotonically growing) queue, not a fixed set — the row stays fully
 * visible/scrollable throughout, and tapping any circle at any time both
 * selects it for the current message AND adds it to the queue if it wasn't
 * already in it. Whichever Circles are selected for the message currently
 * being typed float to the front of the row. Once every queued Circle has
 * been sent to at least once, the flow completes automatically; "Done" is
 * a manual early exit only, gated the same as before (unreachable until at
 * least one send). Personalise is Reconnect-only — Going Quiet has no
 * equivalent; untapping someone here just excludes them from the current
 * send (see the excluded line below), with no bundling/re-circling
 * mechanic of its own. Creating a Circle for them happens only through the
 * ordinary "+ New Circle" flow, same as any other Circle (2026-08-30 —
 * removes the earlier ad-hoc bundling mechanic entirely, see
 * docs/09-decision-log.md).
 */
export default function HoldPeopleScreen() {
  const {
    recipients,
    selectedGroups,
    toggleGroup,
    setSelectedGroups,
    updateSelectedGroup,
    goingQuietRecipients,
    toggleRecipientIncluded,
    recipientCircleOverrides
  } = useHoldFlow();
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Every real Circle, independent of the current selection — needed for
  // sentCircleIds and to number placeholder names for provisional Circles.
  const [allGroups, setAllGroups] = useState<CircleGroup[]>([]);
  const [period, setPeriod] = useState<HoldPeriod | null>(null);
  /** First-run-only Core onboarding coach-mark — see GroupPicker's own comment on showCoreOnboardingHint. Starts false; set true only after confirming the flag hasn't been seen yet AND Core is still empty. See docs/09-decision-log.md, 2026-08-30. */
  const [showCoreOnboardingHint, setShowCoreOnboardingHint] = useState(false);
  /** Second, sequential first-run coach-mark, pointing at "+ New Circle" — only ever considered once Core's own hint above is done. See docs/09-decision-log.md, 2026-08-30. */
  const [showNewCircleOnboardingHint, setShowNewCircleOnboardingHint] = useState(false);
  /**
   * "Adjust" — off by default every session (never persisted), a plain
   * bold-on-tap toggle gating every non-Core Circle's own dropdown arrow
   * (see GroupPicker's own adjustMode comment). "+ New Circle" is
   * unaffected either way. See docs/09-decision-log.md, 2026-08-30.
   */
  const [adjustMode, setAdjustMode] = useState(false);

  // Every Circle id ever selected this session — grows, never shrinks
  // (deselecting a Circle for the current message doesn't drop it from the
  // queue). Drives auto-complete. See docs/09-decision-log.md, 2026-08-11.
  const [queuedGroupIds, setQueuedGroupIds] = useState<Set<string>>(new Set());
  // Same queue, keyed by id, but holding the actual CircleGroup snapshot —
  // needed because finish()'s syncAudience call must cover every Circle
  // ever queued this session, not just whatever's still selected at the
  // moment Done fires. `selectedGroups` alone can't do this: it's cleared
  // back to empty by send() right after each send, so a `finish()` built
  // from it (as it used to be) would silently wipe out audienceCircles for
  // every Circle already sent to earlier in the session — a real bug found
  // 2026-08-11. See docs/09-decision-log.md.
  const [queuedGroups, setQueuedGroups] = useState<Map<string, CircleGroup>>(new Map());

  // The one shared message for whichever Circle-combination is currently
  // selected — not per-Circle.
  const [message, setMessage] = useState("");
  const [savedDefaultText, setSavedDefaultText] = useState<string | null>(null);
  const [startingPoints, setStartingPoints] = useState<{ circleId: string; circleName: string; text: string }[]>(
    []
  );
  const [intent, setIntent] = useState<HoldIntent | null>(null);
  const [forceShowChips, setForceShowChips] = useState(false);

  // Set right after a successful Send, cleared the moment a new selection
  // is made — shows the just-sent text with save options in place of the
  // normal compose box. See docs/09-decision-log.md, 2026-08-11.
  const [justSentText, setJustSentText] = useState<string | null>(null);
  const [justSentGroups, setJustSentGroups] = useState<CircleGroup[]>([]);
  const [justSentSaved, setJustSentSaved] = useState(false);

  // Which one Circle's member dropdown is open, if any — single value, only
  // one at a time (2026-08-11).
  const [expandedCircleId, setExpandedCircleId] = useState<string | null>(null);

  const [oooExpanded, setOooExpanded] = useState(false);
  const [newCircleName, setNewCircleName] = useState("");
  const [sendAsGroupDraft, setSendAsGroupDraft] = useState(false);
  // Exactly one DockedInputBar serves every field on this screen — this is
  // which one, if any, currently owns it. See docs/09-decision-log.md, 2026-08-10.
  const [activeField, setActiveField] = useState<ActiveField | null>(null);

  // Durable as of 2026-08-30 (was ephemeral, re-entered every session) —
  // configured once in Settings → Your Wider World, same pattern as social
  // platform Contexts. No per-account enable toggle here any more: the
  // unified platform row below (markedPlatformIds) is itself the
  // selection, matching how social platforms already worked before this.
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [widerWorldEnabled, setWiderWorldEnabled] = useState(false);
  const [widerWorldText, setWiderWorldText] = useState(DEFAULT_STATUS_LINE);
  /**
   * The union of every platform (social or linked email account) selected
   * across any Wider World Context, deduplicated — there's still no
   * "which Context applies to this send" step anywhere (interim, flagged
   * explicitly, see getUnionOfSelectedWiderWorldPlatforms' own comment),
   * so every Context is treated as a parallel candidate. Revealed once
   * Status is actually copied (not the moment the free-text box's toggle
   * turns on), since there's nothing to ask about before that.
   */
  const [unifiedPlatforms, setUnifiedPlatforms] = useState<SelectableWiderWorldPlatform[]>([]);
  const [markedPlatformIds, setMarkedPlatformIds] = useState<Set<string>>(new Set());
  const [showWiderWorldPostedTo, setShowWiderWorldPostedTo] = useState(false);
  /**
   * Settings-authored per-context Wider World messages, offered on the
   * status box as tap-to-insert pills (`extraPhrases`) — the same
   * user-initiated, green-highlighted insertion mechanic Template/sentence
   * pills already use, never auto-loaded as the box's starting value. A
   * stale-but-silently-active default is exactly the risk that mechanic
   * exists to avoid. See docs/09-decision-log.md.
   */
  const [widerWorldContextMessages, setWiderWorldContextMessages] = useState<string[]>([]);

  /**
   * Toggling a social-platform pill is a plain self-report (Hold has no
   * way to verify a real post) — toggling an email pill actually calls the
   * account's real out-of-office API immediately, since Hold genuinely can
   * do that one automatically. Message resolved from whichever Context has
   * this account selected with non-empty text first (same union-based
   * interim rule as the row itself) — a real per-send Context picker would
   * remove this ambiguity, but doesn't exist yet. See docs/09-decision-log.md,
   * 2026-08-30.
   */
  const toggleMarkedPlatform = async (platform: SelectableWiderWorldPlatform) => {
    const nowMarked = !markedPlatformIds.has(platform.id);
    setMarkedPlatformIds((current) => {
      const next = new Set(current);
      if (next.has(platform.id)) next.delete(platform.id);
      else next.add(platform.id);
      return next;
    });

    if (platform.kind !== "email") return;

    const account = emailAccounts.find((candidate) => candidate.id === platform.id);
    if (!account) return;

    if (!nowMarked) {
      await deactivateOutOfOffice([{ id: account.id, provider: account.provider }]);
      return;
    }

    const contexts = await getWiderWorldContexts();
    const owningContext = contexts.find(
      (context) => context.selectedPlatformIds.includes(platform.id) && context.message.trim()
    );
    const message = owningContext?.message.trim() ?? "";

    await activateOutOfOffice([{ ...account, enabled: true, message }]);
  };

  /** "All" — marks every currently-visible platform not already marked, one toggleMarkedPlatform call each so email activation stays correct per account. */
  const markAllPlatforms = () => {
    for (const platform of unifiedPlatforms) {
      if (!markedPlatformIds.has(platform.id)) void toggleMarkedPlatform(platform);
    }
  };

  /** New custom platform from the row's own "+" — added to the shared pool already; this just marks it in the current session, same as any other platform tap. */
  const addAndMarkCustomPlatform = (platform: SelectableWiderWorldPlatform) => {
    setUnifiedPlatforms((current) => [...current, platform]);
    void toggleMarkedPlatform(platform);
  };

  const refreshPeriod = useCallback(async () => {
    setPeriod(await getOpenHoldPeriod());
  }, []);

  const refreshGroups = useCallback(async () => {
    setAllGroups(await getGroups());
  }, []);

  // Re-checked whenever allGroups changes (not just once on mount) so it
  // correctly resolves once the async getGroups() call actually returns —
  // idempotent, cheap, and naturally stops showing itself the moment
  // either handler below sets the persisted flag.
  useEffect(() => {
    void (async () => {
      const hasSeen = await AsyncStorage.getItem(HAS_SEEN_CORE_ONBOARDING_HINT_KEY);
      if (hasSeen) {
        setShowCoreOnboardingHint(false);
        return;
      }
      const core = allGroups.find((group) => group.id === CLOSE_CIRCLE_ID);
      setShowCoreOnboardingHint(core !== undefined && core.contacts.length === 0);
    })();
  }, [allGroups]);

  const dismissCoreOnboardingHint = () => {
    setShowCoreOnboardingHint(false);
    void AsyncStorage.setItem(HAS_SEEN_CORE_ONBOARDING_HINT_KEY, "true");
  };

  const addCoreOnboardingContact = async () => {
    const picked = await pickContact();
    if (!picked) return;

    await addContactToGroup(CLOSE_CIRCLE_ID, picked);
    setShowCoreOnboardingHint(false);
    await AsyncStorage.setItem(HAS_SEEN_CORE_ONBOARDING_HINT_KEY, "true");
    await refreshGroups();
  };

  // Sequential — only ever considered once Core's own hint above is
  // already done (dismissed or completed), never both at once. Also
  // guarded on no non-Core circle having a contact yet, same "still at
  // the starting state" check Core's own hint makes above — protects
  // against it firing again mid-session after someone has clearly
  // already used "+ New Circle" once on their own, e.g. after this
  // effect's own flag write hasn't round-tripped through AsyncStorage
  // yet on a very fast tap.
  useEffect(() => {
    void (async () => {
      const hasSeenCore = await AsyncStorage.getItem(HAS_SEEN_CORE_ONBOARDING_HINT_KEY);
      if (!hasSeenCore) {
        setShowNewCircleOnboardingHint(false);
        return;
      }
      const hasSeenNewCircle = await AsyncStorage.getItem(HAS_SEEN_NEW_CIRCLE_ONBOARDING_HINT_KEY);
      if (hasSeenNewCircle) {
        setShowNewCircleOnboardingHint(false);
        return;
      }
      const anyNonCorePopulated = allGroups.some((group) => !group.isCloseCircle && group.contacts.length > 0);
      setShowNewCircleOnboardingHint(!anyNonCorePopulated);
    })();
  }, [allGroups, showCoreOnboardingHint]);

  const dismissNewCircleOnboardingHint = () => {
    setShowNewCircleOnboardingHint(false);
    void AsyncStorage.setItem(HAS_SEEN_NEW_CIRCLE_ONBOARDING_HINT_KEY, "true");
  };

  const refreshUnifiedPlatforms = useCallback(async () => {
    setUnifiedPlatforms(await getUnionOfSelectedWiderWorldPlatforms());
  }, []);

  const refreshEmailAccounts = useCallback(async () => {
    setEmailAccounts(await getEmailAccounts());
  }, []);

  const refreshWiderWorldContextMessages = useCallback(async () => {
    const contexts = await getWiderWorldContexts();
    setWiderWorldContextMessages(contexts.map((context) => context.message.trim()).filter(Boolean));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshPeriod();
      void refreshGroups();
      void refreshUnifiedPlatforms();
      void refreshEmailAccounts();
      void refreshWiderWorldContextMessages();
    }, [refreshPeriod, refreshGroups, refreshUnifiedPlatforms, refreshEmailAccounts, refreshWiderWorldContextMessages])
  );

  // The queue only ever grows — every Circle id ever selected joins it and
  // stays, regardless of later deselection.
  useEffect(() => {
    setQueuedGroupIds((current) => {
      let changed = false;
      const next = new Set(current);
      for (const group of selectedGroups) {
        if (!next.has(group.id)) {
          next.add(group.id);
          changed = true;
        }
      }
      return changed ? next : current;
    });
    setQueuedGroups((current) => {
      let changed = false;
      const next = new Map(current);
      for (const group of selectedGroups) {
        if (!next.has(group.id)) {
          next.set(group.id, group);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [selectedGroups]);

  // Every contactId currently excluded (goingQuietRecipients' own
  // included: false) — passed into buildAudienceCircles so the persisted
  // audience actually reflects who was excluded this session, not just
  // who was reassigned elsewhere. Recomputed fresh each render since
  // goingQuietRecipients itself is; not memoised, it's cheap and only
  // read at send()/finish() time regardless. See docs/09-decision-log.md,
  // 2026-08-13.
  const excludedContactIds = new Set(
    goingQuietRecipients.filter((recipient) => !recipient.included).map((recipient) => recipient.contactId)
  );

  // Real bug found and fixed (2026-08-11): this used to fall back to
  // `selectedGroups` for provisional Circles not yet in `allGroups` — but
  // `send()` clears `selectedGroups` back to empty right after sending, so
  // a provisional Circle's own sendChannels entry would drop out of
  // `sentCircleIds` the moment it was deselected, even though it genuinely
  // was sent to — making auto-complete permanently unable to recognise the
  // queue as covered whenever it included a provisional Circle. `queuedGroupIds`
  // never shrinks, so it's the correct thing to union against instead. See
  // docs/09-decision-log.md.
  const knownCircleIds = useMemo(() => {
    const ids = new Set(allGroups.map((group) => group.id));
    for (const id of queuedGroupIds) ids.add(id);
    return ids;
  }, [allGroups, queuedGroupIds]);

  const sentCircleIds = useMemo(() => {
    if (!period?.sendChannels) return [];
    return Object.keys(period.sendChannels).filter((id) => knownCircleIds.has(id));
  }, [period, knownCircleIds]);

  const hasSentAnything = sentCircleIds.length > 0;

  // Corrected 2026-08-21 — this used to call finish() directly the instant
  // every queued Circle was sent, which navigates away immediately
  // (router.replace("/create/done")), silently skipping past the
  // collapsed-by-default OOO/status section without it ever being seen —
  // a real, confirmed bug, and a direct contradiction of the documented
  // rule that OOO/status "always reaches this point before the Transition
  // screen, never skips past it unseen." Reconnect's own equivalent
  // auto-complete only ever reveals more inline content (Personalise
  // prompt, OOO/status) on the same continuously-rendered screen — it
  // never routes away on its own, only an explicit "Done"/"Finish
  // Reconnecting" tap does. Going Quiet now matches that: `hasSentAnything`
  // already reveals Done + OOO/status naturally as circles get sent, with
  // no separate trigger needed for that part — "Done" (below) is the only
  // thing that actually calls finish() and navigates away, guaranteeing
  // OOO/status is at least shown (even collapsed) before that can happen.
  // See docs/09-decision-log.md.

  // Close first, per the send-order rule; every other Circle follows
  // whatever order it was tapped in.
  const orderedSelectedGroups = useMemo(
    () =>
      [...selectedGroups].sort((a, b) => (a.isCloseCircle === b.isCloseCircle ? 0 : a.isCloseCircle ? -1 : 1)),
    [selectedGroups]
  );
  const joinedGroupNames = orderedSelectedGroups.map((group) => group.name).join(", ");
  const isSingleCircle = selectedGroups.length === 1;
  const isSaved = savedDefaultText !== null && message === savedDefaultText;
  const showChips = forceShowChips || (savedDefaultText === null && !message.trim());
  const safeguardingTriggered = useSafeguardingCheck(message);

  // The dropdown arrow is independent of selection (2026-08-14) — a Circle
  // can be previewed without being part of the current send, so this falls
  // back to `allGroups` (the full list, already fetched for the queue check
  // above) rather than only ever finding a currently-selected Circle.
  const expandedGroup = expandedCircleId
    ? (selectedGroups.find((g) => g.id === expandedCircleId) ?? allGroups.find((g) => g.id === expandedCircleId))
    : undefined;
  const isExpandedGroupSelected = expandedGroup
    ? selectedGroups.some((g) => g.id === expandedGroup.id)
    : false;
  // `goingQuietRecipients` only ever has entries for a currently-selected
  // Circle's members (it's built from `selectedGroups`) — an unselected
  // Circle being previewed has no entries there at all, so this falls back
  // to the Circle's own raw `contacts`, synthesised into the same shape,
  // read-only (see RecipientPersonalisation's own `readOnly` prop: there's
  // no meaningful "exclude" action for someone not part of any active send).
  const expandedGroupRecipients: GoingQuietRecipient[] = !expandedGroup
    ? []
    : isExpandedGroupSelected
      ? goingQuietRecipients.filter((recipient) => recipient.circleId === expandedGroup.id)
      : expandedGroup.contacts.map((contact) => ({
          contactId: contact.id,
          name: contact.name,
          phoneNumber: contact.phoneNumber,
          circleId: expandedGroup.id,
          circleName: expandedGroup.name,
          included: true,
          individuallyRemoved: false,
          instantMessage: "",
          routeToPersonalise: false
        }));

  /**
   * "So it's clear at a glance who's no longer included for this flow"
   * (2026-08-20) — scoped to currently-selected Circles only, merged into
   * one line regardless of which one is expanded, since a message can span
   * several selected Circles at once. Purely a passive display list — no
   * bundling/re-circling mechanic reads from it any more (removed
   * 2026-08-30, see docs/09-decision-log.md): giving someone here their own
   * Circle happens only through the ordinary "+ New Circle" flow, with no
   * connection back to this line at all.
   */
  const excludedFromSelected = goingQuietRecipients.filter(
    (recipient) => !recipient.included && selectedGroups.some((group) => group.id === recipient.circleId)
  );

  const activeFieldValue = (): string => {
    if (activeField === "new-circle") return newCircleName;
    if (activeField === "group-message") return message;
    if (activeField === "wider-world-status") return widerWorldText;
    return "";
  };

  const setActiveFieldValue = (text: string) => {
    if (activeField === "new-circle") {
      setNewCircleName(text);
    } else if (activeField === "group-message") {
      setMessage(text);
    } else if (activeField === "wider-world-status") {
      setWiderWorldText(text);
    }
  };

  const activeFieldLabel = (): string => {
    if (activeField === "new-circle") return "New Circle name";
    if (activeField === "group-message") return `Message to ${joinedGroupNames}`;
    if (activeField === "wider-world-status") return "Wider-world status line";
    return "Message";
  };

  /**
   * Reloads the shared message whenever the current Circle-combination
   * changes: a saved default for that exact combination (or, for a single
   * Circle, its existing single-Circle default) auto-loads; a brand-new
   * combination offers single-Circle starting points instead of auto-
   * loading anything, and carries the previous group's edited text forward
   * only when there's no saved default to load.
   */
  const loadMessageForSelection = async (groups: CircleGroup[], previousText: string) => {
    setForceShowChips(false);
    setIntent(null);
    setJustSentText(null);

    if (groups.length === 0) {
      setMessage("");
      setSavedDefaultText(null);
      setStartingPoints([]);
      return;
    }

    if (groups.length === 1) {
      const singleDefault = await getCircleTemplate(groups[0]?.id ?? "");
      setSavedDefaultText(singleDefault);
      setStartingPoints([]);
      setMessage(singleDefault ?? "");
      return;
    }

    const circleIds = groups.map((group) => group.id);
    const comboDefault = await getCombinationTemplate(circleIds);
    if (comboDefault !== null) {
      setSavedDefaultText(comboDefault);
      setStartingPoints([]);
      setMessage(comboDefault);
      return;
    }

    setSavedDefaultText(null);
    const points = await getStartingPointsForCombination(circleIds);
    const nameById = new Map(groups.map((group) => [group.id, group.name]));
    setStartingPoints(
      points.map((point) => ({ ...point, circleName: nameById.get(point.circleId) ?? point.circleId }))
    );
    setMessage(previousText);
  };

  const handleToggleGroup = async (group: CircleGroup) => {
    const isCurrentlySelected = selectedGroups.some((existing) => existing.id === group.id);
    const nextGroups = isCurrentlySelected
      ? selectedGroups.filter((existing) => existing.id !== group.id)
      : [...selectedGroups, group];
    const previousText = message;

    await toggleGroup(group);
    await loadMessageForSelection(nextGroups, previousText);
  };

  /** "All" — replaces the whole selection atomically. See GroupPicker.tsx and docs/09-decision-log.md, 2026-08-11. */
  const handleSetSelection = async (groups: CircleGroup[]) => {
    const previousText = message;
    setSelectedGroups(groups);
    await loadMessageForSelection(groups, previousText);
  };

  const applyStartingPoint = (text: string) => {
    setMessage(text);
    setForceShowChips(false);
  };

  const chooseIntent = async (choice: HoldIntent) => {
    setIntent(choice);
    const recipientNames = selectedGroups.flatMap((group) => group.contacts.map((contact) => contact.name));
    const draftText = await createDraft({ mode: "hold", recipients: recipientNames, intent: choice });
    setMessage(draftText);
    setForceShowChips(false);

    // Mirrors the single-Circle precedent: whatever generic text this
    // produces auto-persists as the default immediately — no separate Save
    // tap needed for the pristine, unedited pick. Applies to combinations
    // too — there's no manual "Save" control offered mid-compose for a
    // combination, only post-send (see the justSent* state above).
    if (selectedGroups.length === 1) {
      const circleId = selectedGroups[0]?.id;
      if (circleId) {
        await saveCircleTemplate(circleId, draftText);
        setSavedDefaultText(draftText);
      }
    } else if (selectedGroups.length > 1) {
      await saveCombinationTemplate(
        selectedGroups.map((group) => group.id),
        draftText
      );
      setSavedDefaultText(draftText);
    }
  };

  const saveSingleCircleDefault = async () => {
    const circleId = selectedGroups[0]?.id;
    if (!isSingleCircle || !circleId) return;

    await saveCircleTemplate(circleId, message);
    setSavedDefaultText(message);
  };

  const saveJustSentSingle = async () => {
    const circleId = justSentGroups[0]?.id;
    if (justSentGroups.length !== 1 || !circleId || justSentText === null) return;

    await saveCircleTemplate(circleId, justSentText);
    setJustSentSaved(true);
  };

  /** "+ Add person" inside a Circle's own dropdown — reuses the same contact-picker + storage call Settings' Manage Circles already uses. See docs/09-decision-log.md, 2026-08-11. */
  const handleAddPerson = async (group: CircleGroup) => {
    const picked = await pickContact();
    if (!picked) return;

    await addContactToGroup(group.id, { name: picked.name, phoneNumber: picked.phoneNumber });
    const refreshed = await getGroup(group.id);
    if (refreshed) updateSelectedGroup(refreshed);
    await refreshGroups();
  };

  /**
   * Creates the pending (not-yet-real) Circle from whatever name is passed
   * in — typed, or a tapped suggestion. Lifted up from GroupPicker so the
   * docked bar's suggestion chips (rendered above the keyboard) and
   * GroupPicker's own "Add" flow trigger the exact same submission. Opens
   * the new Circle's own dropdown immediately after creating it, so "+
   * Add person" is right there to add more than the one founding contact
   * (2026-08-11). See docs/09-decision-log.md.
   */
  const submitNewCircleName = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const picked = await pickContact();
    if (!picked) {
      // A Circle can't be created or saved with zero contacts — without a
      // contact there's nothing valid to create, staged or otherwise.
      return;
    }

    const tempId = `${PENDING_CIRCLE_ID_PREFIX}${Date.now()}`;
    const pendingCircle: CircleGroup = {
      id: tempId,
      name: trimmed,
      isCloseCircle: false,
      contacts: [{ id: `${tempId}-contact`, name: picked.name, phoneNumber: picked.phoneNumber }],
      sendAsGroup: sendAsGroupDraft
    };

    const nextGroups = [...selectedGroups, pendingCircle];
    await toggleGroup(pendingCircle);
    await loadMessageForSelection(nextGroups, message);
    setNewCircleName("");
    setSendAsGroupDraft(false);
    setActiveField(null);
    setExpandedCircleId(tempId);
  };

  /**
   * Sends the current shared message to whichever Circles are currently
   * selected, then clears the selection so the next group can be picked.
   * Only a Circle that actually contributed at least one included
   * recipient to this send gets marked sent. Delivery is individual/BCC-
   * style by default per Circle, or one shared group thread for a Circle
   * with its own `sendAsGroup` turned on — each Circle in this combination
   * follows its own setting independently within this one Send action
   * (2026-08-11, corrects the earlier one-shared-message-for-everyone
   * behaviour). See docs/09-decision-log.md.
   */
  const send = async () => {
    const text = message.trim();
    if (!text || selectedGroups.length === 0) return;

    const periodId = period?.id ?? (await startHoldPeriod({
      recipients,
      audienceCircles: buildAudienceCircles(selectedGroups, recipientCircleOverrides, excludedContactIds)
    }));

    const recipientsByCircle = new Map<string, GoingQuietRecipient[]>();
    for (const recipient of goingQuietRecipients) {
      const list = recipientsByCircle.get(recipient.circleId) ?? [];
      list.push(recipient);
      recipientsByCircle.set(recipient.circleId, list);
    }

    // Matched by phone number, same principle as the reconciliation fix
    // above — GoingQuietRecipient doesn't carry preferredChannel itself
    // (it's rebuilt fresh from selectedGroups each render), so this looks
    // it up from the live CircleContact records instead of duplicating the
    // field onto a second, parallel recipient type.
    const preferredChannelByPhone = new Map(
      selectedGroups.flatMap((group) => group.contacts.map((contact) => [contact.phoneNumber, contact.preferredChannel] as const))
    );

    const deliveryTargets = selectedGroups
      .map((group) => ({
        circleId: group.id,
        sendAsGroup: group.sendAsGroup ?? false,
        contacts: (recipientsByCircle.get(group.id) ?? [])
          .filter((recipient) => recipient.included)
          .map((recipient) => ({
            phoneNumber: recipient.phoneNumber,
            preferredChannel: preferredChannelByPhone.get(recipient.phoneNumber)
          }))
      }))
      .filter((target) => target.contacts.length > 0);

    const defaultChannel = await getDefaultSendingChannel();
    const channelByCircle = await sendToCircles(deliveryTargets, text, defaultChannel);
    for (const [circleId, channel] of channelByCircle) {
      await recordSendChannel(periodId, circleId, channelKey(channel));
    }

    const sentGroups = selectedGroups;
    const wasCombo = selectedGroups.length > 1;
    if (wasCombo) {
      await saveCombinationTemplate(selectedGroups.map((group) => group.id), text);
      // These Circles just received one combined message together — Going
      // Quiet's own trigger for the linked-circles (Olympic-rings) mechanic
      // already built for Taking Time's "Send an Update", extended here.
      // Period-scoped, not a permanent relationship between these Circles
      // — see HoldPeriod.linkedCircleSets. No cluster rendering added to
      // Going Quiet itself: it only ever creates the link, never consumes
      // it (that's Reconnect's instant-message screen and Conversations).
      // See docs/09-decision-log.md.
      await linkCirclesInPeriod(selectedGroups.map((group) => group.id));
    }

    await refreshPeriod();

    // Clear the current selection back to empty so the next group can be
    // picked, and show the just-sent state in its place.
    for (const group of selectedGroups) {
      await toggleGroup(group);
    }
    setJustSentText(text);
    setJustSentGroups(sentGroups);
    setJustSentSaved(wasCombo);
    setMessage("");
    setSavedDefaultText(null);
    setStartingPoints([]);
    setIntent(null);
  };

  const finish = async () => {
    // Real out-of-office activation now happens per-account, immediately,
    // on tap — see toggleMarkedPlatform above — not batched here at Done.
    if (widerWorldEnabled && widerWorldText.trim()) {
      await copyToClipboard(widerWorldText.trim());
    }

    // Catches any Circle added to the selection after the first Send —
    // without this, it would never make it into the period's
    // audienceCircles, and Reconnect would never know to ask about it.
    // Must read from `queuedGroups` (every Circle queued this session), not
    // `selectedGroups` — the latter is usually already empty by the time
    // finish() runs, since send() clears it right after sending.
    await syncAudience({
      recipients,
      audienceCircles: buildAudienceCircles(Array.from(queuedGroups.values()), recipientCircleOverrides, excludedContactIds)
    });

    const markedEmailAccounts = emailAccounts.filter(
      (account) => markedPlatformIds.has(account.id) && account.linkedAt !== undefined
    );
    const markedSocialPlatformIds = unifiedPlatforms
      .filter((platform) => platform.kind !== "email" && markedPlatformIds.has(platform.id))
      .map((platform) => platform.id);

    await recordPostSendChoices({
      emailOutOfOfficeEnabled: markedEmailAccounts.length > 0,
      emailLinkedAccounts: markedEmailAccounts.map((account) => ({ id: account.id, provider: account.provider })),
      widerWorldStatusEnabled: widerWorldEnabled || markedSocialPlatformIds.length > 0,
      widerWorldPostedPlatforms: markedSocialPlatformIds
    });

    router.replace("/create/done");
  };

  const doneButton = hasSentAnything ? (
    <SecondaryButton label="Done" onPress={() => void finish()} />
  ) : null;

  return (
    <Screen
      contentContainerStyle={styles.content}
      dockedInput={
        activeField ? (
          <DockedInputBar
            value={activeFieldValue()}
            onChangeText={setActiveFieldValue}
            onDone={() => {
              if (activeField === "new-circle") {
                void submitNewCircleName(newCircleName);
              } else if (activeField === "group-message") {
                // Sends immediately — no intermediate "return to preview"
                // step. Fewer taps between done-typing and sent matters
                // directly here (2026-08-11). See docs/09-decision-log.md.
                void send();
                setActiveField(null);
              } else {
                setActiveField(null);
              }
            }}
            onDismiss={() => {
              if (activeField === "new-circle") {
                setNewCircleName("");
                setSendAsGroupDraft(false);
              }
              setActiveField(null);
            }}
            placeholder={activeFieldLabel()}
            accessibilityLabel={activeFieldLabel()}
            suggestions={
              activeField === "new-circle"
                ? SUGGESTED_CIRCLES.map((name) => ({
                    label: name,
                    onPress: () => void submitNewCircleName(name)
                  }))
                : undefined
            }
            extraPhrases={activeField === "wider-world-status" ? widerWorldContextMessages : undefined}
            aiAmend={
              activeField === "group-message"
                ? { surface: "going-quiet", context: { intent: intent ?? undefined, recipientLabel: joinedGroupNames } }
                : activeField === "wider-world-status"
                  ? { surface: "wider-world-status" }
                  : undefined
            }
            template={
              activeField === "group-message" && savedDefaultText !== null ? { text: savedDefaultText } : undefined
            }
            saveDefault={
              activeField === "group-message" && isSingleCircle
                ? { isSaved, onSave: () => void saveSingleCircleDefault() }
                : undefined
            }
          />
        ) : null
      }
    >
      <StepHeader title="Who needs to know?" />

      {/* Bold-on-tap, no persistence — resets to off every time this screen
          is entered fresh, matching Core's own "no in-the-moment choice
          while unwell" reasoning generalised to every Circle. See
          GroupPicker's own adjustMode comment, docs/09-decision-log.md,
          2026-08-30. */}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: adjustMode }}
        accessibilityLabel={adjustMode ? "Adjust, on" : "Adjust"}
        hitSlop={8}
        onPress={() => setAdjustMode((current) => !current)}
        style={styles.adjustToggle}
      >
        <Text style={[styles.adjustToggleText, adjustMode && styles.adjustToggleTextActive]}>Adjust</Text>
      </Pressable>

      <GroupPicker
        selectedGroupIds={selectedGroups.map((group) => group.id)}
        onToggle={handleToggleGroup}
        onSetSelection={(groups) => void handleSetSelection(groups)}
        sentCircleIds={sentCircleIds}
        expandedCircleId={expandedCircleId}
        onToggleExpanded={(circleId) =>
          setExpandedCircleId((current) => (current === circleId ? null : circleId))
        }
        isNamingActive={activeField === "new-circle"}
        onActivateNaming={() => setActiveField("new-circle")}
        onCancelNaming={() => {
          setNewCircleName("");
          setSendAsGroupDraft(false);
          setActiveField(null);
        }}
        sendAsGroupDraft={sendAsGroupDraft}
        onToggleSendAsGroupDraft={setSendAsGroupDraft}
        isComposing={activeField === "group-message"}
        showCoreOnboardingHint={showCoreOnboardingHint}
        onCoreOnboardingAdd={() => void addCoreOnboardingContact()}
        onDismissCoreOnboardingHint={dismissCoreOnboardingHint}
        showNewCircleOnboardingHint={showNewCircleOnboardingHint}
        onDismissNewCircleOnboardingHint={dismissNewCircleOnboardingHint}
        adjustMode={adjustMode}
      />

      {/* At-a-glance excluded-for-this-send line — scoped to currently
          selected Circles only, merged into one line. 100% passive plain
          text: no chip/pill styling, no border, no background, no tap
          target, no bundling mechanic connected to it at all (removed
          2026-08-30). Its only job is showing who isn't currently being
          sent to — giving someone here their own Circle happens purely
          through the ordinary "+ New Circle" flow, unrelated to this line.
          See docs/09-decision-log.md. */}
      {excludedFromSelected.length > 0 ? (
        <Text style={styles.excludedLineText} accessibilityRole="text">
          {excludedFromSelected.map((recipient) => recipient.name).join(", ")}
        </Text>
      ) : null}

      {expandedGroup ? (
        <View style={styles.circleSection}>
          <Text style={styles.sectionLabel}>{expandedGroup.name}</Text>
          <RecipientPersonalisation
            recipients={expandedGroupRecipients}
            onToggleIncluded={(contactId) => toggleRecipientIncluded(contactId, message)}
            onAddPerson={() => void handleAddPerson(expandedGroup)}
            readOnly={!isExpandedGroupSelected}
          />
        </View>
      ) : null}

      {selectedGroups.length > 0 ? (
        <>
          {showChips ? (
            <>
              {startingPoints.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.startingPointsRow}
                >
                  {startingPoints.map((point) => (
                    <Pressable
                      key={point.circleId}
                      accessibilityRole="button"
                      onPress={() => applyStartingPoint(point.text)}
                      style={styles.startingPointChip}
                    >
                      <Text style={styles.startingPointChipText}>Start from {point.circleName}'s message</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}

              <View accessibilityRole="radiogroup" style={styles.choices}>
                {HOLD_INTENTS.map((choice) => (
                  <ChoiceCard
                    key={choice.id}
                    title={choice.title}
                    description={choice.description}
                    selected={intent === choice.id}
                    onPress={() => void chooseIntent(choice.id)}
                  />
                ))}
              </View>
            </>
          ) : (
            <View style={styles.messageBlock}>
              <DockedFieldPreview
                value={message}
                placeholder={`Message to ${joinedGroupNames}`}
                isActive={activeField === "group-message"}
                onPress={() => setActiveField("group-message")}
                accessibilityLabel={`Message to ${joinedGroupNames}`}
                onInsertPill={(text) => setMessage((current) => (current.trim() ? `${current}\n${text}` : text))}
                highlightAll={isSaved}
              />
              {/* "Change template" (setForceShowChips) cut entirely,
                  2026-08-13 — superseded by sentence pills, which solve
                  the same "I doubt my default wording" need more simply.
                  See docs/09-decision-log.md.
                  Template — Send — Save, one row, 2026-08-19: Send moved
                  in from its own separate row below (confirmed layout,
                  proposed before building per direct instruction — Send
                  is irreversible, unlike Template/Save which are freely
                  reversible/repeatable, so it must stay visually distinct
                  even sharing the row). Template/Save stay plain text
                  links; Send is CompactSendButton, already the app's one
                  filled/primary-coloured send treatment, unchanged —
                  reusing it here rather than inventing a second "this is
                  the important one" visual language. justifyContent:
                  "space-between" naturally lands exactly 3 children as
                  start/center/end, which is what puts Send visually
                  central without needing a different layout strategy;
                  Template/Save's own slots stay empty-View-when-absent,
                  same reasoning as before, so Send doesn't drift off-
                  centre depending on which of the other two exist. Only
                  rendered once there's a message box (this branch);
                  during intent-picking, `message` is always empty
                  (`showChips` is only ever true then), so Send wasn't
                  meaningfully actionable there before either — same
                  `disabled` gate as before, just no longer separately
                  visible-but-disabled during that phase. Template here is
                  a plain insert (like this box's own pill row above it) —
                  the green-highlight/revert-on-edit version lives in
                  DockedInputBar once the bar is actually open; this box
                  has no such tracking, matching how its pills already
                  behave. */}
              <View style={styles.messageControls}>
                {savedDefaultText !== null ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Template"
                    onPress={() =>
                      setMessage((current) => (current.trim() ? `${current}\n${savedDefaultText}` : savedDefaultText))
                    }
                    style={styles.templateInlineButton}
                  >
                    <Ionicons name="book-outline" size={16} color={colors.link} />
                    <Text style={styles.linkText}>Template</Text>
                  </Pressable>
                ) : (
                  <View />
                )}
                <CompactSendButton
                  disabled={!message.trim()}
                  accessibilityLabel={`Send to ${joinedGroupNames}`}
                  onPress={() => void send()}
                />
                {isSingleCircle ? (
                  isSaved ? (
                    <View style={styles.savedPill} accessibilityRole="text">
                      <Text style={styles.savedPillText}>✓ Saved</Text>
                    </View>
                  ) : (
                    <Pressable accessibilityRole="button" onPress={() => void saveSingleCircleDefault()}>
                      <Text style={styles.linkText}>Save</Text>
                    </Pressable>
                  )
                ) : (
                  <View />
                )}
              </View>

              <SafeguardingBanner visible={safeguardingTriggered} />
            </View>
          )}

        </>
      ) : justSentText !== null ? (
        <View style={styles.messageBlock}>
          <View style={styles.sentTextBox}>
            <Text style={styles.sentTextLabel}>Sent to {justSentGroups.map((g) => g.name).join(", ")}</Text>
            <Text style={styles.sentText}>{justSentText}</Text>
          </View>
          <View style={styles.messageControls}>
            {justSentGroups.length === 1 ? (
              justSentSaved ? (
                <View style={styles.savedPill} accessibilityRole="text">
                  <Text style={styles.savedPillText}>✓ Saved to Library</Text>
                </View>
              ) : (
                <Pressable accessibilityRole="button" onPress={() => void saveJustSentSingle()}>
                  <Text style={styles.linkText}>Save to Library</Text>
                </Pressable>
              )
            ) : (
              <View style={styles.savedPill} accessibilityRole="text">
                <Text style={styles.savedPillText}>✓ Saved as Template</Text>
              </View>
            )}
          </View>
        </View>
      ) : null}

      {hasSentAnything ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: oooExpanded }}
            onPress={() => setOooExpanded((current) => !current)}
            style={styles.oooHeader}
          >
            <Text style={styles.oooHeaderText}>Wider World</Text>
            <Text style={styles.oooChevron}>{oooExpanded ? "▲" : "▼"}</Text>
          </Pressable>

          {oooExpanded ? (
            <View style={styles.oooBody}>
              <WiderWorldStatus
                enabled={widerWorldEnabled}
                onToggleEnabled={setWiderWorldEnabled}
                text={widerWorldText}
                onChangeText={setWiderWorldText}
                isActive={activeField === "wider-world-status"}
                onActivate={() => setActiveField("wider-world-status")}
                onCopied={() => setShowWiderWorldPostedTo(true)}
              />

              {/*
               * Unified platform row (social + linked email accounts),
               * built 2026-08-30 — replaces the old separate
               * EmailOutOfOffice account-list UI and the old flat-list-
               * sourced "Where did you post this?" checklist. Revealed
               * once Status is actually copied, not the moment its toggle
               * turns on. Nothing shows if nothing's configured across any
               * Wider World Context yet. See docs/09-decision-log.md.
               */}
              {showWiderWorldPostedTo ? (
                <WiderWorldPlatformRow
                  label="Where did you post this? (email accounts activate their real out-of-office when marked)"
                  platforms={unifiedPlatforms}
                  markedIds={markedPlatformIds}
                  onToggle={(platform) => void toggleMarkedPlatform(platform)}
                  onAddCustom={addAndMarkCustomPlatform}
                  onMarkAll={markAllPlatforms}
                />
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}

      {/* Done — a genuinely separate concept from Send (early exit vs. the
          compose row's own primary action). One render site, after Wider
          World, matching the confirmed completion-screen order (2026-08-13):
          collapsed instant-message area → circle row → Wider World → Done.
          Previously rendered twice, both times before Wider World —
          consolidated 2026-08-29 (item 5). Only ever renders once
          something's actually been sent this session. */}
      {doneButton ? <View style={styles.sendRow}>{doneButton}</View> : null}
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: theme.spacing.lg
    },
    adjustToggle: {
      alignSelf: "flex-end",
      marginTop: -theme.spacing.md
    },
    adjustToggleText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "600"
    },
    adjustToggleTextActive: {
      color: colors.text,
      fontWeight: "800"
    },
    excludedLineText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20
    },
    circleSection: {
      gap: theme.spacing.sm
    },
    sectionLabel: {
      color: colors.text,
      fontSize: 17,
      lineHeight: 23,
      fontWeight: "600",
      letterSpacing: -0.2
    },
    choices: {
      gap: theme.spacing.sm
    },
    startingPointsRow: {
      flexDirection: "row",
      gap: theme.spacing.sm
    },
    startingPointChip: {
      minHeight: 36,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: colors.primary,
      paddingHorizontal: theme.spacing.md,
      alignItems: "center",
      justifyContent: "center"
    },
    startingPointChipText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600"
    },
    sendRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: theme.spacing.sm
    },
    messageBlock: {
      gap: theme.spacing.xs
    },
    // justifyContent: "space-between", not just a row with gap — Save to
    // Library (left) and Template (right) both always need to land on
    // their own explicit side regardless of which one happens to be
    // absent, not drift based on which single child happens to be
    // present. See docs/09-decision-log.md, 2026-08-13.
    messageControls: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between"
    },
    templateInlineButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4
    },
    linkText: {
      color: colors.link,
      fontSize: 14,
      fontWeight: "600"
    },
    savedPill: {
      minHeight: 28,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.surfaceStrong
    },
    savedPillText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600"
    },
    sentTextBox: {
      gap: theme.spacing.xs,
      padding: theme.spacing.sm,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surfaceStrong
    },
    sentTextLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600"
    },
    sentText: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 22
    },
    oooHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 44
    },
    oooHeaderText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600"
    },
    oooChevron: {
      color: colors.textMuted,
      fontSize: 13
    },
    oooBody: {
      gap: theme.spacing.md
    },
    widerWorldPostedToBlock: {
      gap: theme.spacing.sm
    },
    widerWorldPostedToLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600"
    },
    chipRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
    }
  });
}
