import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { GroupPicker, PENDING_CIRCLE_ID_PREFIX } from "@/components/GroupPicker";
import { ChoiceCard } from "@/components/ChoiceCard";
import { RecipientPersonalisation } from "@/components/RecipientPersonalisation";
import { PrimaryButton } from "@/components/PrimaryButton";
import { CompactSendButton } from "@/components/CompactSendButton";
import { DockedInputBar } from "@/components/DockedInputBar";
import { DockedFieldPreview } from "@/components/DockedFieldPreview";
import { EmailOutOfOffice } from "@/components/EmailOutOfOffice";
import { WiderWorldStatus } from "@/components/WiderWorldStatus";
import { SafeguardingBanner } from "@/components/SafeguardingBanner";
import { PersonaliseCandidateList } from "@/components/PersonaliseCandidateList";
import { useSafeguardingCheck } from "@/hooks/useSafeguardingCheck";
import { usePersonaliseCompletion } from "@/hooks/usePersonaliseCompletion";
import { HOLD_INTENTS } from "@/constants/copy";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { buildAudienceCircles, useHoldFlow } from "@/context/HoldFlowContext";
import { createDraft } from "@/services/draftService";
import {
  getOpenHoldPeriod,
  recordPostSendChoices,
  recordSendChannel,
  startHoldPeriod,
  syncAudience
} from "@/services/holdHistoryService";
import { seedPersonaliseRecipient } from "@/services/conversationService";
import { activateOutOfOffice } from "@/services/emailAccountService";
import { copyToClipboard } from "@/services/clipboardService";
import { channelKey, sendOrShare } from "@/services/smsService";
import { pickContact } from "@/services/contactPickerService";
import { getGroups } from "@/services/circleService";
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
  | `recipient:${string}`
  | "ooo-shared"
  | `ooo-account-message:${string}`
  | `ooo-account-label:${string}`
  | "wider-world-status";

const DEFAULT_OOO_MESSAGE =
  "I’m currently away and will respond when I’m back. Thank you for understanding.";
const DEFAULT_STATUS_LINE = "Taking some quiet time. Back soon.";

/**
 * Sequential, group-based Going Quiet (2026-08-11 redesign — supersedes the
 * earlier per-Circle-card architecture). Any selected subset of Circles is
 * ONE group: one shared message (the single, app-wide docked bar — no other
 * text-entry surface on this screen), one Send action. Send, then the
 * selection clears back to empty so the next group can be picked — repeat
 * until Done or every Circle is covered. Matches the same flat-selection +
 * shared-message pattern already proven in app/return/update.tsx ("Send an
 * update"), extended here with combination-keyed saved templates (see
 * templateService.ts) that update.tsx doesn't need. See
 * docs/09-decision-log.md, 2026-08-11.
 */
