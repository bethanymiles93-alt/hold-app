import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { SecondaryButton } from "@/components/SecondaryButton";
import { DockedInputBar } from "@/components/DockedInputBar";
import { DockedFieldPreview } from "@/components/DockedFieldPreview";
import { MemoryNoteSuggestion } from "@/components/MemoryNoteSuggestion";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { DropdownArrowBadge } from "@/components/DropdownArrowBadge";
import { HoldMark } from "@/components/HoldMark";
import { ConversationsView } from "@/components/ConversationsView";
import { LinkedCircleCluster, LinkGroupToggle, type LinkedClusterMember } from "@/components/LinkedCircleCluster";
import { PENDING_CIRCLE_ID_PREFIX } from "@/components/GroupPicker";
import { NEWLY_ADDED_APOLOGY_PHRASE } from "@/services/circleService";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useConversations } from "@/hooks/useConversations";
import { useHoldFlow } from "@/context/HoldFlowContext";
import { resolveLinkedClusters } from "@/utils/linkedCircleClusters";
import { combinationKey } from "@/services/templateService";
import {
  addToReconnectingAudience,
  beginReconnecting,
  getHoldPeriodById,
  getReconnectCoverage,
  getReconnectingPeriod,
  markEmailAccountTurnedOff,
  markReconnectContacted,
  markWiderWorldTakenDown,
  recordReconnectStepReached,
  recordSendChannel,
  renameCircleInPeriod,
  resolvePendingCircleInPeriod,
  setLinkClusterGrouped,
  updateAudienceCircleContacts
} from "@/services/holdHistoryService";
import {
  getAll as getAllConversationPeople,
  markContacted,
  seedFromAudience
} from "@/services/conversationService";
import {
  addContactToGroup,
  CLOSE_CIRCLE_ID,
  createGroup,
  getGroup,
  getGroups,
  removeContactFromGroup,
  renameGroup
} from "@/services/circleService";
import { pickContact } from "@/services/contactPickerService";
import { deactivateOutOfOffice, getEmailAccounts } from "@/services/emailAccountService";
import {
  getSelectableWiderWorldPlatforms,
  type SelectableWiderWorldPlatform
} from "@/services/widerWorldContextService";
import { WiderWorldPlatformRow } from "@/components/WiderWorldPlatformRow";
import { channelKey, sendIndividual, sendToCircles } from "@/services/smsService";
import { getDefaultSendingChannel } from "@/services/sendingPreferencesService";
import {
  getReconnectCircleTemplate,
  getReconnectCombinationTemplate,
  saveReconnectCircleTemplate,
  saveReconnectCombinationTemplate
} from "@/services/reconnectTemplateService";
import { clearDraft, getDraft, saveDraft } from "@/services/messageDraftService";
import type { AudienceCircle, AudienceContact, CircleGroup, EmailAccount, HoldPeriod } from "@/types/hold";

const RECONNECT_DRAFT_KEY = "reconnect";
// Reconnect's own default starting text — short and instant, not a fully
// redrafted reply (that's what Personalise/Conversations is for). Replaces
// the old QUICK_RECONNECT_MESSAGES-driven default (2026-08-13); that
// constant and Library's own separate use of it are untouched. See
// docs/09-decision-log.md.
const DEFAULT_RECONNECT_MESSAGE = "I'm getting there, will send a proper response soon.";

