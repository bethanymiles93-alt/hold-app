import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { CompactSendButton } from "@/components/CompactSendButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { DockedInputBar } from "@/components/DockedInputBar";
import { DockedFieldPreview } from "@/components/DockedFieldPreview";
import { MemoryNoteSuggestion } from "@/components/MemoryNoteSuggestion";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { PersonaliseCandidateList } from "@/components/PersonaliseCandidateList";
import { PENDING_CIRCLE_ID_PREFIX } from "@/components/GroupPicker";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { usePersonaliseCompletion } from "@/hooks/usePersonaliseCompletion";
import { QUICK_RECONNECT_MESSAGES } from "@/constants/copy";
import { useHoldFlow } from "@/context/HoldFlowContext";
import {
  beginReconnecting,
  getHoldPeriodById,
  getReconnectCoverage,
  getReconnectingPeriod,
  markPendingCircleResolved,
  markReconnectContacted,
  recordSendChannel
} from "@/services/holdHistoryService";
import {
  getAll as getAllConversationPeople,
  markContacted,
  seedFromAudience
} from "@/services/conversationService";
import { addContactToGroup, createGroup } from "@/services/circleService";
import { deactivateOutOfOffice } from "@/services/emailAccountService";
import { channelKey, sendOrShare, sendToCircles } from "@/services/smsService";
import { clearDraft, getDraft, saveDraft } from "@/services/messageDraftService";
import type { AudienceCircle, HoldPeriod } from "@/types/hold";

const RECONNECT_DRAFT_KEY = "reconnect";

