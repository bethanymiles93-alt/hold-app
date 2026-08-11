import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
import { useSafeguardingCheck } from "@/hooks/useSafeguardingCheck";
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
import type {
  CircleGroup,
  EmailAccount,
  GoingQuietCircleDraft,
  GoingQuietRecipient,
  HoldIntent,
  HoldPeriod
} from "@/types/hold";

const SUGGESTED_CIRCLES = ["Friends", "Work", "Book Club"];

/** Every distinct docked-bar field on this screen, keyed by a string tag so exactly one DockedInputBar can serve all of them. */
type ActiveField =
  | "new-circle"
  | `circle:${string}`
  | `recipient:${string}`
  | `personal-note:${string}`
  | "ooo-shared"
  | `ooo-account-message:${string}`
  | `ooo-account-label:${string}`
  | "wider-world-status";

const DEFAULT_OOO_MESSAGE =
  "I’m currently away and will respond when I’m back. Thank you for understanding.";
const DEFAULT_STATUS_LINE = "Taking some quiet time. Back soon.";

export default function HoldPeopleScreen() {
  const {
    recipients,
    selectedGroups,
    toggleGroup,
    circleDrafts,
    setCircleDraftIntent,
    setCircleDraftMessage,
    applyGeneratedTemplate,
    saveCircleDraftAsDefault,
    goingQuietRecipients,
    toggleRecipientIncluded,
    setRecipientIndividuallyRemoved,
    setRecipientInstantMessage,
    setRecipientRouteToPersonalise
  } = useHoldFlow();
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showingChipsFor, setShowingChipsFor] = useState<Set<string>>(new Set());

  // Which already-sent Circles are currently reselected (card reopened for a
  // further/different send) — meaningless for a Circle that hasn't been sent
  // yet, since those stay visible unconditionally the same way GroupPicker
  // always showed a selected Circle's card before this session existed.
  const [reselectedCircleIds, setReselectedCircleIds] = useState<Set<string>>(new Set());
  // Which Circles' cards are pinned open via their own arrow, independent of
  // send-selection (see GroupPicker's circle/arrow split, docs/09-decision-log.md,
  // 2026-08-11) — lets a sent Circle's card be viewed/edited without that alone
  // triggering a reselect-to-resend.
  const [expandedCircleIds, setExpandedCircleIds] = useState<Set<string>>(new Set());
  // Durable, on the still-open Hold period (see holdHistoryService.ts). No new
  // field needed: recordSendChannel already keys sendChannels by Circle id on
  // every real group send, so "has this Circle been sent this session" is
  // derived from it — the same derived-not-stored approach Library's Quick
  // message uses, rather than inventing a parallel flag that could drift.
  const [period, setPeriod] = useState<HoldPeriod | null>(null);
  const [personalPromptChoice, setPersonalPromptChoice] = useState<"pending" | "yes" | "not-now">(
    "pending"
  );
  const [personalNoteDrafts, setPersonalNoteDrafts] = useState<Record<string, string>>({});
  const [personalNoteSentAt, setPersonalNoteSentAt] = useState<Record<string, number>>({});
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

  useFocusEffect(
    useCallback(() => {
      void refreshPeriod();
    }, [refreshPeriod])
  );

  // sendChannels also holds individual-recipient phone-number keys (from the
  // instant-message loop in send()) — filtering to circleDrafts' own ids
  // keeps this to genuine whole-Circle group sends only.
  const sentCircleIds = useMemo(() => {
    if (!period?.sendChannels) return [];
    const channelKeys = new Set(Object.keys(period.sendChannels));
    return circleDrafts.filter((draft) => channelKeys.has(draft.circleId)).map((draft) => draft.circleId);
  }, [period, circleDrafts]);

  const hasSentAnything = sentCircleIds.length > 0;

  const toggleReselected = (circleId: string) => {
    setReselectedCircleIds((current) => {
      const next = new Set(current);
      if (next.has(circleId)) {
        next.delete(circleId);
      } else {
        next.add(circleId);
      }
      return next;
    });
  };

  // A never-sent Circle's card stays visible unconditionally (matching the
  // original "every selected Circle has a visible card" default); a sent
  // Circle's card only reappears once explicitly reselected via its chip —
  // OR pinned open via its own separate arrow, which shows the card for
  // viewing/editing without implying a reselect-to-resend. That's why this
  // is two independent conditions, not one: reselecting means the card's
  // own Send button is live again, expanding alone never is.
  const visibleDrafts = circleDrafts.filter(
    (draft) =>
      !sentCircleIds.includes(draft.circleId) ||
      reselectedCircleIds.has(draft.circleId) ||
      expandedCircleIds.has(draft.circleId)
  );

  const excludedNotRemoved = goingQuietRecipients.filter(
    (recipient) =>
      !recipient.included && !recipient.individuallyRemoved && sentCircleIds.includes(recipient.circleId)
  );
  // Strict one-at-a-time reveal: nothing to personalise means stage 2 has
  // nothing to answer, so it's treated as already resolved.
  const personalPromptResolved = excludedNotRemoved.length === 0 || personalPromptChoice !== "pending";

  const activeCircleId = activeField?.startsWith("circle:") ? activeField.slice("circle:".length) : null;
  const activeContactId = activeField?.startsWith("recipient:")
    ? activeField.slice("recipient:".length)
    : null;
  const activeNoteContactId = activeField?.startsWith("personal-note:")
    ? activeField.slice("personal-note:".length)
    : null;
  const activeOooAccountMessageId = activeField?.startsWith("ooo-account-message:")
    ? activeField.slice("ooo-account-message:".length)
    : null;
  const activeOooAccountLabelId = activeField?.startsWith("ooo-account-label:")
    ? activeField.slice("ooo-account-label:".length)
    : null;
  const activeDraft = activeCircleId ? circleDrafts.find((d) => d.circleId === activeCircleId) : undefined;
  const activeRecipient = activeContactId
    ? goingQuietRecipients.find((r) => r.contactId === activeContactId)
    : undefined;
  const activeNoteRecipient = activeNoteContactId
    ? goingQuietRecipients.find((r) => r.contactId === activeNoteContactId)
    : undefined;
  const activeOooAccount = activeOooAccountMessageId
    ? emailAccounts.find((a) => a.id === activeOooAccountMessageId)
    : activeOooAccountLabelId
      ? emailAccounts.find((a) => a.id === activeOooAccountLabelId)
      : undefined;

  const activeFieldValue = (): string => {
    if (activeField === "new-circle") return newCircleName;
    if (activeDraft) return activeDraft.message;
    if (activeRecipient) return activeRecipient.instantMessage;
    if (activeNoteContactId) return personalNoteDrafts[activeNoteContactId] ?? "";
    if (activeField === "ooo-shared") return sharedEmailMessage;
    if (activeOooAccountMessageId) return activeOooAccount?.message ?? "";
    if (activeOooAccountLabelId) return activeOooAccount?.label ?? "";
    if (activeField === "wider-world-status") return widerWorldText;
    return "";
  };

  const setActiveFieldValue = (text: string) => {
    if (activeField === "new-circle") {
      setNewCircleName(text);
    } else if (activeCircleId) {
      setCircleDraftMessage(activeCircleId, text);
    } else if (activeContactId) {
      setRecipientInstantMessage(activeContactId, text);
    } else if (activeNoteContactId) {
      setPersonalNoteDrafts((current) => ({ ...current, [activeNoteContactId]: text }));
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
    if (activeDraft) return `Message for ${activeDraft.circleName}`;
    if (activeRecipient) return `Message for ${activeRecipient.name}`;
    if (activeNoteRecipient) return `Personal note for ${activeNoteRecipient.name}`;
    if (activeField === "ooo-shared") return "Out-of-office message";
    if (activeOooAccountMessageId) return `Message for ${activeOooAccount?.label ?? "account"}`;
    if (activeOooAccountLabelId) return "Account label";
    if (activeField === "wider-world-status") return "Wider-world status line";
    return "Message";
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

    await toggleGroup(pendingCircle);
    setNewCircleName("");
    setActiveField(null);
  };

  const chooseIntent = async (circleId: string, choice: HoldIntent) => {
    setCircleDraftIntent(circleId, choice);
    const recipientNames =
      selectedGroups.find((group) => group.id === circleId)?.contacts.map((contact) => contact.name) ?? [];
    const draftText = await createDraft({ mode: "hold", recipients: recipientNames, intent: choice });
    await applyGeneratedTemplate(circleId, draftText);
    setShowingChipsFor((current) => {
      const next = new Set(current);
      next.delete(circleId);
      return next;
    });
  };

  const changeTemplate = (circleId: string) => {
    setShowingChipsFor((current) => new Set(current).add(circleId));
  };

  const resolvedEmailMessageFor = (account: EmailAccount) =>
    (useSameEmailMessage ? sharedEmailMessage : account.message).trim();

  /**
   * Sends exactly one Circle's message — the only send action on this
   * screen now (2026-08-11: replaces the old page-level "Send" button,
   * which sent every ready visible Circle in one bulk pass, all-or-nothing.
   * That button read as greyed out/non-functional whenever ANY selected
   * Circle didn't have a message yet, even if another Circle right above it
   * was fully ready to go — a real usability bug, not a leftover from a
   * pre-sequential architecture (it was still the only thing actually
   * wired to send anything). This finally makes the per-Circle,
   * independent sending the rest of the screen's design already implies —
   * each Circle's own chip state, its own card, its own reselect — a real
   * button, matching the pattern already used just below for personal
   * notes, and on Reconnect/Taking Time's update/Library's Quick message.
   * See docs/09-decision-log.md, 2026-08-11.
   */
  const sendCircle = async (draft: GoingQuietCircleDraft) => {
    const text = draft.message.trim();
    if (!text) return;

    // The period is created once, on this session's first Send from ANY
    // Circle, and reused for every subsequent Send — never a fresh period
    // per Circle, which would silently orphan the previous one.
    const periodId = period?.id ?? (await startHoldPeriod({
      recipients,
      audienceCircles: buildAudienceCircles(selectedGroups)
    }));

    const circleRecipients = goingQuietRecipients.filter(
      (recipient) => recipient.circleId === draft.circleId
    );
    const groupRecipients = circleRecipients.filter((recipient) => recipient.included);

    if (groupRecipients.length > 0) {
      try {
        const channel = await sendOrShare(groupRecipients.map((recipient) => recipient.phoneNumber), text);
        await recordSendChannel(periodId, draft.circleId, channelKey(channel));
      } catch {
        // Move on even if this compose sheet was dismissed.
      }
    }

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

    await refreshPeriod();
    // A just-sent Circle drops out of "reselected" so its card collapses
    // back to a compact sent chip in GroupPicker's own row — tapping it
    // reselects (per the isSelected/hasSentThisSession pattern), rather
    // than leaving it expanded as if still mid-draft.
    setReselectedCircleIds((current) => {
      const next = new Set(current);
      next.delete(draft.circleId);
      return next;
    });
  };

  const sendPersonalNote = async (recipient: GoingQuietRecipient) => {
    const text = (personalNoteDrafts[recipient.contactId] ?? "").trim();
    if (!text) return;

    try {
      await sendOrShare([recipient.phoneNumber], text);
    } catch {
      // The compose sheet closing is the only signal available either way.
    }
    setPersonalNoteSentAt((current) => ({ ...current, [recipient.contactId]: Date.now() }));
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
        activeField ? (
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
              activeDraft
                ? {
                    surface: "going-quiet",
                    context: { intent: activeDraft.intent ?? undefined, recipientLabel: activeDraft.circleName }
                  }
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
        onToggle={toggleGroup}
        sentCircleIds={sentCircleIds}
        reselectedCircleIds={Array.from(reselectedCircleIds)}
        onToggleReselected={toggleReselected}
        expandedCircleIds={Array.from(expandedCircleIds)}
        onToggleExpanded={(circleId) =>
          setExpandedCircleIds((current) => {
            const next = new Set(current);
            if (next.has(circleId)) {
              next.delete(circleId);
            } else {
              next.add(circleId);
            }
            return next;
          })
        }
        isNamingActive={activeField === "new-circle"}
        onActivateNaming={() => setActiveField("new-circle")}
        onCancelNaming={() => {
          setNewCircleName("");
          setActiveField(null);
        }}
      />

      {visibleDrafts.map((draft) => {
        const showChips =
          showingChipsFor.has(draft.circleId) || (draft.savedMessage === null && !draft.message.trim());
        const isSaved = draft.savedMessage !== null && draft.message === draft.savedMessage;
        const circleRecipients = goingQuietRecipients.filter(
          (recipient) => recipient.circleId === draft.circleId
        );

        return (
          <View key={draft.circleId} style={styles.circleSection}>
            <Text style={styles.sectionLabel}>{draft.circleName}</Text>

            <RecipientPersonalisation
              recipients={circleRecipients}
              onToggleIncluded={toggleRecipientIncluded}
              onSetIndividuallyRemoved={setRecipientIndividuallyRemoved}
              onSetRouteToPersonalise={setRecipientRouteToPersonalise}
              isFieldActive={(contactId) => activeField === `recipient:${contactId}`}
              onActivateField={(contactId) => setActiveField(`recipient:${contactId}`)}
            />

            {showChips ? (
              <View accessibilityRole="radiogroup" style={styles.choices}>
                {HOLD_INTENTS.map((choice) => (
                  <ChoiceCard
                    key={choice.id}
                    title={choice.title}
                    description={choice.description}
                    selected={draft.intent === choice.id}
                    onPress={() => void chooseIntent(draft.circleId, choice.id)}
                  />
                ))}
              </View>
            ) : (
              <>
                <GoingQuietMessageBox
                  styles={styles}
                  draft={draft}
                  isSaved={isSaved}
                  isActive={activeField === `circle:${draft.circleId}`}
                  onActivate={() => setActiveField(`circle:${draft.circleId}`)}
                  onChangeTemplate={() => changeTemplate(draft.circleId)}
                  onSaveDefault={() => void saveCircleDraftAsDefault(draft.circleId)}
                />
                <View style={styles.sendRow}>
                  <CompactSendButton
                    disabled={!draft.message.trim()}
                    accessibilityLabel={`Send message to ${draft.circleName}`}
                    onPress={() => void sendCircle(draft)}
                  />
                </View>
              </>
            )}
          </View>
        );
      })}

      {hasSentAnything ? (
        <>
          {!personalPromptResolved ? (
            <View style={styles.personalPromptRow}>
              <Text style={styles.personalPromptText}>
                Want to send anyone something more personal?
              </Text>
              <View style={styles.personalPromptActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPersonalPromptChoice("not-now")}
                  style={styles.smallPill}
                >
                  <Text style={styles.smallPillText}>Not now</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPersonalPromptChoice("yes")}
                  style={styles.smallPill}
                >
                  <Text style={styles.smallPillText}>Yes</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {personalPromptResolved && personalPromptChoice === "yes" ? (
            <View style={styles.personalNoteList}>
              {excludedNotRemoved.map((recipient) => {
                const noteSentAt = personalNoteSentAt[recipient.contactId];
                return (
                  <View key={recipient.contactId} style={styles.personalNoteBlock}>
                    <Text style={styles.name}>{recipient.name}</Text>
                    {noteSentAt ? (
                      <View style={styles.sentPill}>
                        <Text style={styles.sentPillText}>✓ Sent</Text>
                      </View>
                    ) : (
                      <>
                        <DockedFieldPreview
                          value={personalNoteDrafts[recipient.contactId] ?? ""}
                          placeholder={`Personal note for ${recipient.name}`}
                          isActive={activeField === `personal-note:${recipient.contactId}`}
                          onPress={() => setActiveField(`personal-note:${recipient.contactId}`)}
                          accessibilityLabel={`Personal note for ${recipient.name}`}
                        />
                        <View style={styles.sendRow}>
                          <CompactSendButton
                            disabled={!(personalNoteDrafts[recipient.contactId] ?? "").trim()}
                            accessibilityLabel={`Send personal note to ${recipient.name}`}
                            onPress={() => void sendPersonalNote(recipient)}
                          />
                        </View>
                      </>
                    )}
                  </View>
                );
              })}
            </View>
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
        // No per-Circle send is required before finishing — someone who
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

interface GoingQuietMessageBoxProps {
  styles: ReturnType<typeof createStyles>;
  draft: GoingQuietCircleDraft;
  isSaved: boolean;
  isActive: boolean;
  onActivate: () => void;
  onChangeTemplate: () => void;
  onSaveDefault: () => void;
}

/**
 * Extracted so useSafeguardingCheck (a hook) can run once per Circle draft
 * with a stable identity — circleDrafts.map(...) can't call hooks directly,
 * since the array's length changes as Circles are toggled on/off. The
 * actual typing now happens in the screen's shared DockedInputBar (AI-amend
 * included) — this just displays the current text and activates it.
 */
function GoingQuietMessageBox({
  styles,
  draft,
  isSaved,
  isActive,
  onActivate,
  onChangeTemplate,
  onSaveDefault
}: GoingQuietMessageBoxProps) {
  const safeguardingTriggered = useSafeguardingCheck(draft.message);

  return (
    <View style={styles.messageBlock}>
      <DockedFieldPreview
        value={draft.message}
        placeholder={`Message for ${draft.circleName}`}
        isActive={isActive}
        onPress={onActivate}
        accessibilityLabel={`Message for ${draft.circleName}`}
      />
      <View style={styles.messageControls}>
        <Pressable accessibilityRole="button" onPress={onChangeTemplate}>
          <Text style={styles.linkText}>Change template</Text>
        </Pressable>
        {isSaved ? (
          <View style={styles.savedPill} accessibilityRole="text">
            <Text style={styles.savedPillText}>✓ Saved to Library</Text>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={onSaveDefault}>
            <Text style={styles.linkText}>Save to Library</Text>
          </Pressable>
        )}
      </View>

      <SafeguardingBanner visible={safeguardingTriggered} />
    </View>
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
    choices: {
      gap: theme.spacing.sm
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
    sentPill: {
      alignSelf: "flex-start",
      minHeight: 32,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong
    },
    sentPillText: {
      color: colors.textMuted,
      fontSize: 14,
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
    },
    personalNoteList: {
      gap: theme.spacing.md
    },
    personalNoteBlock: {
      gap: theme.spacing.xs
    },
    name: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600"
    }
  });
}