export default function ReconnectScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { reconnectPeriodId, resetFlow } = useHoldFlow();

  /** Always a brand-new Going Quiet flow, never a variant of "Add to Going Quiet" — matches Home's own "start" function exactly (same resetFlow + push pair). See docs/09-decision-log.md, 2026-08-29 (item 4). */
  const goQuietAgain = () => {
    resetFlow("hold");
    router.push("/create/people");
  };

  const [period, setPeriod] = useState<HoldPeriod | null>(null);
  const [message, setMessage] = useState(DEFAULT_RECONNECT_MESSAGE);
  const [savedDefaultText, setSavedDefaultText] = useState<string | null>(null);
  const [statusCleared, setStatusCleared] = useState(false);
  /** Purely local acknowledgment for the "no real linked accounts, manual reminder only" case — nothing to deactivate, so nothing to persist; doesn't gate the exit-nudge (see oooUnresolved below, which only checks real linked accounts). */
  const [manualEmailReminderAcknowledged, setManualEmailReminderAcknowledged] = useState(false);
  /** Loaded once, independent of refresh()'s own period-reload cycle — these are global user settings, not period data. See docs/09-decision-log.md, 2026-08-21. */
  const [widerWorldPlatforms, setWiderWorldPlatforms] = useState<SelectableWiderWorldPlatform[]>([]);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  useEffect(() => {
    // Reads the same selectable pool (presets + custom + linked email
    // accounts) Going Quiet's own unified platform row reads from
    // (2026-08-30) — was the old flat WiderWorldPlatform list, which no
    // longer overlapped with the ids Going Quiet actually marks.
    void getSelectableWiderWorldPlatforms().then(setWiderWorldPlatforms);
    // Real labels for period.emailLinkedAccounts (id+provider only) — the
    // durable account records live in Settings, not on the period itself.
    void getEmailAccounts().then(setEmailAccounts);
  }, []);
  /** A memory note's text, staged for a one-shot highlighted insert into the docked bar — see DockedInputBar's own pendingInsert prop. Corrected 2026-08-21: used to feed AI-amend's initialPrompt instead, which silently made stale note text an unreviewed AI input rather than clearly-marked inserted content. */
  const [pendingMemoryInsert, setPendingMemoryInsert] = useState<string | undefined>(undefined);
  // Collapsed by default — 2026-08-13 confirmed correction, superseding
  // the 2026-08-12 entry that had flipped this to expanded for this exact
  // moment. Explicitly re-confirmed, not a silent re-reversal: an open
  // section every time someone returns to a resumed Reconnect read as too
  // much clutter; genuinely unresolved Wider World state is now instead
  // surfaced once, at the point of leaving (see the beforeRemove nudge
  // below), not by defaulting this open on every visit. See
  // docs/09-decision-log.md.
  const [oooExpanded, setOooExpanded] = useState(false);
  const [messageFieldActive, setMessageFieldActive] = useState(false);
  const [showPersonalise, setShowPersonalise] = useState(false);
  // Declining Personalise no longer finishes Reconnect (that's "Done" now,
  // below) — it just collapses this inline choice, reopenable via the same
  // dropdown-arrow "reveal on demand" pattern used elsewhere. See
  // docs/09-decision-log.md, 2026-08-12.
  const [notNowCollapsed, setNotNowCollapsed] = useState(false);
  /**
   * Same Conversations implementation Library's own standalone tab uses
   * (2026-08-20 unification) — scoped to just this period's own audience,
   * both Circle members and ungrouped contacts, rather than a separate
   * bespoke Personalise-only list. onPersonAction records this session's
   * "personalise_completed" step, same as the old onSent wiring did. See
   * docs/09-decision-log.md.
   */
  const conversationsCandidates = period
    ? [
        ...(period.audienceCircles ?? []).flatMap((circle) =>
          circle.contacts.map((contact) => ({
            name: contact.name,
            phoneNumber: contact.phoneNumber,
            circleId: circle.circleId,
            circleName: circle.circleName
          }))
        ),
        ...(period.audienceUngrouped ?? []).map((contact) => ({
          name: contact.name,
          phoneNumber: contact.phoneNumber,
          circleId: null,
          circleName: null
        }))
      ]
    : [];
  // linkedCircleSets/ungroupedLinkKeys carry the linked-circles
  // grouped/ungrouped choice made above, in the circle row, into
  // Conversations too (2026-08-21) — "reflects whatever state was left at
  // Reconnect's instant-message stage," not a separate decision point.
  // See docs/09-decision-log.md.
  const conversations = useConversations(
    {
      candidates: conversationsCandidates,
      linkedCircleSets: period?.linkedCircleSets,
      ungroupedLinkKeys: period?.ungroupedLinkKeys
    },
    () => {
      if (period) void recordReconnectStepReached(period.id, "personalise_completed");
    }
  );

  /**
   * Per-person pill-selection model (2026-08-13), replacing the old
   * circle-granular selectedIds entirely — a circle no longer has an
   * independently-tracked "in/out" flag; whether it's "in" the message is
   * derived purely from whether any of its own people are currently
   * included. Three pieces:
   * - expandedCircleIds: pure visibility (arrow-driven) — which circles'
   *   people currently show as pills in the shared row. Never affects
   *   inclusion.
   * - includedPersonIds: who's actually getting this message, by phone
   *   number (the one id every recipient has, grouped or not). Seeded
   *   fresh every refresh() (not-yet-contacted defaults to included,
   *   already-contacted defaults to excluded — matching the app's
   *   established "sent isn't auto-reselected" convention), then freely
   *   adjustable via the Circle chip (bulk toggle), an individual pill, or
   *   "All" until the next Send resets it.
   * - pillLockedIds: a snapshot of includedPersonIds taken the moment
   *   focus first leaves the row this round (text box opens, an arrow is
   *   tapped, or anywhere else is tapped) — drives reorder (included-at-
   *   lock-time float to front) and grey-out, mirroring Going Quiet's own
   *   composingActiveIds pattern. Reset (unlocked) by refresh(), not by
   *   closing the text box — the grey/lock state is meant to hold for the
   *   whole round, up to the next actual Send. See docs/09-decision-log.md,
   *   2026-08-13.
   */
  const [expandedCircleIds, setExpandedCircleIds] = useState<Set<string>>(new Set());
  const [includedPersonIds, setIncludedPersonIds] = useState<Set<string>>(new Set());
  const [pillLockedIds, setPillLockedIds] = useState<string[] | null>(null);
  /**
   * Real-Circle membership editing, staged then committed via "Save
   * changes" — mirrors Manage Circles' own stagedExcludedByCircle/
   * stagedAdditionsByCircle exactly (same circleService calls, same
   * interaction shape), confirmed as the deliberate spec, not something to
   * reconcile toward Going Quiet's own fully-locked "Adjust" model: Going
   * Quiet stays locked because it's the highest-tension moment; Reconnect
   * keeps real editing because there's typically more capacity by the time
   * someone's reconnecting. Keyed by circle id, scoped to non-pending
   * Circles only — a still-pending Circle isn't a real Circle yet. See
   * docs/09-decision-log.md, 2026-08-30.
   */
  const [stagedExcludedByCircle, setStagedExcludedByCircle] = useState<Record<string, Set<string>>>({});
  const [stagedAdditionsByCircle, setStagedAdditionsByCircle] = useState<Record<string, AudienceContact[]>>({});

  /**
   * Circles freshly made real from Going Quiet's ad-hoc bundling flow,
   * still carrying their auto-generated initials placeholder name — the
   * optional rename opportunity (2026-08-13) offers to change it, or
   * confirms leaving it as-is; either way is final, not a recurring nag.
   * See docs/09-decision-log.md.
   */
  const [needsNamingGroups, setNeedsNamingGroups] = useState<CircleGroup[]>([]);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const refresh = useCallback(async () => {
    // Prefer the durable marker (force-quit-resume, or any visit after the first
    // genuine send). Before that marker exists — the very first visit this
    // session, or a resumed visit after backing out earlier without sending —
    // fall back to reading the period directly by the id context carried here
    // from Home, so the picker still has data with nothing durable written yet.
    const durable = await getReconnectingPeriod();
    let current = durable ?? (reconnectPeriodId ? await getHoldPeriodById(reconnectPeriodId) : null);

    if (current) {
      // Bundled Circles are made real immediately, unconditionally — no
      // more yes/no "should this exist" gate (2026-08-13). They already
      // exist, fully formed, with their auto-generated placeholder name,
      // from this moment on; only an optional rename remains, offered
      // later in the flow (see needsNamingGroups below).
      const resolvedPendingCircleIds = current.resolvedPendingCircleIds ?? [];
      const stillPending = (current.audienceCircles ?? []).filter(
        (circle) =>
          circle.circleId.startsWith(PENDING_CIRCLE_ID_PREFIX) &&
          !resolvedPendingCircleIds.includes(circle.circleId) &&
          circle.contacts.length > 0
      );

      for (const circle of stillPending) {
        const group = await createGroup(circle.circleName, false, true);
        for (const contact of circle.contacts) {
          await addContactToGroup(group.id, contact);
        }
        await resolvePendingCircleInPeriod(current.id, circle.circleId, {
          circleId: group.id,
          circleName: group.name
        });
      }

      if (stillPending.length > 0) {
        current = await getHoldPeriodById(current.id);
      }
    }

    setPeriod(current);

    const allGroups = await getGroups();
    setNeedsNamingGroups(allGroups.filter((group) => group.needsNaming));

    if (current) {
      // Corrected 2026-08-21 — this used to default to "everyone not yet
      // contacted," which on a fresh load is literally everyone, reading
      // as "All" pre-selected with no tap made. Matches the original pill
      // mechanics spec exactly now: nothing is selected until the person
      // taps something — a Circle chip selects only that Circle's own
      // people, "All" is the only action that selects everyone. See
      // docs/09-decision-log.md.
      setIncludedPersonIds(new Set());
      setPillLockedIds(null);
    }
  }, [reconnectPeriodId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useEffect(() => {
    void getDraft(RECONNECT_DRAFT_KEY).then((draft) => {
      if (draft) setMessage(draft);
    });
  }, []);

  const changeMessage = (text: string) => {
    setMessage(text);
    void saveDraft(RECONNECT_DRAFT_KEY, text);
  };

  // One-time gentle check at the point of leaving, not a default-open
  // section on every visit (2026-08-13, confirming/correcting the
  // 2026-08-12 default-expanded decision above) — "unresolved" is OOO
  // still on and not yet turned off, or the wider-world status still
  // active and not yet cleared. `beforeRemove` fires for any way of
  // leaving (back button; the swipe gesture itself is unconditionally
  // disabled on this screen now, so this is effectively the back-button
  // path), lets the leave be paused with e.preventDefault(), and — if the
  // person still chooses to leave — replayed via navigation.dispatch(
  // e.data.action) rather than re-implementing the original navigation.
  // Checks the real per-platform takedown checklist now (2026-08-21) —
  // this used to only check the one combined wider-world status toggle,
  // since the checklist itself didn't exist yet. See
  // docs/09-decision-log.md.
  const navigation = useNavigation();

  useEffect(() => {
    return navigation.addListener("beforeRemove", (e) => {
      if (!period) return;

      const linkedAccountIds = (period.emailLinkedAccounts ?? []).map((account) => account.id);
      const turnedOffAccountIds = period.widerWorldEmailTurnedOffAccountIds ?? [];
      // Same "resolved means every one checked off" pattern as status
      // below, now that email is per-account too (2026-08-30) — no
      // linked accounts at all falls back to nothing-to-resolve (true),
      // matching the pre-existing behaviour for an OOO-enabled-but-manual
      // (no real linked accounts) period, which never had a per-account
      // list to check off in the first place.
      const oooUnresolved =
        period.emailOutOfOfficeEnabled &&
        linkedAccountIds.length > 0 &&
        linkedAccountIds.some((id) => !turnedOffAccountIds.includes(id));
      const postedIds = period.widerWorldPostedPlatforms ?? [];
      const takenDownIds = period.widerWorldTakenDownPlatforms ?? [];
      // With any platforms actually marked posted-to, "resolved" means
      // every one of them has been checked off — the fallback single
      // "Clear my status" link (no platforms posted-to) still uses
      // statusCleared, the same as before.
      const statusUnresolved =
        period.widerWorldStatusEnabled &&
        (postedIds.length > 0 ? postedIds.some((id) => !takenDownIds.includes(id)) : !statusCleared);
      if (!oooUnresolved && !statusUnresolved) return;

      e.preventDefault();
      Alert.alert("Want to loop in/update the Wider World before you go?", undefined, [
        {
          text: "Leave anyway",
          style: "cancel",
          onPress: () => navigation.dispatch(e.data.action)
        },
        {
          text: "Open Wider World",
          onPress: () => setOooExpanded(true)
        }
      ]);
    });
  }, [navigation, period, statusCleared]);

  const coverage = period ? getReconnectCoverage(period) : null;

  // Which Circles are actually contributing to the message right now —
  // Reconnect's own equivalent of Going Quiet's selectedGroups, derived
  // rather than directly toggled, since inclusion here is per-person. The
  // right template to load/save against is keyed off this set, same
  // single-Circle vs. sorted-combination split templateService.ts already
  // uses for Going Quiet. See docs/09-decision-log.md, 2026-08-13.
  const contributingCircleIds = useMemo(() => {
    if (!period) return [];
    return (period.audienceCircles ?? [])
      .filter((circle) => circle.contacts.some((contact) => includedPersonIds.has(contact.phoneNumber)))
      .map((circle) => circle.circleId);
  }, [period, includedPersonIds]);
  const contributingSignature = [...contributingCircleIds].sort().join(",");
  const isSingleCircle = contributingCircleIds.length === 1;
  /**
   * True while at least one currently-included person belongs to a
   * "+"-added, not-originally-told Circle — offers the apology phrase as
   * one of the docked bar's suggestion pills, never the default wording.
   * See docs/09-decision-log.md, 2026-08-20.
   */
  const hasNewlyAddedIncluded = (period?.audienceCircles ?? []).some(
    (circle) =>
      circle.circleId.startsWith(PENDING_CIRCLE_ID_PREFIX) &&
      circle.contacts.some((contact) => includedPersonIds.has(contact.phoneNumber))
  );
  const messageExtraPhrases = hasNewlyAddedIncluded ? [NEWLY_ADDED_APOLOGY_PHRASE] : [];
  const isSaved = savedDefaultText !== null && message === savedDefaultText;

  useEffect(() => {
    void (async () => {
      if (contributingCircleIds.length === 0) {
        setSavedDefaultText(null);
        return;
      }

      if (contributingCircleIds.length === 1) {
        const single = await getReconnectCircleTemplate(contributingCircleIds[0] ?? "");
        setSavedDefaultText(single);
        setMessage(single ?? DEFAULT_RECONNECT_MESSAGE);
        return;
      }

      const combo = await getReconnectCombinationTemplate(contributingCircleIds);
      setSavedDefaultText(combo);
      setMessage(combo ?? DEFAULT_RECONNECT_MESSAGE);
    })();
    // contributingCircleIds is a fresh array every render; contributingSignature
    // is the real, stable dependency — only reload when the actual set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contributingSignature]);

  const saveCurrentAsTemplate = async () => {
    if (contributingCircleIds.length === 0) return;

    if (contributingCircleIds.length === 1) {
      await saveReconnectCircleTemplate(contributingCircleIds[0] ?? "", message);
    } else {
      await saveReconnectCombinationTemplate(contributingCircleIds, message);
    }
    setSavedDefaultText(message);
  };

  /** First qualifying trigger this round only — see the state comment above. */
  const lockPillSelection = () => {
    setPillLockedIds((current) => current ?? Array.from(includedPersonIds));
  };

  const openMessageField = () => {
    setMessageFieldActive(true);
    lockPillSelection();
  };

  const toggleCircleArrow = (circleId: string) => {
    setExpandedCircleIds((current) => {
      const next = new Set(current);
      if (next.has(circleId)) {
        next.delete(circleId);
      } else {
        next.add(circleId);
      }
      return next;
    });
    lockPillSelection();
  };

  /**
   * Single bulk toggle, no multi-tap cycle: if any of these Circles
   * currently has any included person, tapping excludes all of them
   * across every Circle given; otherwise it includes all of them. Also
   * expands every Circle given (so the effect is visible) — the chip
   * never collapses one, only the arrow does that. Deliberately does not
   * lock on its own; this is an in-row adjustment, same as an individual
   * pill tap. Takes an array so a still-grouped linked cluster (2026-08-21)
   * can toggle every member Circle together as one unit — the cluster
   * itself is what's being selected, not any one member alone — while a
   * plain, unclustered Circle just passes its own single-item array.
   */
  const toggleCircleGroup = (circles: AudienceCircle[]) => {
    const anyIncluded = circles.some((circle) =>
      circle.contacts.some((contact) => includedPersonIds.has(contact.phoneNumber))
    );
    setIncludedPersonIds((current) => {
      const next = new Set(current);
      for (const circle of circles) {
        for (const contact of circle.contacts) {
          if (anyIncluded) next.delete(contact.phoneNumber);
          else next.add(contact.phoneNumber);
        }
      }
      return next;
    });
    setExpandedCircleIds((current) => {
      const next = new Set(current);
      for (const circle of circles) next.add(circle.circleId);
      return next;
    });
  };

  const toggleCircleChip = (circle: AudienceCircle) => toggleCircleGroup([circle]);

  const togglePersonIncluded = (phoneNumber: string) => {
    setIncludedPersonIds((current) => {
      const next = new Set(current);
      if (next.has(phoneNumber)) next.delete(phoneNumber);
      else next.add(phoneNumber);
      return next;
    });
  };

  /** Marks/unmarks an existing member for removal, by phone number — mirrors Manage Circles' own toggleMember exactly. */
  const toggleStagedMember = (circleId: string, phoneNumber: string) => {
    setStagedExcludedByCircle((current) => {
      const next = new Set(current[circleId] ?? []);
      if (next.has(phoneNumber)) next.delete(phoneNumber);
      else next.add(phoneNumber);
      return { ...current, [circleId]: next };
    });
  };

  /**
   * Phone-number reconciliation, matching `addToReconnectingAudience`'s own
   * existing dedup exactly (2026-08-30) — unlike Manage Circles' own
   * addMemberToStaged (which only guards within the one Circle being
   * edited, since Circles are otherwise independent), this period's
   * audienceCircles were already deduped by phone number once, at
   * Going-Quiet-time (buildAudienceCircles). Staging a fresh addition here
   * without the same check could silently reintroduce the exact "same
   * person in two Circles for one period" bug already found and fixed
   * once before (see buildAudienceCircles' own comment, docs/09-decision-log.md,
   * 2026-08-13) — a real risk this new feature would otherwise create, not
   * carry over.
   */
  const addStagedMember = async (circleId: string) => {
    const picked = await pickContact();
    if (!picked) return;

    const alreadyInAudience =
      audienceCircles.some((circle) => circle.contacts.some((contact) => contact.phoneNumber === picked.phoneNumber)) ||
      (period?.audienceUngrouped ?? []).some((contact) => contact.phoneNumber === picked.phoneNumber);
    if (alreadyInAudience) return;

    setStagedAdditionsByCircle((current) => {
      const existing = current[circleId] ?? [];
      if (existing.some((contact) => contact.phoneNumber === picked.phoneNumber)) return current;
      return { ...current, [circleId]: [...existing, { name: picked.name, phoneNumber: picked.phoneNumber }] };
    });
  };

  const removeStagedAddition = (circleId: string, phoneNumber: string) => {
    setStagedAdditionsByCircle((current) => ({
      ...current,
      [circleId]: (current[circleId] ?? []).filter((contact) => contact.phoneNumber !== phoneNumber)
    }));
  };

  const clearStagedFor = (circleId: string) => {
    setStagedExcludedByCircle((current) => {
      const next = { ...current };
      delete next[circleId];
      return next;
    });
    setStagedAdditionsByCircle((current) => {
      const next = { ...current };
      delete next[circleId];
      return next;
    });
  };

  /**
   * Commits staged membership edits for one real Circle — writes the real
   * Circle first (`removeContactFromGroup`/`addContactToGroup`, same
   * circleService calls Manage Circles' own "Update circle" makes), then
   * syncs this period's own `audienceCircles` snapshot to match via
   * `updateAudienceCircleContacts`, since that snapshot doesn't
   * automatically follow live Circle edits (see its own comment). Removal
   * needs the live Circle's own internal contact id, not just a phone
   * number — `AudienceContact` doesn't carry one — so the live Circle is
   * fetched once here to resolve that mapping.
   */
  const saveCircleChanges = (circle: AudienceCircle) => {
    void (async () => {
      if (!period) return;

      const excluded = stagedExcludedByCircle[circle.circleId] ?? new Set<string>();
      const additions = stagedAdditionsByCircle[circle.circleId] ?? [];
      if (excluded.size === 0 && additions.length === 0) return;

      const liveGroup = await getGroup(circle.circleId);
      if (liveGroup) {
        for (const contact of liveGroup.contacts) {
          if (excluded.has(contact.phoneNumber)) {
            await removeContactFromGroup(circle.circleId, contact.id);
          }
        }
        for (const contact of additions) {
          await addContactToGroup(circle.circleId, contact);
        }
      }

      const nextContacts: AudienceContact[] = [
        ...circle.contacts.filter((contact) => !excluded.has(contact.phoneNumber)),
        ...additions
      ];
      await updateAudienceCircleContacts(period.id, circle.circleId, nextContacts);

      clearStagedFor(circle.circleId);
      await refresh();
    })();
  };

  /**
   * Adds a new ungrouped person to this period's audience mid-Reconnect —
   * a dedicated `addToReconnectingAudience` rather than Home's own
   * Circle-of-one "Add to Going Quiet" flow, since this no longer has the
   * currently-OPEN period that flow requires by the time Reconnect is on
   * screen. Still ungrouped, not a Circle-of-one — a real, flagged
   * inconsistency with the confirmed Circle-of-one design, left as-is
   * here (see docs/09-decision-log.md, 2026-08-13). refresh() re-seeds
   * includedPersonIds afterward, which already includes the new
   * (not-yet-contacted) person — no separate include step needed.
   */
  const addPersonToAudience = () => {
    void (async () => {
      if (!period) return;
      const picked = await pickContact();
      if (!picked) return;

      await addToReconnectingAudience(period.id, picked);
      await refresh();
    })();
  };

  /**
   * Delivery is individual/BCC-style by default per Circle, or one shared
   * group thread for a Circle with `sendAsGroup` turned on — mixed
   * combinations follow each Circle's own setting independently within
   * this one Send (2026-08-11, corrects the earlier one-shared-message
   * behaviour, matching Going Quiet's own fix). Ungrouped contacts were
   * never part of a Circle in the first place, so they're always sent
   * individually. Recipients are now whoever's currently included per
   * person (2026-08-13), not whichever Circles were selected. See
   * docs/09-decision-log.md.
   */
  const send = async () => {
    if (!period) return;

    const text = message.trim();
    if (!text) return;

    const circles = (period.audienceCircles ?? [])
      .map((circle) => ({
        ...circle,
        contacts: circle.contacts.filter((contact) => includedPersonIds.has(contact.phoneNumber))
      }))
      .filter((circle) => circle.contacts.length > 0);
    const ungrouped = (period.audienceUngrouped ?? []).filter((contact) =>
      includedPersonIds.has(contact.phoneNumber)
    );
    const hasAnyRecipient = circles.length > 0 || ungrouped.length > 0;
    if (!hasAnyRecipient) return;

    const deliveryTargets = circles.map((circle) => ({
      circleId: circle.circleId,
      sendAsGroup: circle.sendAsGroup ?? false,
      contacts: circle.contacts.map((contact) => ({
        phoneNumber: contact.phoneNumber,
        preferredChannel: contact.preferredChannel
      }))
    }));

    const defaultChannel = await getDefaultSendingChannel();
    const channelByCircle = await sendToCircles(deliveryTargets, text, defaultChannel);
    for (const [id, channel] of channelByCircle) {
      await recordSendChannel(period.id, id, channelKey(channel));
    }

    for (const contact of ungrouped) {
      try {
        const channel = await sendIndividual(contact.phoneNumber, text, contact.preferredChannel ?? defaultChannel);
        await recordSendChannel(period.id, contact.phoneNumber, channelKey(channel));
      } catch {
        // Move on to the next recipient even if this compose sheet was dismissed.
      }
    }

    // Both the durable reconnecting marker and Conversations seeding only
    // happen here, at the first genuine send — never on entering the flow —
    // so backing out beforehand never leaves Home wrongly showing "Continue
    // reconnecting" or "Finish Reconnecting" for a Reconnect that was never
    // actually acted on. Both are idempotent, so repeat sends are harmless;
    // seeding uses the period's full audience, not just this send's
    // selection, so anyone not yet individually messaged still shows up in
    // Conversations once the coverage gate is eventually satisfied.
    await beginReconnecting(period.id);
    await seedFromAudience(period.audienceCircles ?? [], period.audienceUngrouped ?? []);

    const sentNumbers = new Set([
      ...circles.flatMap((circle) => circle.contacts.map((contact) => contact.phoneNumber)),
      ...ungrouped.map((contact) => contact.phoneNumber)
    ]);
    for (const phoneNumber of sentNumbers) {
      await markReconnectContacted(period.id, phoneNumber);
    }
    await recordReconnectStepReached(period.id, "instant_message_sent");

    // Keep Library/Conversations' own per-person sentAt truthfully in sync,
    // so PersonaliseAccordion can honestly show already-contacted vs not.
    const conversationPeople = await getAllConversationPeople();
    const matchedIds = conversationPeople
      .filter((person) => sentNumbers.has(person.phoneNumber))
      .map((person) => person.id);
    if (matchedIds.length > 0) {
      await markContacted(matchedIds);
    }

    await clearDraft(RECONNECT_DRAFT_KEY);
    await refresh();
  };

  /**
   * Opens the same rich per-person Send/Edit/Personalise accordion Library
   * itself uses, in place — not a nav-away hand-off (2026-08-11 — the old
   * plain "Personalise" -> router.push("/library") was itself the gap,
   * upgraded alongside Going Quiet's own completion step so both reach the
   * same experience at their equivalent moment). Everyone in this period's
   * audience is already a ConversationPerson by now (send() already calls
   * seedFromAudience unconditionally), so there's nothing left to seed here
   * — just read the matching records back. See docs/09-decision-log.md,
   * 2026-08-11.
   */
  const openPersonalise = () => {
    setShowPersonalise(true);
    if (!period) return;

    void conversations.refresh();
  };

  /**
   * Ends Reconnect's own completion step, reachable via "Done" — the one
   * exit control on this screen, never a send trigger (2026-08-13: the
   * separate always-available Send button is removed entirely — sending
   * only ever happens through the docked bar's own send icon now, one
   * consistent mechanism instead of two). See docs/09-decision-log.md.
   */
  const finishReconnecting = () => {
    router.replace("/return/done");
  };

  const clearStatus = () => {
    setStatusCleared(true);
  };

  const markPlatformTakenDown = (platformId: string) => {
    if (!period) return;
    void (async () => {
      await markWiderWorldTakenDown(period.id, platformId);
      const updated = await getHoldPeriodById(period.id);
      if (updated) setPeriod(updated);
    })();
  };

  /** Per-account "turn off" — real deactivate call for a linked account, then persisted so it survives a force-quit/resume the same way the social checklist already does. One-directional, matching the social side: already-off stays off. */
  const markEmailAccountOff = (accountId: string) => {
    if (!period) return;
    const account = period.emailLinkedAccounts?.find((candidate) => candidate.id === accountId);
    if (!account) return;

    void (async () => {
      await deactivateOutOfOffice([account]);
      await markEmailAccountTurnedOff(period.id, accountId);
      const updated = await getHoldPeriodById(period.id);
      if (updated) setPeriod(updated);
    })();
  };

  /**
   * The unified taken-down row's own onToggle — dispatches by kind, same
   * pattern as Going Quiet's toggleMarkedPlatform. One-directional: once
   * marked, tapping again does nothing (matches the pre-existing social
   * checklist's own guard, extended to email).
   */
  const toggleTakenDownPlatform = (platform: SelectableWiderWorldPlatform) => {
    if (!period) return;
    const alreadyMarked =
      platform.kind === "email"
        ? (period.widerWorldEmailTurnedOffAccountIds ?? []).includes(platform.id)
        : (period.widerWorldTakenDownPlatforms ?? []).includes(platform.id);
    if (alreadyMarked) return;

    if (platform.kind === "email") {
      markEmailAccountOff(platform.id);
    } else {
      markPlatformTakenDown(platform.id);
    }
  };

  /** "All" — marks every currently-visible item not already marked. */
  const markAllTakenDown = (platforms: SelectableWiderWorldPlatform[]) => {
    for (const platform of platforms) toggleTakenDownPlatform(platform);
  };

  const openRename = (group: CircleGroup) => {
    setRenamingGroupId(group.id);
    setRenameDraft(group.name);
  };

  /** "Leave as is" — an explicit final acknowledgement of the placeholder name, not a deferral; never asked again. */
  const keepPlaceholderName = async (group: CircleGroup) => {
    await renameGroup(group.id, group.name);
    setNeedsNamingGroups((current) => current.filter((g) => g.id !== group.id));
  };

  const submitRename = async (name: string) => {
    if (!renamingGroupId || !period) return;
    const trimmed = name.trim();

    const updated = await renameGroup(renamingGroupId, trimmed || renameDraft);
    if (updated) {
      await renameCircleInPeriod(period.id, renamingGroupId, updated.name);
    }
    setNeedsNamingGroups((current) => current.filter((g) => g.id !== renamingGroupId));
    setRenamingGroupId(null);
    setRenameDraft("");
    await refresh();
  };

  if (!period || !coverage) {
    return <Screen contentContainerStyle={styles.content} />;
  }

  // Reorder + grey-out once locked (pillLockedIds) — included-at-lock-time
  // pills float to front, everything else greys out but stays tappable.
  // Locked once per round (the first of: text box opened, an arrow
  // tapped, or anywhere else on screen tapped), released only by the next
  // refresh() (i.e. after a Send), not by closing the text box. See the
  // state comment above and docs/09-decision-log.md, 2026-08-13.
  const lockedIds = pillLockedIds ? new Set(pillLockedIds) : null;
  const orderPeople = <T,>(items: T[], idOf: (item: T) => string): T[] => {
    if (!lockedIds) return items;
    const active = items.filter((item) => lockedIds.has(idOf(item)));
    const rest = items.filter((item) => !lockedIds.has(idOf(item)));
    return [...active, ...rest];
  };

  const showOoo = period.emailOutOfOfficeEnabled || period.widerWorldStatusEnabled;

  // Exactly the platforms marked "posted here" at Going Quiet's own
  // "Where did you post this?" step — not the full configured list, so
  // Reconnect only ever asks about what's actually relevant this round.
  // A platform since deleted from "Your Wider World" settings simply
  // drops out here (no id to resolve a name against), rather than erroring.
  const postedPlatformIds = period.widerWorldPostedPlatforms ?? [];
  const takenDownPlatformIds = new Set(period.widerWorldTakenDownPlatforms ?? []);
  const postedPlatforms = widerWorldPlatforms.filter((platform) => postedPlatformIds.includes(platform.id));

  // Unified taken-down row (2026-08-30) — social platforms marked posted-to
  // plus the real linked email accounts from this same round, in one row,
  // matching Going Quiet's own unified compose-side row. Real labels come
  // from the durable EmailAccount records (Settings), not the period's own
  // minimal id+provider snapshot.
  const turnedOffEmailAccountIds = new Set(period.widerWorldEmailTurnedOffAccountIds ?? []);
  const linkedEmailPlatforms: SelectableWiderWorldPlatform[] = (period.emailLinkedAccounts ?? []).map((account) => {
    const record = emailAccounts.find((candidate) => candidate.id === account.id);
    return { id: account.id, name: record?.label ?? (account.provider === "gmail" ? "Gmail" : "Outlook"), kind: "email" };
  });
  const takenDownRowPlatforms = [...postedPlatforms, ...linkedEmailPlatforms];
  const takenDownMarkedIds = new Set([...takenDownPlatformIds, ...turnedOffEmailAccountIds]);

  const audienceCircles = period.audienceCircles ?? [];
  const allAudiencePhoneNumbers = [
    ...(period.audienceUngrouped ?? []).map((contact) => contact.phoneNumber),
    ...audienceCircles.flatMap((circle) => circle.contacts.map((contact) => contact.phoneNumber))
  ];
  const allAudienceIncluded =
    allAudiencePhoneNumbers.length > 0 && allAudiencePhoneNumbers.every((pn) => includedPersonIds.has(pn));
  const toggleAllAudience = () => {
    setIncludedPersonIds((current) => {
      const next = new Set(current);
      for (const pn of allAudiencePhoneNumbers) {
        if (allAudienceIncluded) next.delete(pn);
        else next.add(pn);
      }
      return next;
    });
  };

  const visibleCircles = audienceCircles.filter((circle) => expandedCircleIds.has(circle.circleId));
  // `key` is deliberately distinct from `id`: `id` (phone number) is the
  // real recipient identity everything else (inclusion, lock, sent-state)
  // keys off — two entries for the same phone number really should be
  // treated as one recipient. `key`, used only for React's own list
  // reconciliation, is scoped to the (Circle, person) pair so a data-layer
  // duplicate can never collide and cause React to conflate two list
  // items — real bug found 2026-08-13, see buildAudienceCircles in
  // HoldFlowContext.tsx for the actual source of the duplication this was
  // masking. See docs/09-decision-log.md.
  const pillPeople = orderPeople(
    [
      ...(period.audienceUngrouped ?? []).map((contact) => ({
        key: `ungrouped:${contact.phoneNumber}`,
        id: contact.phoneNumber,
        name: contact.name
      })),
      ...visibleCircles.flatMap((circle) =>
        circle.contacts.map((contact) => ({
          key: `${circle.circleId}:${contact.phoneNumber}`,
          id: contact.phoneNumber,
          name: contact.name
        }))
      )
    ],
    (person) => person.id
  );
  const allVisibleIncluded =
    pillPeople.length > 0 && pillPeople.every((person) => includedPersonIds.has(person.id));
  const toggleAllVisible = () => {
    setIncludedPersonIds((current) => {
      const next = new Set(current);
      for (const person of pillPeople) {
        if (allVisibleIncluded) next.delete(person.id);
        else next.add(person.id);
      }
      return next;
    });
  };

  /**
   * The passive excluded line — everyone currently visible but not
   * included, same underlying data `pillPeople` itself already carries,
   * just filtered. 100% passive plain text (2026-08-30, removes bundling
   * and "I've already told them" entirely — neither is a feature any
   * more): giving someone here their own Circle happens purely through
   * the ordinary "+ New Circle"/add-person flow, unrelated to this line;
   * if someone's been told separately, they can simply be added to the
   * instant message or Conversations if and when relevant, same as
   * anyone else — no separate status, no tap target, nothing tracked.
   * See docs/09-decision-log.md.
   */
  const excludedPillPeople = pillPeople.filter((person) => !includedPersonIds.has(person.id));

  // The real gate for whether there's anything to compose/send right now
  // — not coverage.complete on its own, since a fully-reached Circle's
  // people are still reselectable for a further message (2026-08-13,
  // "sent pills are never locked", matching the same rule used everywhere
  // else this chip pattern exists). coverage.complete alone only decides
  // whether the "everyone's been reached" framing/Personalise choice shows
  // once nothing's currently included. See docs/09-decision-log.md.
  const hasComposeTargets = includedPersonIds.size > 0;

  // Once everyone's been reached, a Circle can still legitimately show as
  // not-yet-sent here — added to the audience afterward (e.g. via "Add to
  // Going Quiet"), never actually messaged this round. Sent Circles float
  // to the front, not-yet-sent ones to the end, matching the resumed
  // "Finish Reconnecting" spec; left in natural order otherwise, since
  // sent/not-yet-sent isn't a meaningful distinction to call out while
  // sending is still actively in progress. Not memoized, matching every
  // other derived value in this post-guard section (pillPeople, etc.) —
  // this whole block already re-runs in full every render. See
  // docs/09-decision-log.md, 2026-08-13.
  const orderedAudienceCircles = (() => {
    if (!coverage.complete) return audienceCircles;

    const sent: typeof audienceCircles = [];
    const notYetSentCircles: typeof audienceCircles = [];
    for (const circle of audienceCircles) {
      const isSent =
        circle.contacts.length > 0 && circle.contacts.every((contact) => coverage.contactedIds.includes(contact.phoneNumber));
      (isSent ? sent : notYetSentCircles).push(circle);
    }
    return [...sent, ...notYetSentCircles];
  })();

  /**
   * Linked circles (Olympic-rings) — Circles combined-sent together this
   * period via Going Quiet's own send (see HoldPeriod.linkedCircleSets),
   * carried forward here using the identical shared component/logic
   * Taking Time's "Send an Update" already uses. Period-scoped, not a
   * standing relationship between these Circles (a new Hold period starts
   * with no inherited links). Ungrouping is persisted on the period itself
   * (ungroupedLinkKeys), not session-local, so the choice also carries
   * forward into Conversations rather than resetting per screen-open. See
   * docs/09-decision-log.md, 2026-08-21.
   */
  const linkedClusters = resolveLinkedClusters(
    period.linkedCircleSets ?? [],
    new Set(audienceCircles.map((circle) => circle.circleId))
  );
  const ungroupedLinkKeys = new Set(period.ungroupedLinkKeys ?? []);
  const clusterFor = (circleId: string): string[] | null => {
    const cluster = linkedClusters.find((ids) => ids.includes(circleId));
    if (!cluster) return null;
    return ungroupedLinkKeys.has(combinationKey(cluster)) ? null : cluster;
  };
  const clusterFullyIncluded = (circleIds: string[]): boolean =>
    circleIds.every((circleId) => {
      const circle = audienceCircles.find((c) => c.circleId === circleId);
      return (
        !!circle && circle.contacts.length > 0 && circle.contacts.every((contact) => includedPersonIds.has(contact.phoneNumber))
      );
    });
  // The one cluster (if any) currently selected together, in the same
  // sense Taking Time's own `showGroupToggle` means it — every member
  // Circle's people all included at once. Only one toggle shows at a time,
  // matching that established single-toggle-for-the-current-selection
  // shape even though Reconnect's own selection is derived from per-person
  // inclusion rather than an explicit Set of selected Circle ids.
  //
  // Deliberately NOT filtered by ungroupedLinkKeys (2026-08-29 fix, item
  // 10) — the earlier version excluded any already-ungrouped cluster here,
  // which made LinkGroupToggle stop rendering the moment someone ungrouped
  // once, with no way back to "Group" ever again for that cluster. This
  // must resolve in both states; the toggle's own `grouped` prop (below,
  // at the render site) is what actually reflects current state, matching
  // TakingTimeUpdateDrawer's own `showGroupToggle`, which never had this
  // filter and has always supported both directions.
  const fullySelectedCluster = linkedClusters.find((circleIds) => clusterFullyIncluded(circleIds)) ?? null;

  const toggleLinkGroup = (circleIds: string[]) => {
    if (!period) return;
    const key = combinationKey(circleIds);
    const currentlyGrouped = !(period.ungroupedLinkKeys ?? []).includes(key);
    void (async () => {
      await setLinkClusterGrouped(period.id, key, !currentlyGrouped);
      // A direct re-fetch, not the full refresh() — refresh() also resets
      // includedPersonIds/pillLockedIds on every call (2026-08-21 fix for
      // items 7/9), which would wipe the person's current pill selection
      // as a side effect of nothing more than a Group/Ungroup tap.
      const updated = await getHoldPeriodById(period.id);
      if (updated) setPeriod(updated);
    })();
  };

  // One continuous screen throughout, not a page-swap once everyone's been
  // reached (2026-08-12) — reaching full coverage used to render an
  // entirely different Screen tree (new header, no circle row, no message
  // box), which read on-device as navigating to a separate page even
  // though no route change was involved. Now every section below is
  // conditional in place instead. See docs/09-decision-log.md, 2026-08-12.
  return (
    <Screen
      contentContainerStyle={styles.content}
      dockedInput={
        renamingGroupId ? (
          <DockedInputBar
            value={renameDraft}
            onChangeText={setRenameDraft}
            onDone={() => void submitRename(renameDraft)}
            placeholder="Circle name"
            accessibilityLabel="Circle name"
          />
        ) : hasComposeTargets && messageFieldActive ? (
          <DockedInputBar
            value={message}
            onChangeText={changeMessage}
            onDone={() => {
              // Sends immediately — no intermediate "return to preview"
              // step, matching Going Quiet's own fix. This is now the
              // ONLY way to send on this screen (2026-08-13). See
              // docs/09-decision-log.md.
              void send();
              setMessageFieldActive(false);
            }}
            placeholder="Message to send"
            accessibilityLabel="Message to send"
            aiAmend={{ surface: "reconnect" }}
            template={savedDefaultText !== null ? { text: savedDefaultText } : undefined}
            extraPhrases={messageExtraPhrases}
            pendingInsert={pendingMemoryInsert}
            saveDefault={
              contributingCircleIds.length > 0
                ? {
                    isSaved,
                    onSave: () => void saveCurrentAsTemplate(),
                    unsavedLabel: isSingleCircle ? "Save" : "Save as template",
                    savedLabel: "Saved"
                  }
                : undefined
            }
          />
        ) : conversations.personaliseReplyTarget ? (
          <DockedInputBar
            value={conversations.personaliseDrafts[conversations.personaliseReplyTarget.personId] ?? ""}
            onChangeText={conversations.personaliseReplyTarget.onChangeText}
            onDone={() => {
              // Was just closing the field — the docked bar's Send icon
              // never actually sent anything, matching Box A's own Send
              // button. Fixed 2026-08-29: onSend closes over this
              // instance's own PersonaliseAccordion.sendNow. See
              // docs/09-decision-log.md.
              conversations.personaliseReplyTarget?.onSend();
              conversations.setPersonaliseReplyTarget(null);
            }}
            placeholder="Your reply"
            accessibilityLabel="Your reply"
            aiAmend={{
              surface: "conversations-reply",
              context: { friendMessage: conversations.personaliseReplyTarget.friendMessage }
            }}
            extraPhrases={
              conversations.people
                .find((person) => person.id === conversations.personaliseReplyTarget?.personId)
                ?.circleId?.startsWith(PENDING_CIRCLE_ID_PREFIX)
                ? [NEWLY_ADDED_APOLOGY_PHRASE]
                : []
            }
          />
        ) : conversations.activeField ? (
          <DockedInputBar
            value={conversations.activeFieldValue()}
            onChangeText={conversations.setActiveFieldValue}
            onDone={() => conversations.setActiveField(null)}
            placeholder={conversations.activeFieldLabel()}
            accessibilityLabel={conversations.activeFieldLabel()}
            aiAmend={
              conversations.activeIndividualPerson
                ? {
                    surface: "conversations-reply",
                    context: { recipientLabel: conversations.activeIndividualPerson.name }
                  }
                : undefined
            }
            extraPhrases={
              conversations.activeIndividualPerson?.circleId?.startsWith(PENDING_CIRCLE_ID_PREFIX)
                ? [NEWLY_ADDED_APOLOGY_PHRASE]
                : []
            }
          />
        ) : null
      }
    >
      {/* Wraps everything below the header so a tap anywhere that isn't
          otherwise absorbed (a chip, a pill, a button) counts as "leaving
          the row" and locks selection — scrolling a pill row itself never
          reaches this, since the ScrollView's own gesture claims the touch
          first, satisfying the "scrolling doesn't count" rule for free.
          Explicit lock calls (the arrow, opening the text box) cover the
          two named triggers directly regardless. See
          docs/09-decision-log.md, 2026-08-13. */}
      <Pressable onPress={lockPillSelection} style={styles.lockCatcher}>
        <View style={styles.top}>
          <StepHeader
            body={coverage.complete ? "Everyone's been reached." : "Reach everyone at your own pace, a few at a time."}
          />

          {/* Circle-browsing row — which Circles to draw people from, not
              a send-selection any more. The chip bulk-toggles that
              Circle's own people between fully included/excluded; the
              arrow is a separate, independent tap target that only shows
              or hides its people in the shared pill row below, same
              chip/arrow split as everywhere else this pattern exists.
              "+"/"All" pinned first, matching Going Quiet's own row
              exactly (2026-08-13, app-wide convention, not
              Reconnect-specific). See docs/09-decision-log.md. */}
          <View style={styles.pinnedRow}>
            {/* Adds a new person to the audience — single-purpose, no
                bundling mechanic connected to it (removed 2026-08-30, see
                the excluded line below). See docs/09-decision-log.md. */}
            <AdaptiveCircleChip
              label="+"
              accessibilityLabel="Add person"
              accessibilityRole="button"
              outline
              isSelected={false}
              labelFontSize={28}
              labelBold
              onPress={addPersonToAudience}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              style={styles.pillScroll}
            >
              {audienceCircles.length > 0 ? (
                <AdaptiveCircleChip
                  label="All"
                  isSelected={allAudienceIncluded}
                  labelBold
                  onPress={toggleAllAudience}
                  accessibilityRole="button"
                />
              ) : null}

              {(() => {
                const rendered = new Set<string>();
                return orderedAudienceCircles.map((circle) => {
                  if (rendered.has(circle.circleId)) return null;

                  const cluster = clusterFor(circle.circleId);
                  if (cluster) {
                    for (const id of cluster) rendered.add(id);
                    const memberCircles = cluster
                      .map((id) => audienceCircles.find((c) => c.circleId === id))
                      .filter((c): c is AudienceCircle => c !== undefined);
                    const members: LinkedClusterMember[] = memberCircles.map((c) => ({
                      circleId: c.circleId,
                      circleName: c.circleName,
                      isSelected:
                        c.contacts.length > 0 && c.contacts.every((contact) => includedPersonIds.has(contact.phoneNumber)),
                      hasSentThisSession:
                        c.contacts.length > 0 &&
                        c.contacts.every((contact) => coverage.contactedIds.includes(contact.phoneNumber)),
                      newlyAdded: c.circleId.startsWith(PENDING_CIRCLE_ID_PREFIX),
                      isExpanded: expandedCircleIds.has(c.circleId)
                    }));
                    return (
                      <LinkedCircleCluster
                        key={combinationKey(cluster)}
                        members={members}
                        onToggle={() => toggleCircleGroup(memberCircles)}
                        onToggleArrow={toggleCircleArrow}
                      />
                    );
                  }

                  rendered.add(circle.circleId);
                  const isExpanded = expandedCircleIds.has(circle.circleId);
                  const allIncluded =
                    circle.contacts.length > 0 &&
                    circle.contacts.every((contact) => includedPersonIds.has(contact.phoneNumber));
                  const hasSentThisSession =
                    circle.contacts.length > 0 &&
                    circle.contacts.every((contact) => coverage.contactedIds.includes(contact.phoneNumber));
                  const sentLook = hasSentThisSession && !allIncluded;

                  return (
                    <View key={circle.circleId} style={styles.circleUnit}>
                      <AdaptiveCircleChip
                        label={circle.circleName}
                        isSelected={allIncluded}
                        hasSentThisSession={hasSentThisSession}
                        notYetSent={coverage.complete && !hasSentThisSession}
                        newlyAdded={circle.circleId.startsWith(PENDING_CIRCLE_ID_PREFIX)}
                        onPress={() => toggleCircleChip(circle)}
                        accessibilityRole="button"
                        accessibilityLabel={
                          circle.circleId.startsWith(PENDING_CIRCLE_ID_PREFIX)
                            ? `${circle.circleName}, added now, wasn't told when you went quiet. ${allIncluded ? "Tap to exclude." : "Tap to include."}`
                            : allIncluded
                              ? `${circle.circleName}, everyone included. Tap to exclude everyone.`
                              : `${circle.circleName}. Tap to include everyone.`
                        }
                      />
                      {/* Core (Close) never gets this arrow, in-flow, no
                          exceptions — same rule as Going Quiet's own
                          Circle row. See docs/09-decision-log.md,
                          2026-08-29. */}
                      {circle.circleId !== CLOSE_CIRCLE_ID ? (
                        <DropdownArrowBadge
                          expanded={isExpanded}
                          checked={sentLook}
                          onPress={() => toggleCircleArrow(circle.circleId)}
                          accessibilityLabel={
                            sentLook
                              ? `${circle.circleName}, already sent. ${isExpanded ? "Hide" : "Show"} people.`
                              : `${circle.circleName}, ${isExpanded ? "hide" : "show"} people`
                          }
                          style={styles.arrowButton}
                        />
                      ) : null}
                    </View>
                  );
                });
              })()}
            </ScrollView>
          </View>

          {/*
           * Linked-circles Group/Ungroup toggle — the identical shared
           * component/toggle Taking Time's "Send an Update" already uses,
           * extended here (2026-08-21): appears only when a linked
           * cluster's Circles are currently all included together.
           * Persisted via setLinkClusterGrouped (period.ungroupedLinkKeys),
           * not session-local, so the choice carries forward into
           * Conversations rather than resetting on reopen. See
           * docs/09-decision-log.md.
           */}
          {fullySelectedCluster ? (
            <LinkGroupToggle
              grouped={!ungroupedLinkKeys.has(combinationKey(fullySelectedCluster))}
              onPress={() => toggleLinkGroup(fullySelectedCluster)}
            />
          ) : null}

          {/*
           * Real-Circle membership editing — one card per currently
           * expanded, non-pending Circle, staged then committed via "Save
           * changes" (2026-08-30, circle-editing model part 3). Mirrors
           * Manage Circles' own card almost exactly (dimmed pill = staged
           * for removal, "New" tag = staged addition), deliberately kept
           * as its own block rather than folded into the shared pill row
           * above — that row's job is send-inclusion for THIS message,
           * a different concern from real Circle membership. See
           * docs/09-decision-log.md.
           */}
          {audienceCircles
            .filter(
              (circle) => expandedCircleIds.has(circle.circleId) && !circle.circleId.startsWith(PENDING_CIRCLE_ID_PREFIX)
            )
            .map((circle) => {
              const excluded = stagedExcludedByCircle[circle.circleId] ?? new Set<string>();
              const additions = stagedAdditionsByCircle[circle.circleId] ?? [];
              const hasStagedChanges = excluded.size > 0 || additions.length > 0;

              return (
                <View key={circle.circleId} style={styles.editCard}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add someone to ${circle.circleName}`}
                      onPress={() => void addStagedMember(circle.circleId)}
                      style={styles.editAddPill}
                    >
                      <Ionicons name="add" size={18} color={colors.primary} />
                    </Pressable>
                    {circle.contacts.map((contact) => {
                      const included = !excluded.has(contact.phoneNumber);
                      return (
                        <View key={contact.phoneNumber} style={!included ? styles.chipGreyed : undefined}>
                          <AdaptiveCircleChip
                            label={contact.name}
                            compact
                            isSelected={false}
                            onPress={() => toggleStagedMember(circle.circleId, contact.phoneNumber)}
                            accessibilityRole="checkbox"
                            accessibilityLabel={
                              included
                                ? `${contact.name}, in ${circle.circleName}. Tap to mark for removal.`
                                : `${contact.name}, marked for removal from ${circle.circleName}. Tap to keep.`
                            }
                          />
                        </View>
                      );
                    })}
                    {additions.map((contact) => (
                      <View key={contact.phoneNumber} style={styles.editAddedUnit}>
                        <AdaptiveCircleChip
                          label={contact.name}
                          compact
                          isSelected
                          onPress={() => removeStagedAddition(circle.circleId, contact.phoneNumber)}
                          accessibilityRole="checkbox"
                          accessibilityLabel={`${contact.name}, new. Tap to remove before saving.`}
                        />
                        <Text style={styles.editAddedTag}>New</Text>
                      </View>
                    ))}
                  </ScrollView>
                  {hasStagedChanges ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Save changes to ${circle.circleName}`}
                      onPress={() => saveCircleChanges(circle)}
                      style={styles.saveChangesButton}
                    >
                      <Text style={styles.saveChangesText}>Save changes</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}

          {/* Excluded line — 100% passive plain text, no chip/pill styling,
              no tap target, no bundling or "already told" mechanic
              connected to it at all (removed 2026-08-30). Its only job is
              showing who isn't currently included — giving someone here
              their own Circle happens purely through the ordinary "+"/add-
              person flow above, unrelated to this line. See
              docs/09-decision-log.md. */}
          {excludedPillPeople.length > 0 ? (
            <Text style={styles.excludedLineText} accessibilityRole="text">
              {excludedPillPeople.map((person) => person.name).join(", ")}
            </Text>
          ) : null}

          {hasComposeTargets ? (
            <MemoryNoteSuggestion
              onUseIt={(text) => {
                openMessageField();
                setPendingMemoryInsert(text);
              }}
            />
          ) : null}

          {/* Shared pill row: same "+"/"All" pinned-first treatment as the
              Circle row above. Ungrouped contacts always visible; Circle
              members once their own arrow is expanded, ordered to match
              each person's parent Circle's own position above. See
              docs/09-decision-log.md, 2026-08-13. */}
          <View style={styles.pinnedRow}>
            <AdaptiveCircleChip
              label="+"
              accessibilityLabel="Add person"
              accessibilityRole="button"
              outline
              compact
              isSelected={false}
              labelBold
              onPress={addPersonToAudience}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              style={styles.pillScroll}
            >
              {pillPeople.length > 0 ? (
                <AdaptiveCircleChip
                  label="All"
                  compact
                  isSelected={allVisibleIncluded}
                  labelBold
                  onPress={toggleAllVisible}
                  accessibilityRole="button"
                />
              ) : null}

              {pillPeople.map((person) => {
                const isIncluded = includedPersonIds.has(person.id);
                const hasSentThisSession = coverage.contactedIds.includes(person.id);
                const sentLook = hasSentThisSession && !isIncluded;
                const isGreyedOut = lockedIds !== null && !lockedIds.has(person.id);

                return (
                  <View key={person.key} style={isGreyedOut && styles.chipGreyed}>
                    <AdaptiveCircleChip
                      label={person.name}
                      compact
                      isSelected={isIncluded}
                      hasSentThisSession={hasSentThisSession}
                      onPress={() => togglePersonIncluded(person.id)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isIncluded
                          ? `${person.name}, included in this message. Tap to opt out.`
                          : sentLook
                            ? `${person.name}, already reached. Tap to include in this message.`
                            : `${person.name}, not included in this message. Tap to include.`
                      }
                    />
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {hasComposeTargets ? (
            <View style={styles.messageBlock}>
              <DockedFieldPreview
                value={message}
                placeholder="Message to send"
                isActive={messageFieldActive}
                onPress={openMessageField}
                accessibilityLabel="Message to send"
                onInsertPill={(text) => changeMessage(message.trim() ? `${message}\n${text}` : text)}
                extraPhrases={messageExtraPhrases}
                highlightAll={isSaved}
              />
              {/* "Change template" cut entirely, 2026-08-13 — superseded
                  by sentence pills. See docs/09-decision-log.md.
                  Save/Saved (left) / Template (right), 2026-08-13 fix —
                  explicit justifyContent: "space-between", matching
                  people.tsx's identical fix, so Save always lands on its
                  own side regardless of which single item is present.
                  Template here is a plain insert, matching this box's
                  own pill row above it — the green-highlight version
                  lives in DockedInputBar once the bar is open. */}
              <View style={styles.messageControls}>
                {contributingCircleIds.length > 0 ? (
                  isSaved ? (
                    <View style={styles.savedPill} accessibilityRole="text">
                      <Text style={styles.savedPillText}>✓ Saved</Text>
                    </View>
                  ) : (
                    <Pressable accessibilityRole="button" onPress={() => void saveCurrentAsTemplate()}>
                      <Text style={styles.linkText}>{isSingleCircle ? "Save" : "Save as template"}</Text>
                    </Pressable>
                  )
                ) : (
                  <View />
                )}
                {savedDefaultText !== null ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Template"
                    onPress={() => changeMessage(message.trim() ? `${message}\n${savedDefaultText}` : savedDefaultText)}
                    style={styles.templateInlineButton}
                  >
                    <Ionicons name="book-outline" size={16} color={colors.link} />
                    <Text style={styles.linkText}>Template</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : needsNamingGroups.length > 0 ? (
            // Optional rename opportunity for a freshly-bundled Circle —
            // sequenced here deliberately: after instant messages for this
            // round are done, before the Personalise choice below, and
            // regardless of whether this particular Circle was actually
            // messaged this session (2026-08-13). See
            // docs/09-decision-log.md.
            <View style={styles.namingList}>
              {needsNamingGroups.map((group) => (
                <View key={group.id} style={styles.pendingPromptRow}>
                  <View style={styles.namingLabelRow}>
                    <HoldMark size={16} />
                    <Text style={styles.pendingPromptText}>{group.name}</Text>
                  </View>
                  <View style={styles.pendingPromptActions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void keepPlaceholderName(group)}
                      style={styles.smallPill}
                    >
                      <Text style={styles.smallPillText}>Leave as is</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => openRename(group)} style={styles.smallPill}>
                      <Text style={styles.smallPillText}>Rename</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : coverage.complete ? (
            // Inline, in the space the text box vacated — nothing left to
            // compose once everyone's been reached and nobody's currently
            // reselected. "Not now" collapses this rather than dismissing
            // it, so it can be reopened and reconsidered later, same
            // reveal-on-demand pattern as OOO/status below. See
            // docs/09-decision-log.md, 2026-08-12.
            <View>
              {notNowCollapsed ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: false }}
                  onPress={() => setNotNowCollapsed(false)}
                  style={styles.oooHeader}
                >
                  <Text style={styles.oooHeaderText}>Reply to anyone properly?</Text>
                  <Text style={styles.oooChevron}>▼</Text>
                </Pressable>
              ) : (
                <>
                  <Text style={styles.gatePrompt}>Want to reply to anyone properly?</Text>
                  <View style={styles.actions}>
                    <SecondaryButton
                      label={showPersonalise ? "Hide" : "Conversations"}
                      onPress={() => (showPersonalise ? setShowPersonalise(false) : openPersonalise())}
                    />
                    <SecondaryButton label="Not now" onPress={() => setNotNowCollapsed(true)} />
                  </View>
                </>
              )}
            </View>
          ) : null}
        </View>

        {/* Same Conversations implementation Library's own standalone tab
            renders — "flat" mode, since this period's audience is already
            fixed (no browsing/selection step needed, unlike Library's own
            potentially-much-larger, unscoped list). onSentFromAccordion
            already records this session's "personalise_completed" step via
            the onPersonAction callback passed to useConversations above.
            See docs/09-decision-log.md, 2026-08-20. */}
        {showPersonalise ? <ConversationsView conversations={conversations} mode="flat" /> : null}

        {/* Wider World, after Conversations — matching the confirmed
            completion-screen order (2026-08-13): circle row → Conversations
            → Wider World → Done. Was rendering before Conversations, the
            reverse of spec — moved 2026-08-29 (item 5); nothing else about
            this block changed. */}
        {coverage.complete && showOoo ? (
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

            {/*
             * Unified taken-down row (2026-08-30), Reconnect's own
             * "turned off/confirmed" mode — social platforms marked
             * posted-to plus real linked email accounts, one row, matching
             * Going Quiet's own unified compose-side row exactly (solid
             * fill for done, one-directional). A manual-only out-of-office
             * (no real linked account to deactivate) has nothing to put in
             * the row, so it keeps its own separate reminder line above
             * it. See docs/09-decision-log.md.
             */}
            {oooExpanded ? (
              <View style={styles.oooBody}>
                {period.emailOutOfOfficeEnabled && (period.emailLinkedAccounts?.length ?? 0) === 0 ? (
                  <View style={styles.widerWorldOption}>
                    <Text style={styles.widerWorldOptionLabel}>Email</Text>
                    {manualEmailReminderAcknowledged ? (
                      <Text style={styles.settledText}>Reminder acknowledged.</Text>
                    ) : (
                      <Pressable accessibilityRole="button" onPress={() => setManualEmailReminderAcknowledged(true)}>
                        <Text style={styles.linkText}>Remember to remove your manual out-of-office</Text>
                      </Pressable>
                    )}
                  </View>
                ) : null}

                {takenDownRowPlatforms.length > 0 ? (
                  <WiderWorldPlatformRow
                    label="Taken down / turned off"
                    platforms={takenDownRowPlatforms}
                    markedIds={takenDownMarkedIds}
                    onToggle={toggleTakenDownPlatform}
                    onMarkAll={() => markAllTakenDown(takenDownRowPlatforms)}
                  />
                ) : period.widerWorldStatusEnabled ? (
                  <View style={styles.widerWorldOption}>
                    <Text style={styles.widerWorldOptionLabel}>Status</Text>
                    {statusCleared ? (
                      <Text style={styles.settledText}>Status cleared.</Text>
                    ) : (
                      <Pressable accessibilityRole="button" onPress={clearStatus}>
                        <Text style={styles.linkText}>Clear my status</Text>
                      </Pressable>
                    )}
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        <View style={styles.sendRow}>
          {/* The one exit control on this screen — never a send trigger.
              Always available once at least one message has gone out. See
              docs/09-decision-log.md, 2026-08-13. */}
          {coverage.contactedIds.length > 0 ? (
            <SecondaryButton label="Done" onPress={finishReconnecting} />
          ) : null}
        </View>
      </Pressable>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      justifyContent: "space-between",
      gap: theme.spacing.xl
    },
    lockCatcher: {
      gap: theme.spacing.xl
    },
    top: {
      gap: theme.spacing.lg
    },
    // "+" pinned outside the scroll (never scrolls away), "All" first
    // inside it — matches GroupPicker.tsx's own pinnedRow/newCircleStack
    // treatment exactly. See docs/09-decision-log.md, 2026-08-13.
    pinnedRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm
    },
    pillScroll: {
      flex: 1
    },
    chipRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
    },
    excludedLineText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20
    },
    chipGreyed: {
      opacity: 0.4
    },
    // Real-Circle membership edit card (2026-08-30) — deliberately not
    // PrimaryButton for "Save changes": that component's own doc is
    // explicit it's for a once-per-visit flow completion, not a repeated
    // per-item action, and this can appear once per expanded Circle.
    editCard: {
      gap: theme.spacing.sm
    },
    editAddPill: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center"
    },
    editAddedUnit: {
      alignItems: "center",
      gap: 2
    },
    editAddedTag: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "600"
    },
    saveChangesButton: {
      alignSelf: "flex-start",
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: colors.primary,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md
    },
    saveChangesText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "700"
    },
    // Wraps tightly to the chip's own rendered size — the dropdown arrow is
    // positioned inside it, not beside it. Matches GroupPicker.tsx's own
    // circleUnit/arrowButton treatment exactly.
    circleUnit: {
      position: "relative",
      alignSelf: "flex-start"
    },
    arrowButton: {
      position: "absolute",
      right: 10,
      bottom: 12,
      alignItems: "center",
      justifyContent: "center"
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
    gatePrompt: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22
    },
    namingList: {
      gap: theme.spacing.md
    },
    namingLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
    },
    pendingPromptRow: {
      gap: theme.spacing.sm
    },
    pendingPromptText: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 23,
      fontWeight: "600"
    },
    pendingPromptActions: {
      flexDirection: "row",
      gap: theme.spacing.sm
    },
    smallPill: {
      minHeight: 40,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong
    },
    smallPillText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600"
    },
    settledText: {
      color: colors.textMuted,
      fontSize: 14
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
    widerWorldOption: {
      gap: theme.spacing.xs
    },
    widerWorldOptionLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600"
    },
    actions: {
      gap: theme.spacing.sm
    }
  });
}