export default function ReconnectScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { reconnectPeriodId } = useHoldFlow();

  const [period, setPeriod] = useState<HoldPeriod | null>(null);
  const [message, setMessage] = useState(QUICK_RECONNECT_MESSAGES[0]?.text ?? "");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
  // Frozen the moment the docked bar opens for the message — reorder and
  // grey-out both key off this snapshot, not the live selection, so they
  // only ever happen at that one moment, not on every tap (2026-08-11 —
  // matches Going Quiet's own GroupPicker fix). See docs/09-decision-log.md.
  const [composingActiveIds, setComposingActiveIds] = useState<string[] | null>(null);

  const refresh = useCallback(async () => {
    // Prefer the durable marker (force-quit-resume, or any visit after the first
    // genuine send). Before that marker exists — the very first visit this
    // session, or a resumed visit after backing out earlier without sending —
    // fall back to reading the period directly by the id context carried here
    // from Home, so the picker still has data with nothing durable written yet.
    const durable = await getReconnectingPeriod();
    const current = durable ?? (reconnectPeriodId ? await getHoldPeriodById(reconnectPeriodId) : null);
    setPeriod(current);

    if (current) {
      const coverage = getReconnectCoverage(current);
      setSelectedIds(new Set(coverage.totalIds.filter((id) => !coverage.contactedIds.includes(id))));
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
  const allSelected = Boolean(
    coverage && coverage.totalIds.length > 0 && selectedIds.size === coverage.totalIds.length
  );

  const toggleAll = () => {
    if (!coverage) return;
    setSelectedIds(allSelected ? new Set() : new Set(coverage.totalIds));
  };

  if (messageFieldActive && composingActiveIds === null) {
    setComposingActiveIds(Array.from(selectedIds));
  } else if (!messageFieldActive && composingActiveIds !== null) {
    setComposingActiveIds(null);
  }

  const toggleId = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  /**
   * Delivery is individual/BCC-style by default per Circle, or one shared
   * group thread for a Circle with `sendAsGroup` turned on — mixed
   * combinations follow each Circle's own setting independently within
   * this one Send (2026-08-11, corrects the earlier one-shared-message
   * behaviour, matching Going Quiet's own fix). Ungrouped contacts were
   * never part of a Circle in the first place, so they're always sent
   * individually. See docs/09-decision-log.md.
   */
  const send = async () => {
    if (!period) return;

    const circles = (period.audienceCircles ?? []).filter((circle) => selectedIds.has(circle.circleId));
    const ungrouped = (period.audienceUngrouped ?? []).filter((contact) =>
      selectedIds.has(contact.phoneNumber)
    );
    const text = message.trim();
    const hasAnyRecipient = circles.some((circle) => circle.contacts.length > 0) || ungrouped.length > 0;
    if (!hasAnyRecipient || !text) return;

    const deliveryTargets = circles
      .map((circle) => ({
        circleId: circle.circleId,
        sendAsGroup: circle.sendAsGroup ?? false,
        numbers: circle.contacts.map((contact) => contact.phoneNumber)
      }))
      .filter((target) => target.numbers.length > 0);

    const channelByCircle = await sendToCircles(deliveryTargets, text);
    for (const [id, channel] of channelByCircle) {
      await recordSendChannel(period.id, id, channelKey(channel));
    }

    for (const contact of ungrouped) {
      try {
        const channel = await sendOrShare([contact.phoneNumber], text);
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

    for (const id of selectedIds) {
      await markReconnectContacted(period.id, id);
    }

    // Keep Library/Conversations' own per-person sentAt truthfully in sync,
    // so PersonaliseAccordion can honestly show already-contacted vs not.
    const conversationPeople = await getAllConversationPeople();
    const sentNumbers = new Set([
      ...circles.flatMap((circle) => circle.contacts.map((contact) => contact.phoneNumber)),
      ...ungrouped.map((contact) => contact.phoneNumber)
    ]);
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
   * Ends Reconnect's own completion step, reachable via "Done" — always
   * available once at least one message has gone out, same as Going
   * Quiet's own Done. Used to be triggered by "Not now" instead, but that
   * button no longer finishes anything: since the post-coverage state was
   * folded into this same screen instead of a separate page (2026-08-12),
   * "Not now" just declines/collapses the inline Personalise choice, and
   * leaving is its own separate, always-available action. See
   * docs/09-decision-log.md, 2026-08-12.
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

  const confirmPendingCircle = async (circle: AudienceCircle) => {
    if (!period) return;
    const contact = circle.contacts[0];
    if (!contact) return;

    // Real Circle creation and the contact add happen together, only now —
    // nothing exists in storage before this point.
    const group = await createGroup(circle.circleName);
    await addContactToGroup(group.id, contact);
    await markPendingCircleResolved(period.id, circle.circleId);
    await refresh();
  };

  const discardPendingCircle = async (circle: AudienceCircle) => {
    if (!period) return;
    await markPendingCircleResolved(period.id, circle.circleId);
    await refresh();
  };

  if (!period || !coverage) {
    return <Screen contentContainerStyle={styles.content} />;
  }

  // Reorder + grey-out only while composing (composingActiveIds), same
  // trigger as Going Quiet's own GroupPicker — never on a bare selection
  // tap. Once coverage.complete, messageFieldActive can never become true
  // again (the message docked bar stops rendering below), so this always
  // resolves to identity/no grey-out on its own. See
  // docs/09-decision-log.md, 2026-08-11.
  const composingIds = composingActiveIds ? new Set(composingActiveIds) : null;
  const orderPills = <T,>(items: T[], idOf: (item: T) => string): T[] => {
    if (!composingIds) return items;
    const active = items.filter((item) => composingIds.has(idOf(item)));
    const rest = items.filter((item) => !composingIds.has(idOf(item)));
    return [...active, ...rest];
  };

  const circlePills = orderPills(period.audienceCircles ?? [], (circle) => circle.circleId);
  const ungroupedPills = orderPills(period.audienceUngrouped ?? [], (contact) => contact.phoneNumber);

  const showOoo = period.emailOutOfOfficeEnabled || period.widerWorldStatusEnabled;
  const resolvedPendingCircleIds = period.resolvedPendingCircleIds ?? [];
  const pendingCircles = (period.audienceCircles ?? []).filter(
    (circle) =>
      circle.circleId.startsWith(PENDING_CIRCLE_ID_PREFIX) &&
      !resolvedPendingCircleIds.includes(circle.circleId)
  );

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
        !coverage.complete && messageFieldActive ? (
          <DockedInputBar
            value={message}
            onChangeText={changeMessage}
            onDone={() => {
              // Sends immediately — no intermediate "return to preview"
              // step, matching Going Quiet's own fix. See
              // docs/09-decision-log.md, 2026-08-11.
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
      <View style={styles.top}>
        <StepHeader
          body={coverage.complete ? "Everyone's been reached." : "Reach everyone at your own pace, a few at a time."}
        />

        {coverage.complete
          ? pendingCircles.map((circle) => {
              const contact = circle.contacts[0];
              if (!contact) return null;

              return (
                <View key={circle.circleId} style={styles.pendingPromptRow}>
                  <Text style={styles.pendingPromptText}>
                    Add {contact.name} to {circle.circleName} permanently?
                  </Text>
                  <View style={styles.pendingPromptActions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void discardPendingCircle(circle)}
                      style={styles.smallPill}
                    >
                      <Text style={styles.smallPillText}>Not now</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void confirmPendingCircle(circle)}
                      style={styles.smallPill}
                    >
                      <Text style={styles.smallPillText}>Yes</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          : null}

        {!coverage.complete ? (
          <MemoryNoteSuggestion
            onUseIt={(prompt) => {
              setSuggestedPrompt(prompt);
              setMessageFieldActive(true);
            }}
          />
        ) : null}

        {/* Stays visible once fully sent, not just while composing — the
            person should still see who they messaged. See
            docs/09-decision-log.md, 2026-08-12. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <AdaptiveCircleChip
            label="All"
            isSelected={allSelected}
            onPress={coverage.complete ? () => {} : toggleAll}
            accessibilityRole="button"
          />

          {circlePills.map((circle) => {
            const isSelected = selectedIds.has(circle.circleId);
            const hasSentThisSession = coverage.contactedIds.includes(circle.circleId);
            const sentLook = hasSentThisSession && !isSelected;
            const isGreyedOut = composingIds !== null && !composingIds.has(circle.circleId);

            return (
              <View key={circle.circleId} style={isGreyedOut && styles.chipGreyed}>
                <AdaptiveCircleChip
                  label={circle.circleName}
                  isSelected={isSelected}
                  hasSentThisSession={hasSentThisSession}
                  onPress={coverage.complete ? () => {} : () => toggleId(circle.circleId)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    sentLook
                      ? `${circle.circleName}, already reached. Tap to send another message.`
                      : circle.circleName
                  }
                />
              </View>
            );
          })}

          {ungroupedPills.map((contact) => {
            const isSelected = selectedIds.has(contact.phoneNumber);
            const hasSentThisSession = coverage.contactedIds.includes(contact.phoneNumber);
            const sentLook = hasSentThisSession && !isSelected;
            const isGreyedOut = composingIds !== null && !composingIds.has(contact.phoneNumber);

            return (
              <View key={contact.phoneNumber} style={isGreyedOut && styles.chipGreyed}>
                <AdaptiveCircleChip
                  label={contact.name}
                  isSelected={isSelected}
                  hasSentThisSession={hasSentThisSession}
                  onPress={coverage.complete ? () => {} : () => toggleId(contact.phoneNumber)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    sentLook ? `${contact.name}, already reached. Tap to send another message.` : contact.name
                  }
                />
              </View>
            );
          })}
        </ScrollView>

        {!coverage.complete ? (
          <DockedFieldPreview
            value={message}
            placeholder="Message to send"
            isActive={messageFieldActive}
            onPress={() => setMessageFieldActive(true)}
            accessibilityLabel="Message to send"
          />
        ) : (
          // Inline, in the space the text box vacated — nothing left to
          // compose once everyone's been reached. "Not now" collapses this
          // rather than dismissing it, so it can be reopened and
          // reconsidered later, same reveal-on-demand pattern as OOO/status
          // below. See docs/09-decision-log.md, 2026-08-12.
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
        )}

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
        {/* Always available once at least one message has gone out — the
            manual early-exit action pre-completion, and the only way to
            actually finish/leave once complete, now that "Not now" no
            longer does that. See docs/09-decision-log.md, 2026-08-12. */}
        {coverage.contactedIds.length > 0 ? (
          <SecondaryButton label="Done" onPress={finishReconnecting} />
        ) : null}
        {!coverage.complete ? (
          <CompactSendButton
            disabled={selectedIds.size === 0 || !message.trim()}
            onPress={() => void send()}
          />
        ) : null}
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      justifyContent: "space-between",
      gap: theme.spacing.xl
    },
    top: {
      gap: theme.spacing.lg
    },
    chipRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
    },
    chipGreyed: {
      opacity: 0.4
    },
    sendRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: theme.spacing.sm
    },
    gatePrompt: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22
    },
    pendingPromptRow: {
      gap: theme.spacing.sm
    },
    pendingPromptText: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 23
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
    linkText: {
      color: colors.link,
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
