import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
import { EmailOutOfOffice } from "@/components/EmailOutOfOffice";
import { WiderWorldStatus } from "@/components/WiderWorldStatus";
import { SafeguardingBanner } from "@/components/SafeguardingBanner";
import { useSafeguardingCheck } from "@/hooks/useSafeguardingCheck";
import { HOLD_INTENTS } from "@/constants/copy";
import { HAS_SEEN_EXCLUDED_LINE_NOTE_KEY } from "@/constants/storageKeys";
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
import { activateOutOfOffice } from "@/services/emailAccountService";
import { copyToClipboard } from "@/services/clipboardService";
import { channelKey, sendToCircles } from "@/services/smsService";
import { getDefaultSendingChannel } from "@/services/sendingPreferencesService";
import { pickContact } from "@/services/contactPickerService";
import { addContactToGroup, getGroup, getGroups, initialsPlaceholderName } from "@/services/circleService";
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
type ActiveField =
  | "new-circle"
  | "group-message"
  | "ooo-shared"
  | `ooo-account-message:${string}`
  | `ooo-account-label:${string}`
  | "wider-world-status";

const DEFAULT_OOO_MESSAGE =
  "I’m currently away and will respond when I’m back. Thank you for understanding.";
const DEFAULT_STATUS_LINE = "Taking some quiet time. Back soon.";

/**
 * "P & A" for two people, "P, A & J" for three or more, a bare initial for
 * one — the auto-generated placeholder name for a bundled ad-hoc Circle
 * (2026-08-13, replaces the earlier generic "New Circle"/"New Circle N").
 * This is now the Circle's real, final name unless the person changes it
 * later — polished and specific from the start, not a numbered stand-in.
 * See docs/09-decision-log.md.
 */