export default function HoldPeopleScreen() {
  const {
    recipients,
    selectedGroups,
    toggleGroup,
    goingQuietRecipients,
    toggleRecipientIncluded,
    setRecipientIndividuallyRemoved,
    setRecipientInstantMessage,
    setRecipientRouteToPersonalise,
    splitRecipientsIntoNewCircle
  } = useHoldFlow();
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const personalise = usePersonaliseCompletion();

  // Every real Circle, independent of the current selection — needed to
  // resolve `sentCircleIds` against something durable (a Circle sent to
  // earlier this session but not currently selected still needs to show
  // its filled chip), and to number placeholder names for provisional
  // Circles split off mid-flow (below).
  const [allGroups, setAllGroups] = useState<CircleGroup[]>([]);
  const [period, setPeriod] = useState<HoldPeriod | null>(null);

  // The one shared message for whichever Circle-combination is currently
  // selected — not per-Circle. `savedDefaultText` is whichever saved
  // default (single-Circle or combination) currently backs it, if any;
  // `null` means this exact combination has never had one saved.
  const [message, setMessage] = useState("");
  const [savedDefaultText, setSavedDefaultText] = useState<string | null>(null);
  const [startingPoints, setStartingPoints] = useState<{ circleId: string; circleName: string; text: string }[]>(
    []
  );
  const [intent, setIntent] = useState<HoldIntent | null>(null);
  // "Change template" escape hatch back to the intent chips even once a
  // default already backs the current combination — mirrors the old
  // per-Circle version of the same control.
  const [forceShowChips, setForceShowChips] = useState(false);

  const [bundleSelectedIds, setBundleSelectedIds] = useState<Set<string>>(new Set());

  const [personalPromptChoice, setPersonalPromptChoice] = useState<"pending" | "not-now" | "personalise">(
    "pending"
  );
  const [oooExpanded, setOooExpanded] = useState(false);
  const [newCircleName, setNewCircleName] = useState("");
  // Exactly one DockedInputBar serves every field on this screen — this is
  // which one, if any, currently owns it. See docs/09-decision-log.md, 2026-08-10.
  const [activeField, setActiveField] = useState<ActiveField | null>(null);

  const [emailEnabled, setEmailEnabled] = useState(false);
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

  // sendChannels also holds individual-recipient phone-number keys (from the
  // per-recipient instant-message loop in send()) — filtering to known real
  // (or currently-selected provisional) Circle ids keeps this to genuine
  // whole-Circle group sends only.
  const knownCircleIds = useMemo(() => {
    const ids = new Set(allGroups.map((group) => group.id));
    for (const group of selectedGroups) ids.add(group.id);
    return ids;
  }, [allGroups, selectedGroups]);

  const sentCircleIds = useMemo(() => {
    if (!period?.sendChannels) return [];
    return Object.keys(period.sendChannels).filter((id) => knownCircleIds.has(id));
  }, [period, knownCircleIds]);

  const hasSentAnything = sentCircleIds.length > 0;

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

  const excludedNotRemoved = goingQuietRecipients.filter(
    (recipient) =>
      !recipient.included && !recipient.individuallyRemoved && sentCircleIds.includes(recipient.circleId)
  );
  // Strict one-at-a-time reveal: nothing to personalise means stage 2 has
  // nothing to answer, so it's treated as already resolved.
  const personalPromptResolved = excludedNotRemoved.length === 0 || personalPromptChoice !== "pending";

  const activeContactId = activeField?.startsWith("recipient:") ? activeField.slice("recipient:".length) : null;
  const activeOooAccountMessageId = activeField?.startsWith("ooo-account-message:")
    ? activeField.slice("ooo-account-message:".length)
    : null;
  const activeOooAccountLabelId = activeField?.startsWith("ooo-account-label:")
    ? activeField.slice("ooo-account-label:".length)
    : null;
  const activeRecipient = activeContactId
    ? goingQuietRecipients.find((r) => r.contactId === activeContactId)
    : undefined;
  const activeOooAccount = activeOooAccountMessageId
    ? emailAccounts.find((a) => a.id === activeOooAccountMessageId)
    : activeOooAccountLabelId
      ? emailAccounts.find((a) => a.id === activeOooAccountLabelId)
      : undefined;

  const activeFieldValue = (): string => {
    if (activeField === "new-circle") return newCircleName;
    if (activeField === "group-message") return message;
    if (activeRecipient) return activeRecipient.instantMessage;
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
    } else if (activeContactId) {
      setRecipientInstantMessage(activeContactId, text);
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
    if (activeRecipient) return `Message for ${activeRecipient.name}`;
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
   * only when there's no saved default to load. See docs/09-decision-log.md,
   * 2026-08-11.
   */
  const loadMessageForSelection = async (groups: CircleGroup[], previousText: string) => {
    setForceShowChips(false);
    setIntent(null);

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

    // Mirrors the single-Circle precedent this replaces: whatever generic
    // text this produces auto-persists as the default immediately — no
    // separate Save tap needed for the pristine, unedited pick. Applies to
    // combinations too now (item 2) — there's no manual "Save" control
    // offered for a combination at all, so this is the only way one gets a
    // saved default (also happens again, silently, at Send — see send()).
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

  const resolvedEmailMessageFor = (account: EmailAccount) =>
    (useSameEmailMessage ? sharedEmailMessage : account.message).trim();

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
   * "+ New circle from selected" (item 8) — spins one or more already-
   * removed people into a new provisional Circle mid-flow. Provisional, not
   * immediately permanent: auto-generated placeholder name, no naming
   * prompt here — Reconnect asks whether to make it permanent (and name it
   * properly) later, regardless of whether anything was ever sent to it
   * (syncAudience already covers this — see holdHistoryService.ts). Uses
   * the same PENDING_CIRCLE_ID_PREFIX/toggleGroup-family convention as the
   * existing "+ New Circle" flow, just built from already-known recipients
   * instead of a freshly-picked contact. See docs/09-decision-log.md,
   * 2026-08-11.
   */
  const splitIntoNewCircle = async () => {
    const contactIds = Array.from(bundleSelectedIds);
    if (contactIds.length === 0) return;

    const people = goingQuietRecipients.filter((recipient) => contactIds.includes(recipient.contactId));
    if (people.length === 0) return;

    const provisionalCount = selectedGroups.filter((group) => group.id.startsWith(PENDING_CIRCLE_ID_PREFIX)).length;
    const placeholderName = provisionalCount > 0 ? `New Circle ${provisionalCount + 1}` : "New Circle";
    const tempId = `${PENDING_CIRCLE_ID_PREFIX}${Date.now()}`;
    const newGroup: CircleGroup = {
      id: tempId,
      name: placeholderName,
      isCloseCircle: false,
      contacts: people.map((person) => ({
        id: person.contactId,
        name: person.name,
        phoneNumber: person.phoneNumber
      }))
    };

    const nextGroups = [...selectedGroups, newGroup];
    splitRecipientsIntoNewCircle(contactIds, newGroup);
    setBundleSelectedIds(new Set());
    await loadMessageForSelection(nextGroups, message);
  };

  /**
   * Creates the pending (not-yet-real) Circle from whatever name is passed
   * in — typed, or a tapped suggestion. Lifted up from GroupPicker so the
   * docked bar's suggestion chips (rendered above the keyboard, not inside
   * GroupPicker's own position in the scrollable content) can trigger the
   * exact same submission GroupPicker's own "Add" button uses. See
   * docs/09-decision-log.md, 2026-08-11.
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
      contacts: [{ id: `${tempId}-contact`, name: picked.name, phoneNumber: picked.phoneNumber }]
    };

    const nextGroups = [...selectedGroups, pendingCircle];
    await toggleGroup(pendingCircle);
    await loadMessageForSelection(nextGroups, message);
    setNewCircleName("");
    setActiveField(null);
  };

  /**
   * Sends the current shared message to whichever Circles are currently
   * selected, then clears the selection so the next group can be picked —
   * "repeat until Done or every Circle is covered" (item 1). Only a Circle
   * that actually contributed at least one included recipient to this send
   * gets marked sent — a Circle whose every member was individually
   * excluded/removed this round wasn't genuinely reached by it.
   */
  const send = async () => {
    const text = message.trim();
    if (!text || selectedGroups.length === 0) return;

    // The period is created once, on this session's first Send from ANY
    // group, and reused for every subsequent Send.
    const periodId = period?.id ?? (await startHoldPeriod({
      recipients,
      audienceCircles: buildAudienceCircles(selectedGroups)
    }));

    const recipientsByCircle = new Map<string, GoingQuietRecipient[]>();
    for (const recipient of goingQuietRecipients) {
      const list = recipientsByCircle.get(recipient.circleId) ?? [];
      list.push(recipient);
      recipientsByCircle.set(recipient.circleId, list);
    }

    const contributingGroups = selectedGroups.filter((group) =>
      (recipientsByCircle.get(group.id) ?? []).some((recipient) => recipient.included)
    );
    const includedNumbers = contributingGroups.flatMap((group) =>
      (recipientsByCircle.get(group.id) ?? [])
        .filter((recipient) => recipient.included)
        .map((recipient) => recipient.phoneNumber)
    );

    if (includedNumbers.length > 0) {
      try {
        const channel = await sendOrShare(includedNumbers, text);
        for (const group of contributingGroups) {
          await recordSendChannel(periodId, group.id, channelKey(channel));
        }
      } catch {
        // Move on even if this compose sheet was dismissed.
      }
    }

    for (const group of selectedGroups) {
      const circleRecipients = recipientsByCircle.get(group.id) ?? [];

      const individualRecipients = circleRecipients.filter(
        (recipient) => !recipient.included && !recipient.individuallyRemoved && !recipient.routeToPersonalise
      );
      for (const recipient of individualRecipients) {
        const individualText = recipient.instantMessage.trim();
        if (!individualText) continue;

        try {
          const channel = await sendOrShare([recipient.phoneNumber], individualText);
          await recordSendChannel(periodId, recipient.phoneNumber, channelKey(channel));
        } catch {
          // Move on to the next person even if this compose sheet was dismissed.
        }
      }

      const personaliseRecipients = circleRecipients.filter(
        (recipient) => !recipient.included && !recipient.individuallyRemoved && recipient.routeToPersonalise
      );
      for (const recipient of personaliseRecipients) {
        await seedPersonaliseRecipient({
          name: recipient.name,
          phoneNumber: recipient.phoneNumber,
          circleId: recipient.circleId,
          circleName: recipient.circleName
        });
      }
    }

    if (selectedGroups.length > 1) {
      await saveCombinationTemplate(selectedGroups.map((group) => group.id), text);
    }

    await refreshPeriod();

    // Clear the current selection back to empty so the next group can be
    // picked — "repeat until Done or every Circle is covered."
    for (const group of selectedGroups) {
      await toggleGroup(group);
    }
    setMessage("");
    setSavedDefaultText(null);
    setStartingPoints([]);
    setIntent(null);
  };

  const choosePersonalPrompt = (choice: "not-now" | "personalise") => {
    setPersonalPromptChoice(choice);
    if (choice === "personalise") {
      void personalise.seedAndLoad(
        excludedNotRemoved.map((recipient) => ({
          name: recipient.name,
          phoneNumber: recipient.phoneNumber,
          circleId: recipient.circleId,
          circleName: recipient.circleName
        }))
      );
    }
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

    // Catches any Circle added to the selection after the first Send (e.g. a
    // provisional Circle created mid-session with no further Send
    // afterward) — without this, it would never make it into the period's
    // audienceCircles at all, and Reconnect would never know to ask about
    // it. See syncAudience's own doc comment.
    await syncAudience({
      recipients,
      audienceCircles: buildAudienceCircles(selectedGroups)
    });

    await recordPostSendChoices({
      emailOutOfOfficeEnabled: emailEnabled,
      widerWorldStatusEnabled: widerWorldEnabled
    });

    router.replace("/create/done");
  };

  return (
    <Screen
      contentContainerStyle={styles.content}
      dockedInput={
        personalise.replyTarget ? (
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
        ) : activeField ? (
          <DockedInputBar
            value={activeFieldValue()}
            onChangeText={setActiveFieldValue}
            onDone={() => {
              if (activeField === "new-circle") {
                void submitNewCircleName(newCircleName);
              } else {
                setActiveField(null);
              }
            }}
            onDismiss={() => {
              if (activeField === "new-circle") {
                setNewCircleName("");
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
          />
        ) : null
      }
    >
      <StepHeader title="Who needs to know?" />
      <GroupPicker
        selectedGroupIds={selectedGroups.map((group) => group.id)}
        onToggle={handleToggleGroup}
        sentCircleIds={sentCircleIds}
        isNamingActive={activeField === "new-circle"}
        onActivateNaming={() => setActiveField("new-circle")}
        onCancelNaming={() => {
          setNewCircleName("");
          setActiveField(null);
        }}
      />

      {orderedSelectedGroups.length > 0 ? (
        <>
          {orderedSelectedGroups.map((group) => {
            const circleRecipients = goingQuietRecipients.filter(
              (recipient) => recipient.circleId === group.id
            );

            return (
              <View key={group.id} style={styles.circleSection}>
                <Text style={styles.sectionLabel}>{group.name}</Text>
                <RecipientPersonalisation
                  recipients={circleRecipients}
                  onToggleIncluded={(contactId) => toggleRecipientIncluded(contactId, message)}
                  onSetIndividuallyRemoved={setRecipientIndividuallyRemoved}
                  onSetRouteToPersonalise={setRecipientRouteToPersonalise}
                  isFieldActive={(contactId) => activeField === `recipient:${contactId}`}
                  onActivateField={(contactId) => setActiveField(`recipient:${contactId}`)}
                  bundleSelectedIds={bundleSelectedIds}
                  onToggleBundleSelected={toggleBundleSelected}
                />
              </View>
            );
          })}

          {bundleSelectedIds.size > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void splitIntoNewCircle()}
              style={styles.splitLink}
            >
              <Text style={styles.linkText}>
                + New circle from {bundleSelectedIds.size} selected
              </Text>
            </Pressable>
          ) : null}

          <Text style={styles.groupLabel}>Message to {joinedGroupNames}</Text>

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
              />
              <View style={styles.messageControls}>
                <Pressable accessibilityRole="button" onPress={() => setForceShowChips(true)}>
                  <Text style={styles.linkText}>Change template</Text>
                </Pressable>
                {isSingleCircle ? (
                  isSaved ? (
                    <View style={styles.savedPill} accessibilityRole="text">
                      <Text style={styles.savedPillText}>✓ Saved to Library</Text>
                    </View>
                  ) : (
                    <Pressable accessibilityRole="button" onPress={() => void saveSingleCircleDefault()}>
                      <Text style={styles.linkText}>Save to Library</Text>
                    </Pressable>
                  )
                ) : null}
              </View>

              <SafeguardingBanner visible={safeguardingTriggered} />
            </View>
          )}

          <View style={styles.sendRow}>
            <CompactSendButton
              disabled={!message.trim()}
              accessibilityLabel={`Send to ${joinedGroupNames}`}
              onPress={() => void send()}
            />
          </View>
        </>
      ) : null}

      {hasSentAnything ? (
        <>
          {!personalPromptResolved ? (
            <View style={styles.personalPromptRow}>
              <Text style={styles.personalPromptText}>Want to send personalised messages?</Text>
              <View style={styles.personalPromptActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => choosePersonalPrompt("not-now")}
                  style={styles.smallPill}
                >
                  <Text style={styles.smallPillText}>Not now</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => choosePersonalPrompt("personalise")}
                  style={styles.smallPill}
                >
                  <Text style={styles.smallPillText}>Personalise</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {personalPromptResolved && personalPromptChoice === "personalise" ? (
            <PersonaliseCandidateList
              people={personalise.people}
              expandedId={personalise.expandedId}
              onToggle={personalise.toggle}
              onSent={() => void refreshPeriod()}
              drafts={personalise.drafts}
              onChangeDraft={personalise.onChangeDraft}
              styles={personalise.styles}
              onChangeStyle={personalise.onChangeStyle}
              replyTargetPersonId={personalise.replyTarget?.personId ?? null}
              onActivateReply={personalise.activateReply}
            />
          ) : null}

          {personalPromptResolved ? (
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

              <PrimaryButton label="Done" onPress={() => void finish()} />
            </>
          ) : null}
        </>
      ) : (
        // No per-group Send is required before finishing — someone who
        // decides not to send anything this session still needs a way out
        // of Going Quiet. finish() is already safe to call with nothing
        // sent: emailEnabled/widerWorldEnabled default false, and
        // syncAudience()/recordPostSendChoices() both no-op when no Hold
        // period is open yet. See docs/09-decision-log.md, 2026-08-11.
        <PrimaryButton label="Done" onPress={() => void finish()} />
      )}
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: theme.spacing.lg
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
    splitLink: {
      alignSelf: "flex-start",
      minHeight: 32,
      justifyContent: "center"
    },
    groupLabel: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "600"
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
      justifyContent: "flex-end"
    },
    messageBlock: {
      gap: theme.spacing.xs
    },
    messageControls: {
      flexDirection: "row",
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
    personalPromptRow: {
      gap: theme.spacing.sm
    },
    personalPromptText: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 23
    },
    personalPromptActions: {
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
