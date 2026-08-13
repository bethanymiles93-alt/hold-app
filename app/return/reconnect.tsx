import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { SecondaryButton } from "@/components/SecondaryButton";
import { DockedInputBar } from "@/components/DockedInputBar";
import { DockedFieldPreview } from "@/components/DockedFieldPreview";
import { MemoryNoteSuggestion } from "@/components/MemoryNoteSuggestion";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { HoldMark } from "@/components/HoldMark";
import { PersonaliseCandidateList } from "@/components/PersonaliseCandidateList";
import { PENDING_CIRCLE_ID_PREFIX } from "@/components/GroupPicker";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { usePersonaliseCompletion } from "@/hooks/usePersonaliseCompletion";
import { useComposingGestureLock } from "@/hooks/useComposingGestureLock";
import { useHoldFlow } from "@/context/HoldFlowContext";
import {
  addToReconnectingAudience,
  beginReconnecting,
  getHoldPeriodById,
  getReconnectCoverage,
  getReconnectingPeriod,
  markReconnectContacted,
  recordSendChannel,
  renameCircleInPeriod,
  resolvePendingCircleInPeriod
} from "@/services/holdHistoryService";
import {
  getAll as getAllConversationPeople,
  markContacted,
  seedFromAudience
} from "@/services/conversationService";
import { addContactToGroup, createGroup, getGroups, renameGroup } from "@/services/circleService";
import { pickContact } from "@/services/contactPickerService";
import { deactivateOutOfOffice } from "@/services/emailAccountService";
import { channelKey, sendIndividual, sendToCircles } from "@/services/smsService";
import { getDefaultSendingChannel } from "@/services/sendingPreferencesService";
import {
  getReconnectCircleTemplate,
  getReconnectCombinationTemplate,
  saveReconnectCircleTemplate,
  saveReconnectCombinationTemplate
} from "@/services/reconnectTemplateService";
import { clearDraft, getDraft, saveDraft } from "@/services/messageDraftService";
import type { AudienceCircle, CircleGroup, HoldPeriod } from "@/types/hold";

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
  const { reconnectPeriodId } = useHoldFlow();

  const [period, setPeriod] = useState<HoldPeriod | null>(null);
  const [message, setMessage] = useState(DEFAULT_RECONNECT_MESSAGE);
  const [savedDefaultText, setSavedDefaultText] = useState<string | null>(null);
  const [emailOff, setEmailOff] = useState(false);
  const [statusCleared, setStatusCleared] = useState(false);
  const [suggestedPrompt, setSuggestedPrompt] = useState<string | undefined>(undefined);
  // Open by default specifically at this point in the flow (once every
  // Circle/contact has been reached) — a deliberate correction (2026-08-12)
  // to the earlier "collapsed by default" decision (docs/09-decision-log.md,
  // 2026-08-11, "16. OOO/status-before-Transition sequencing"), scoped to
  // Reconnect's own post-coverage-complete moment only. See
  // docs/09-decision-log.md, 2026-08-12.
  const [oooExpanded, setOooExpanded] = useState(true);
  const [messageFieldActive, setMessageFieldActive] = useState(false);
  const [showPersonalise, setShowPersonalise] = useState(false);
  // Declining Personalise no longer finishes Reconnect (that's "Done" now,
  // below) — it just collapses this inline choice, reopenable via the same
  // dropdown-arrow "reveal on demand" pattern used elsewhere. See
  // docs/09-decision-log.md, 2026-08-12.
  const [notNowCollapsed, setNotNowCollapsed] = useState(false);
  const personalise = usePersonaliseCompletion();

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
   * Circles freshly made real from Going Quiet's ad-hoc bundling flow,
   * still carrying their auto-generated initials placeholder name — the
   * optional rename opportunity (2026-08-13) offers to change it, or
   * confirms leaving it as-is; either way is final, not a recurring nag.
   * See docs/09-decision-log.md.
   */
  const [needsNamingGroups, setNeedsNamingGroups] = useState<CircleGroup[]>([]);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  // Disables swipe-back whenever any docked field on this screen is
  // actively focused (the message box, the rename field, or a Personalise
  // reply) — same shared mechanism as Going Quiet/Library, not a separate
  // one. See docs/09-decision-log.md, 2026-08-13.
  useComposingGestureLock(
    renamingGroupId !== null || messageFieldActive || personalise.replyTarget !== null
  );

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
      const coverage = getReconnectCoverage(current);
      setIncludedPersonIds(new Set(coverage.totalIds.filter((id) => !coverage.contactedIds.includes(id))));
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

  const changeTemplate = () => {
    setMessage(DEFAULT_RECONNECT_MESSAGE);
    openMessageField();
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
   * Single bulk toggle, no multi-tap cycle: if this Circle currently has
   * any included person, tapping excludes all of them; otherwise it
   * includes all of them. Also expands the Circle (so the effect is
   * visible) — the chip never collapses one, only the arrow does that.
   * Deliberately does not lock on its own; this is an in-row adjustment,
   * same as an individual pill tap.
   */
  const toggleCircleChip = (circle: AudienceCircle) => {
    const anyIncluded = circle.contacts.some((contact) => includedPersonIds.has(contact.phoneNumber));
    setIncludedPersonIds((current) => {
      const next = new Set(current);
      for (const contact of circle.contacts) {
        if (anyIncluded) next.delete(contact.phoneNumber);
        else next.add(contact.phoneNumber);
      }
      return next;
    });
    setExpandedCircleIds((current) => new Set(current).add(circle.circleId));
  };

  const togglePersonIncluded = (phoneNumber: string) => {
    setIncludedPersonIds((current) => {
      const next = new Set(current);
      if (next.has(phoneNumber)) next.delete(phoneNumber);
      else next.add(phoneNumber);
      return next;
    });
  };

  /**
   * Adds a new ungrouped person to this period's audience mid-Reconnect —
   * `addToAudience` (used elsewhere for the same "someone new reached out"
   * case) only ever targets the currently-OPEN period, which this no
   * longer is by the time Reconnect is on screen, hence the dedicated
   * `addToReconnectingAudience`. refresh() re-seeds includedPersonIds
   * afterward, which already includes the new (not-yet-contacted) person —
   * no separate include step needed.
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
      numbers: circle.contacts.map((contact) => contact.phoneNumber)
    }));

    const defaultChannel = await getDefaultSendingChannel();
    const channelByCircle = await sendToCircles(deliveryTargets, text, defaultChannel);
    for (const [id, channel] of channelByCircle) {
      await recordSendChannel(period.id, id, channelKey(channel));
    }

    for (const contact of ungrouped) {
      try {
        const channel = await sendIndividual(contact.phoneNumber, text, defaultChannel);
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

    const phoneNumbers = [
      ...(period.audienceCircles ?? []).flatMap((circle) => circle.contacts.map((contact) => contact.phoneNumber)),
      ...(period.audienceUngrouped ?? []).map((contact) => contact.phoneNumber)
    ];
    void personalise.loadAlreadySeeded(phoneNumbers);
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

  const turnOffEmail = () => {
    void deactivateOutOfOffice();
    setEmailOff(true);
  };

  const clearStatus = () => {
    setStatusCleared(true);
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
            aiAmend={{ surface: "reconnect", initialPrompt: suggestedPrompt }}
          />
        ) : personalise.replyTarget ? (
          <DockedInputBar
            value={personalise.drafts[personalise.replyTarget.personId] ?? ""}
            onChangeText={personalise.replyTarget.onChangeText}
            onDone={personalise.closeReply}
            placeholder="Your reply"
            accessibilityLabel="Your reply"
            aiAmend={{
              surface: "conversations-reply",
              context: { friendMessage: personalise.replyTarget.friendMessage }
            }}
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

              {orderedAudienceCircles.map((circle) => {
                const isExpanded = expandedCircleIds.has(circle.circleId);
                const allIncluded =
                  circle.contacts.length > 0 &&
                  circle.contacts.every((contact) => includedPersonIds.has(contact.phoneNumber));
                const hasSentThisSession =
                  circle.contacts.length > 0 &&
                  circle.contacts.every((contact) => coverage.contactedIds.includes(contact.phoneNumber));

                return (
                  <View key={circle.circleId} style={styles.circleUnit}>
                    <AdaptiveCircleChip
                      label={circle.circleName}
                      isSelected={allIncluded}
                      hasSentThisSession={hasSentThisSession}
                      notYetSent={coverage.complete && !hasSentThisSession}
                      onPress={() => toggleCircleChip(circle)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        allIncluded
                          ? `${circle.circleName}, everyone included. Tap to exclude everyone.`
                          : `${circle.circleName}. Tap to include everyone.`
                      }
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${circle.circleName}, ${isExpanded ? "hide" : "show"} people`}
                      accessibilityState={{ expanded: isExpanded }}
                      hitSlop={8}
                      onPress={() => toggleCircleArrow(circle.circleId)}
                      style={styles.arrowButton}
                    >
                      {({ pressed }) => (
                        <View style={[styles.arrowBadge, pressed && styles.arrowPressed]}>
                          <Text style={styles.arrowGlyph}>{isExpanded ? "▲" : "▼"}</Text>
                        </View>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {hasComposeTargets ? (
            <MemoryNoteSuggestion
              onUseIt={(prompt) => {
                setSuggestedPrompt(prompt);
                openMessageField();
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
              {pillPeople.length > 0 ? (
                <AdaptiveCircleChip
                  label="All"
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
                      label={sentLook ? `✓ ${person.name}` : person.name}
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
              />
              <View style={styles.messageControls}>
                <Pressable accessibilityRole="button" onPress={changeTemplate}>
                  <Text style={styles.linkText}>Change template</Text>
                </Pressable>
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
                      label={showPersonalise ? "Hide" : "Personalise"}
                      onPress={() => (showPersonalise ? setShowPersonalise(false) : openPersonalise())}
                    />
                    <SecondaryButton label="Not now" onPress={() => setNotNowCollapsed(true)} />
                  </View>
                </>
              )}
            </View>
          ) : null}

          {coverage.complete && showOoo ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: oooExpanded }}
                onPress={() => setOooExpanded((current) => !current)}
                style={styles.oooHeader}
              >
                <Text style={styles.oooHeaderText}>OOO and status</Text>
                <Text style={styles.oooChevron}>{oooExpanded ? "▲" : "▼"}</Text>
              </Pressable>

              {oooExpanded ? (
                <View style={styles.oooBody}>
                  {period.emailOutOfOfficeEnabled ? (
                    emailOff ? (
                      <Text style={styles.settledText}>Out-of-office turned off.</Text>
                    ) : (
                      <Pressable accessibilityRole="button" onPress={turnOffEmail}>
                        <Text style={styles.linkText}>Turn off out-of-office</Text>
                      </Pressable>
                    )
                  ) : null}

                  {period.widerWorldStatusEnabled ? (
                    statusCleared ? (
                      <Text style={styles.settledText}>Status cleared.</Text>
                    ) : (
                      <Pressable accessibilityRole="button" onPress={clearStatus}>
                        <Text style={styles.linkText}>Clear my status</Text>
                      </Pressable>
                    )
                  ) : null}
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        {showPersonalise ? (
          <PersonaliseCandidateList
            people={personalise.people}
            expandedId={personalise.expandedId}
            onToggle={personalise.toggle}
            onSent={() => void refresh()}
            drafts={personalise.drafts}
            onChangeDraft={personalise.onChangeDraft}
            styles={personalise.styles}
            onChangeStyle={personalise.onChangeStyle}
            replyTargetPersonId={personalise.replyTarget?.personId ?? null}
            onActivateReply={personalise.activateReply}
          />
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
    chipGreyed: {
      opacity: 0.4
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
      right: 6,
      bottom: 8,
      alignItems: "center",
      justifyContent: "center"
    },
    arrowBadge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0, 0, 0, 0.12)"
    },
    arrowPressed: {
      opacity: 0.6
    },
    arrowGlyph: {
      color: colors.textMuted,
      fontSize: 13,
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
    messageControls: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.lg
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
    actions: {
      gap: theme.spacing.sm
    }
  });
}