interface RemovedPerson {
  contactId: string;
  name: string;
  phoneNumber: string;
  originalCircleId: string;
  originalCircleName: string;
  /** Already bundled into at least one provisional Circle — stays true once set; re-adding to a further bundle doesn't clear it. */
  claimed: boolean;
}

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
 * least one send). Personalise is Reconnect-only now — Going Quiet replaces
 * it with an ad-hoc "spin removed people into a new Circle" mechanic. See
 * docs/09-decision-log.md, 2026-08-11.
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
    splitRecipientsIntoNewCircle,
    recipientCircleOverrides
  } = useHoldFlow();
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Every real Circle, independent of the current selection — needed for
  // sentCircleIds and to number placeholder names for provisional Circles.
  const [allGroups, setAllGroups] = useState<CircleGroup[]>([]);
  const [period, setPeriod] = useState<HoldPeriod | null>(null);

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

  // Screen-level roster of everyone removed from any Circle's dropdown this
  // session — replaces Going Quiet's own Personalise integration
  // (2026-08-11). See docs/09-decision-log.md.
  const [removedPeople, setRemovedPeople] = useState<RemovedPerson[]>([]);
  const [bundleSelectedIds, setBundleSelectedIds] = useState<Set<string>>(new Set());

  const [oooExpanded, setOooExpanded] = useState(false);
  const [newCircleName, setNewCircleName] = useState("");
  const [sendAsGroupDraft, setSendAsGroupDraft] = useState(false);
  // Exactly one DockedInputBar serves every field on this screen — this is
  // which one, if any, currently owns it. See docs/09-decision-log.md, 2026-08-10.
  const [activeField, setActiveField] = useState<ActiveField | null>(null);

  // ON by default here, deliberately opposite Reconnect's own OOO handling
  // (which never has its own enable toggle at all — see docs/09-decision-log.md,
  // 2026-08-21) — going quiet is the moment out-of-office is most likely wanted.
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [useSameEmailMessage, setUseSameEmailMessage] = useState(true);
  const [sharedEmailMessage, setSharedEmailMessage] = useState(DEFAULT_OOO_MESSAGE);
  const [widerWorldEnabled, setWiderWorldEnabled] = useState(false);
  const [widerWorldText, setWiderWorldText] = useState(DEFAULT_STATUS_LINE);

  const refreshPeriod = useCallback(async () => {
    setPeriod(await getOpenHoldPeriod());
  }, []);

  const refreshGroups = useCallback(async () => {
    setAllGroups(await getGroups());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshPeriod();
      void refreshGroups();
    }, [refreshPeriod, refreshGroups])
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
   * several selected Circles at once. Deliberately separate from
   * `removedPeople` (the persistent, unscoped roster the "+" bundle action
   * reads from below) — that one stays exactly as it was, still reachable
   * regardless of selection, since its own job (re-bundling anyone,
   * eventually) is different from this line's job (at-a-glance visibility
   * for the current send). Both read from the same underlying exclusion,
   * just scoped differently. See docs/09-decision-log.md.
   */
  const excludedFromSelected = goingQuietRecipients.filter(
    (recipient) => !recipient.included && selectedGroups.some((group) => group.id === recipient.circleId)
  );

  const activeOooAccountMessageId = activeField?.startsWith("ooo-account-message:")
    ? activeField.slice("ooo-account-message:".length)
    : null;
  const activeOooAccountLabelId = activeField?.startsWith("ooo-account-label:")
    ? activeField.slice("ooo-account-label:".length)
    : null;
  const activeOooAccount = activeOooAccountMessageId
    ? emailAccounts.find((a) => a.id === activeOooAccountMessageId)
    : activeOooAccountLabelId
      ? emailAccounts.find((a) => a.id === activeOooAccountLabelId)
      : undefined;

  const activeFieldValue = (): string => {
    if (activeField === "new-circle") return newCircleName;
    if (activeField === "group-message") return message;
    if (activeField === "ooo-shared") return sharedEmailMessage;
    if (activeOooAccountMessageId) return activeOooAccount?.message ?? "";
    if (activeOooAccountLabelId) return activeOooAccount?.label ?? "";
    if (activeField === "wider-world-status") return widerWorldText;
    return "";
  };

  const setActiveFieldValue = (text: string) => {
    if (activeField === "new-circle") {
      setNewCircleName(text);
    } else if (activeField === "group-message") {
      setMessage(text);
    } else if (activeField === "ooo-shared") {
      setSharedEmailMessage(text);
    } else if (activeOooAccountMessageId) {
      setEmailAccounts((current) =>
        current.map((a) => (a.id === activeOooAccountMessageId ? { ...a, message: text } : a))
      );
    } else if (activeOooAccountLabelId) {
      setEmailAccounts((current) =>
        current.map((a) => (a.id === activeOooAccountLabelId ? { ...a, label: text } : a))
      );
    } else if (activeField === "wider-world-status") {
      setWiderWorldText(text);
    }
  };

  const activeFieldLabel = (): string => {
    if (activeField === "new-circle") return "New Circle name";
    if (activeField === "group-message") return `Message to ${joinedGroupNames}`;
    if (activeField === "ooo-shared") return "Out-of-office message";
    if (activeOooAccountMessageId) return `Message for ${activeOooAccount?.label ?? "account"}`;
    if (activeOooAccountLabelId) return "Account label";
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

  const resolvedEmailMessageFor = (account: EmailAccount) =>
    (useSameEmailMessage ? sharedEmailMessage : account.message).trim();

  /** Excludes a recipient from the current group message and moves them into the screen-level removed-people roster. See docs/09-decision-log.md, 2026-08-11. */
  /** First-use explainer for the excluded-line/temporary-Circle pattern — same gated-Alert shape as PersonaliseAccordion's own retention-note explainer, not assumed self-evident on first encounter. See docs/09-decision-log.md, 2026-08-20. */
  const showExcludedLineExplainerOnce = () => {
    void (async () => {
      const hasSeen = await AsyncStorage.getItem(HAS_SEEN_EXCLUDED_LINE_NOTE_KEY);
      if (hasSeen) return;

      await AsyncStorage.setItem(HAS_SEEN_EXCLUDED_LINE_NOTE_KEY, "true");
      Alert.alert(
        "Excluded for now",
        "Anyone you untap shows up here, greyed once they're settled into their own Circle. Tap the \"+\" to give one or more of them their own Circle whenever you're ready — untapping never sends anything on its own."
      );
    })();
  };

  const handleRemoveRecipient = (contactId: string, group: CircleGroup) => {
    const recipient = goingQuietRecipients.find((r) => r.contactId === contactId);
    if (!recipient) return;

    showExcludedLineExplainerOnce();
    toggleRecipientIncluded(contactId, message);
    setRemovedPeople((current) =>
      current.some((person) => person.contactId === contactId)
        ? current
        : [
            ...current,
            {
              contactId,
              name: recipient.name,
              phoneNumber: recipient.phoneNumber,
              originalCircleId: group.id,
              originalCircleName: group.name,
              claimed: false
            }
          ]
    );
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

  const toggleBundleSelected = (contactId: string) => {
    setBundleSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  /**
   * "+" beneath the removed-people roster — bundles either the specifically
   * selected people, or (nobody selected) every currently-unclaimed
   * (forest-green) person, into one new provisional Circle. Re-adding an
   * already-claimed (sage) person doesn't cancel their existing message —
   * confirmed as deliberate — though the existing phone-number dedupe in
   * mergeGoingQuietRecipients means a person can only ever be actively
   * attributed to ONE Circle at a time for send purposes; see the flagged
   * note in this pass's decision-log entry for the real limitation this
   * creates. See docs/09-decision-log.md, 2026-08-11.
   */
  const bundleIntoNewCircle = async () => {
    const targets =
      bundleSelectedIds.size > 0
        ? removedPeople.filter((person) => bundleSelectedIds.has(person.contactId))
        : removedPeople.filter((person) => !person.claimed);
    if (targets.length === 0) return;

    const placeholderName = initialsPlaceholderName(targets);
    const tempId = `${PENDING_CIRCLE_ID_PREFIX}${Date.now()}`;
    const newGroup: CircleGroup = {
      id: tempId,
      name: placeholderName,
      isCloseCircle: false,
      contacts: targets.map((person) => ({ id: person.contactId, name: person.name, phoneNumber: person.phoneNumber }))
    };

    const nextGroups = [...selectedGroups, newGroup];
    const targetIds = targets.map((person) => person.contactId);
    splitRecipientsIntoNewCircle(targetIds, newGroup);
    setRemovedPeople((current) =>
      current.map((person) => (targetIds.includes(person.contactId) ? { ...person, claimed: true } : person))
    );
    setBundleSelectedIds(new Set());
    await loadMessageForSelection(nextGroups, message);
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

    const deliveryTargets = selectedGroups
      .map((group) => ({
        circleId: group.id,
        sendAsGroup: group.sendAsGroup ?? false,
        numbers: (recipientsByCircle.get(group.id) ?? [])
          .filter((recipient) => recipient.included)
          .map((recipient) => recipient.phoneNumber)
      }))
      .filter((target) => target.numbers.length > 0);

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
    if (emailEnabled) {
      const enabledAccounts = emailAccounts
        .filter((account) => account.enabled)
        .map((account) => ({ ...account, message: resolvedEmailMessageFor(account) }));
      await activateOutOfOffice(enabledAccounts);
    }

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

    await recordPostSendChoices({
      emailOutOfOfficeEnabled: emailEnabled,
      widerWorldStatusEnabled: widerWorldEnabled
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
            aiAmend={
              activeField === "group-message"
                ? { surface: "going-quiet", context: { intent: intent ?? undefined, recipientLabel: joinedGroupNames } }
                : activeField === "ooo-shared" || activeOooAccountMessageId
                  ? { surface: "email-ooo" }
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
      />

      {/* Below the circle row, above the text box (2026-08-11 — the circle
          row must always stay topmost). See docs/09-decision-log.md. */}
      {removedPeople.length > 0 ? (
        <View style={styles.removedRosterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.removedRosterRow}>
            {removedPeople.map((person, index) => (
              <Pressable
                key={person.contactId}
                accessibilityRole="checkbox"
                accessibilityLabel={`${person.name}${person.claimed ? ", already in their own Circle" : ""}`}
                accessibilityState={{ checked: bundleSelectedIds.has(person.contactId) }}
                hitSlop={6}
                onPress={() => toggleBundleSelected(person.contactId)}
              >
                <Text
                  style={[
                    styles.removedName,
                    person.claimed && styles.removedNameClaimed,
                    bundleSelectedIds.has(person.contactId) && styles.removedNameSelected
                  ]}
                >
                  {/* "✓" prefix, not just the muted colour, marks "claimed" —
                      colour alone isn't a colour-blindness-safe distinction.
                      Fixed alongside the new excluded line below, per the
                      app's standing accessibility rule. See
                      docs/09-decision-log.md, 2026-08-20. */}
                  {person.claimed ? "✓ " : ""}
                  {person.name}
                  {index < removedPeople.length - 1 ? "," : ""}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              bundleSelectedIds.size > 0
                ? `New circle from ${bundleSelectedIds.size} selected`
                : "New circle from everyone unclaimed"
            }
            hitSlop={8}
            onPress={() => void bundleIntoNewCircle()}
            style={styles.removedBundleButton}
          >
            <Text style={styles.removedBundleButtonText}>+</Text>
          </Pressable>
        </View>
      ) : null}

      {/* At-a-glance excluded-for-this-send line — scoped to currently
          selected Circles only, merged into one line (2026-08-20). Distinct
          from the roster above: read-only, no bundling action of its own,
          just visibility. "✓" marks anyone already claimed into a
          provisional Circle — greyed AND marked, not colour alone. See
          docs/09-decision-log.md. */}
      {excludedFromSelected.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.excludedLineRow}
        >
          {excludedFromSelected.map((recipient) => {
            const claimed = removedPeople.find((person) => person.contactId === recipient.contactId)?.claimed ?? false;
            return (
              <AdaptiveCircleChip
                key={recipient.contactId}
                label={claimed ? `✓ ${recipient.name}` : recipient.name}
                compact
                isSelected={false}
                onPress={() => {}}
                accessibilityRole="text"
                accessibilityLabel={
                  claimed ? `${recipient.name}, excluded, already in their own Circle` : `${recipient.name}, excluded`
                }
              />
            );
          })}
        </ScrollView>
      ) : null}

      {expandedGroup ? (
        <View style={styles.circleSection}>
          <Text style={styles.sectionLabel}>{expandedGroup.name}</Text>
          <RecipientPersonalisation
            recipients={expandedGroupRecipients}
            onToggleIncluded={(contactId) => handleRemoveRecipient(contactId, expandedGroup)}
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

          {/* Done — a genuinely separate concept from Send (early exit vs.
              the compose row's own primary action), kept on its own row
              rather than folded into Template/Send/Save. Only ever
              renders once something's actually been sent this session. */}
          {doneButton ? <View style={styles.sendRow}>{doneButton}</View> : null}
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

          <View style={styles.sendRow}>
            {doneButton}
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
              <EmailOutOfOffice
                enabled={emailEnabled}
                onToggleEnabled={setEmailEnabled}
                accounts={emailAccounts}
                onAccountsChange={setEmailAccounts}
                useSameMessage={useSameEmailMessage}
                onToggleUseSameMessage={setUseSameEmailMessage}
                sharedMessage={sharedEmailMessage}
                onChangeSharedMessage={setSharedEmailMessage}
                activeField={activeField}
                onActivateField={(key) => setActiveField(key as ActiveField)}
              />

              <WiderWorldStatus
                enabled={widerWorldEnabled}
                onToggleEnabled={setWiderWorldEnabled}
                text={widerWorldText}
                onChangeText={setWiderWorldText}
                isActive={activeField === "wider-world-status"}
                onActivate={() => setActiveField("wider-world-status")}
              />
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: theme.spacing.lg
    },
    removedRosterSection: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
    },
    removedRosterRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs
    },
    excludedLineRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs
    },
    removedName: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
      minHeight: 44,
      textAlignVertical: "center",
      paddingVertical: theme.spacing.xs
    },
    removedNameClaimed: {
      color: colors.textMuted,
      fontWeight: "500"
    },
    removedNameSelected: {
      color: colors.primary,
      textDecorationLine: "underline"
    },
    removedBundleButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center"
    },
    removedBundleButtonText: {
      color: colors.primary,
      fontSize: 20,
      fontWeight: "700",
      lineHeight: 22
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
    }
  });
}
