import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { AmendWithAI } from "@/components/AmendWithAI";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  DRAFT_REPLY_RETENTION_HOURS,
  FRIEND_MESSAGE_RETENTION_HOURS,
  QUICK_RECONNECT_MESSAGES,
  REPLY_STYLES
} from "@/constants/copy";
import { HAS_SEEN_RETENTION_NOTE_KEY } from "@/constants/storageKeys";
import { useHoldFlow } from "@/context/HoldFlowContext";
import {
  addCircleMembers,
  addPerson,
  getAll as getAllConversationPeople,
  markQuickSent,
  moveToPersonalise,
  toggleComplete,
  type ConversationPerson
} from "@/services/conversationService";
import { addContactToGroup, createGroup, getGroup, getGroups } from "@/services/circleService";
import { pickContact } from "@/services/contactPickerService";
import { sendOrShare } from "@/services/smsService";
import { createReplyDraft } from "@/services/draftService";
import { getReply, saveReply } from "@/services/replyStorageService";
import { formatSentLabel } from "@/services/holdHistoryFormat";
import { getAllTemplates, saveCircleTemplate } from "@/services/templateService";
import type { ReturnStyle, StoredReply } from "@/types/hold";

interface TemplateRow {
  circleId: string;
  circleName: string;
  text: string;
}

const DEFAULT_QUICK_MESSAGE = QUICK_RECONNECT_MESSAGES[0]?.text ?? "";

interface CircleSection {
  circleId: string;
  circleName: string;
  people: ConversationPerson[];
  sentAt: number | null;
}

function groupByCircle(people: ConversationPerson[]): CircleSection[] {
  const sections: Array<Omit<CircleSection, "sentAt">> = [];
  const indexByKey = new Map<string, number>();

  for (const person of people) {
    const key = person.circleId ?? "other";
    let index = indexByKey.get(key);

    if (index === undefined) {
      index = sections.length;
      indexByKey.set(key, index);
      sections.push({ circleId: key, circleName: person.circleName ?? "Other", people: [] });
    }

    sections[index]?.people.push(person);
  }

  // A send is one bulk action per Circle, so a section is atomically all-sent or not.
  return sections.map((section) => ({
    ...section,
    sentAt: section.people.every((person) => person.sentAt) ? (section.people[0]?.sentAt ?? null) : null
  }));
}

interface PersonaliseAccordionProps {
  person: ConversationPerson;
  isOpen: boolean;
  onToggle: () => void;
}

function PersonaliseAccordion({ person, isOpen, onToggle }: PersonaliseAccordionProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loaded, setLoaded] = useState(false);
  const [friendMessage, setFriendMessage] = useState("");
  // Settles into a muted, read-only-looking card once populated — pinned above
  // the reply box throughout drafting, never collapses. "Edit" is the only way
  // back to an editable field, no implicit/hidden gesture.
  const [friendMessageEditing, setFriendMessageEditing] = useState(true);
  const [style, setStyle] = useState<ReturnStyle | null>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"none" | "draft" | "sent">("none");
  const [sentAt, setSentAt] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || loaded) return;

    void (async () => {
      const existing = await getReply(person.id);
      if (existing) {
        setFriendMessage(existing.friendMessage);
        setFriendMessageEditing(!existing.friendMessage.trim());
        setDraft(existing.draftReply);
        setStatus(existing.sentAt ? "sent" : "draft");
        setSentAt(existing.sentAt ?? null);
      }
      setLoaded(true);
    })();
  }, [isOpen, loaded, person.id]);

  const chooseStyle = (choice: ReturnStyle) => {
    setStyle(choice);
    void createReplyDraft(choice).then(changeDraft);
  };

  const persist = async (
    sentAtValue: number | null,
    overrides?: { friendMessage?: string; draftReply?: string }
  ): Promise<StoredReply> => {
    const now = Date.now();
    const record: StoredReply = {
      id: person.id,
      recipientName: person.name,
      friendMessage: overrides?.friendMessage ?? friendMessage,
      friendMessageExpiresAt: now + FRIEND_MESSAGE_RETENTION_HOURS * 60 * 60 * 1000,
      draftReply: overrides?.draftReply ?? draft,
      draftReplyExpiresAt: now + DRAFT_REPLY_RETENTION_HOURS * 60 * 60 * 1000,
      createdAt: now,
      sentAt: sentAtValue
    };
    await saveReply(record);
    return record;
  };

  // Autosaves on every keystroke so an interruption before Save/Send never loses this content.
  const changeFriendMessage = (text: string) => {
    setFriendMessage(text);
    void persist(sentAt, { friendMessage: text });
  };

  const settleFriendMessage = () => {
    if (friendMessage.trim()) setFriendMessageEditing(false);
  };

  const changeDraft = (text: string) => {
    setDraft(text);
    void persist(sentAt, { draftReply: text });
  };

  const showRetentionNoteOnce = () => {
    void (async () => {
      const hasSeen = await AsyncStorage.getItem(HAS_SEEN_RETENTION_NOTE_KEY);
      if (hasSeen) return;

      await AsyncStorage.setItem(HAS_SEEN_RETENTION_NOTE_KEY, "true");
      Alert.alert(
        "Saved",
        "Your reply stays on your device for a couple of days in case you need to step away. Their message clears sooner."
      );
    })();
  };

  const saveForLater = () => {
    void (async () => {
      await persist(null);
      setStatus("draft");
      onToggle();
      showRetentionNoteOnce();
    })();
  };

  const sendNow = () => {
    void (async () => {
      const now = Date.now();
      const record = await persist(now);
      try {
        await sendOrShare([person.phoneNumber], record.draftReply.trim());
      } catch {
        // The compose sheet closing is the only signal available either way.
      }
      setStatus("sent");
      setSentAt(now);
      onToggle();
    })();
  };

  const statusLabel =
    status === "sent" && sentAt !== null
      ? formatSentLabel(sentAt, "Sent. They'll hear from you properly.")
      : status === "draft"
        ? "Continue draft"
        : "Personalise";

  return (
    <View style={styles.personaliseBlock}>
      <Pressable accessibilityRole="button" onPress={onToggle}>
        <Text style={styles.linkText}>{isOpen ? "Close" : statusLabel}</Text>
      </Pressable>

      {isOpen ? (
        <View style={styles.accordionPanel}>
          <Text style={styles.contactedStatus}>
            {person.sentAt !== null
              ? "Already sent them a message."
              : "This will be your first message to them."}
          </Text>

          <Text style={styles.fieldLabel}>What they sent</Text>
          {friendMessageEditing ? (
            <TextInput
              accessibilityLabel="Message they sent"
              multiline
              onBlur={settleFriendMessage}
              onChangeText={changeFriendMessage}
              style={styles.input}
              textAlignVertical="top"
              value={friendMessage}
            />
          ) : (
            <View style={styles.friendMessageSettled}>
              <Text style={styles.friendMessageSettledText}>{friendMessage}</Text>
              <Pressable accessibilityRole="button" onPress={() => setFriendMessageEditing(true)}>
                <Text style={styles.linkText}>Edit</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.fieldLabel}>Starting point</Text>
          <View style={styles.styleChipRow}>
            {REPLY_STYLES.map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                onPress={() => chooseStyle(option.id)}
                style={[styles.styleChip, style === option.id && styles.styleChipSelected]}
              >
                <Text
                  style={[styles.styleChipText, style === option.id && styles.styleChipTextSelected]}
                >
                  {option.title}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Your reply</Text>
          <TextInput
            accessibilityLabel="Your reply"
            multiline
            onChangeText={changeDraft}
            style={styles.input}
            textAlignVertical="top"
            value={draft}
          />

          <AmendWithAI
            surface="conversations-reply"
            currentMessage={draft}
            onApply={changeDraft}
            context={{ returnStyle: style ?? undefined, friendMessage }}
          />

          <View style={styles.accordionActions}>
            <PrimaryButton disabled={!draft.trim()} label="Send now" onPress={sendNow} />
            <SecondaryButton label="Save for later" onPress={saveForLater} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function LibraryScreen() {
  const { mode } = useHoldFlow();
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [people, setPeople] = useState<ConversationPerson[]>([]);
  const [allSelected, setAllSelected] = useState(true);
  const [sharedMessage, setSharedMessage] = useState(DEFAULT_QUICK_MESSAGE);
  const [perCircleMessages, setPerCircleMessages] = useState<Record<string, string>>({});
  const [expandedCircleId, setExpandedCircleId] = useState<string | null>(null);
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templateDrafts, setTemplateDrafts] = useState<Record<string, string>>({});
  const [reopenedCircleIds, setReopenedCircleIds] = useState<Set<string>>(new Set());
  const [allReopened, setAllReopened] = useState(false);
  const [selectedOtherIds, setSelectedOtherIds] = useState<Set<string>>(new Set());
  const [circlePromptStage, setCirclePromptStage] = useState<"none" | "confirm" | "naming">("none");
  const [newOtherCircleName, setNewOtherCircleName] = useState("");

  const refresh = useCallback(async () => {
    const all = await getAllConversationPeople();
    setPeople(all);

    // Only a real Reconnect journey earns the "You're reconnected" screen — Library is also
    // reachable standalone, where reaching zero-incomplete has no such journey to close out.
    if (all.length > 0 && all.every((person) => person.completed) && mode === "return") {
      router.replace("/return/done");
    }

    const [savedTemplates, groups] = await Promise.all([getAllTemplates(), getGroups()]);
    const nameById = new Map(groups.map((group) => [group.id, group.name]));
    const rows = savedTemplates
      .map((template) => {
        const circleName = nameById.get(template.circleId);
        return circleName ? { circleId: template.circleId, circleName, text: template.text } : null;
      })
      .filter((row): row is TemplateRow => row !== null);

    setTemplates(rows);
    setTemplateDrafts((current) => {
      const next = { ...current };
      for (const row of rows) {
        if (!(row.circleId in next)) next[row.circleId] = row.text;
      }
      return next;
    });
  }, [mode]);

  const changeTemplateDraft = (circleId: string, text: string) => {
    setTemplateDrafts((current) => ({ ...current, [circleId]: text }));
  };

  const saveTemplate = (circleId: string) => {
    const text = (templateDrafts[circleId] ?? "").trim();
    if (!text) return;
    void saveCircleTemplate(circleId, text).then(refresh);
  };

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const quickPeopleAll = people.filter((person) => person.bucket === "quick");
  const quickPeoplePending = quickPeopleAll.filter((person) => !person.sentAt);
  const personalisePeople = people.filter((person) => person.bucket === "personalise");
  const quickSections = groupByCircle(quickPeopleAll);

  const allQuickFullySent = quickPeopleAll.length > 0 && quickPeopleAll.every((person) => person.sentAt);
  const allQuickTargets = allQuickFullySent ? quickPeopleAll : quickPeoplePending;
  const mostRecentQuickSentAt = quickPeopleAll.reduce<number | null>(
    (latest, person) => (person.sentAt && (!latest || person.sentAt > latest) ? person.sentAt : latest),
    null
  );

  const confirmAndSend = (message: string, targets: ConversationPerson[], onDone: () => void) => {
    const text = message.trim();
    if (targets.length === 0 || !text) return;

    Alert.alert(`Send "${text}" to ${targets.length} people?`, undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send",
        onPress: () =>
          void (async () => {
            await sendOrShare(targets.map((person) => person.phoneNumber), text);
            await markQuickSent(targets.map((person) => person.id));
            onDone();
            await refresh();
          })()
      }
    ]);
  };

  const sendToEveryone = () =>
    confirmAndSend(sharedMessage, allQuickTargets, () => setAllReopened(false));

  const sendToCircle = (section: CircleSection) => {
    const message = perCircleMessages[section.circleId] ?? sharedMessage;
    const targets = section.sentAt !== null ? section.people : section.people.filter((person) => !person.sentAt);
    confirmAndSend(message, targets, () => {
      if (expandedCircleId === section.circleId) setExpandedCircleId(null);
      setReopenedCircleIds((current) => {
        const next = new Set(current);
        next.delete(section.circleId);
        return next;
      });
    });
  };

  const reopenCircle = (circleId: string) => {
    setReopenedCircleIds((current) => new Set(current).add(circleId));
    selectCircle(circleId);
  };

  const selectAll = () => {
    setAllSelected(true);
    setExpandedCircleId(null);
  };

  const selectCircle = (circleId: string) => {
    setAllSelected(false);
    setPerCircleMessages((current) =>
      current[circleId] !== undefined ? current : { ...current, [circleId]: sharedMessage }
    );
  };

  const untickFromQuick = (person: ConversationPerson) => {
    void (async () => {
      await moveToPersonalise(person.id);
      await refresh();
    })();
  };

  const expandToFullCircle = (section: CircleSection) => {
    void (async () => {
      const group = await getGroup(section.circleId);
      if (!group) return;

      await addCircleMembers(
        group.id,
        group.name,
        group.contacts.map((contact) => ({ name: contact.name, phoneNumber: contact.phoneNumber }))
      );
      await refresh();
    })();
  };

  const toggle = (person: ConversationPerson) => {
    void (async () => {
      await toggleComplete(person.id, !person.completed);
      await refresh();
    })();
  };

  const togglePersonalise = (personId: string) => {
    setExpandedPersonId((current) => (current === personId ? null : personId));
  };

  const addNewPerson = () => {
    void (async () => {
      const picked = await pickContact();
      if (!picked) return;

      await addPerson(picked);
      await refresh();
    })();
  };

  const toggleOtherSelection = (person: ConversationPerson) => {
    setSelectedOtherIds((current) => {
      const next = new Set(current);
      if (next.has(person.id)) {
        next.delete(person.id);
        if (next.size < 2) setCirclePromptStage("none");
        return next;
      }

      next.add(person.id);
      if (next.size === 2) setCirclePromptStage("confirm");
      return next;
    });
  };

  const declineCreateCircle = () => {
    setCirclePromptStage("none");
    setSelectedOtherIds(new Set());
  };

  const submitCreateCircle = async () => {
    const name = newOtherCircleName.trim();
    if (!name) return;

    const selectedPeople = personalisePeople.filter((person) => selectedOtherIds.has(person.id));
    const group = await createGroup(name);
    for (const person of selectedPeople) {
      await addContactToGroup(group.id, { name: person.name, phoneNumber: person.phoneNumber });
    }

    setNewOtherCircleName("");
    setCirclePromptStage("none");
    setSelectedOtherIds(new Set());
  };

  if (people.length === 0) {
    return (
      <Screen contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Conversations</Text>
        <Text style={styles.empty}>
          Nothing here yet. When you need help replying to someone, this is where you’ll find it.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Conversations</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick message</Text>

        <View style={styles.chipRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: allSelected }}
            onPress={selectAll}
            style={[styles.chip, allSelected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, allSelected && styles.chipTextSelected]}>All</Text>
          </Pressable>
          {quickSections.map((section) =>
            section.sentAt !== null ? (
              <Pressable
                key={section.circleId}
                accessibilityRole="button"
                accessibilityLabel={`${section.circleName}, sent. Tap to send another message.`}
                onPress={() => reopenCircle(section.circleId)}
                style={styles.chipSent}
              >
                <Text style={styles.chipSentText}>✓ {section.circleName}</Text>
              </Pressable>
            ) : (
              <Pressable
                key={section.circleId}
                accessibilityRole="button"
                accessibilityState={{ selected: !allSelected }}
                onPress={() => selectCircle(section.circleId)}
                style={[styles.chip, !allSelected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, !allSelected && styles.chipTextSelected]}>
                  {section.circleName}
                </Text>
              </Pressable>
            )
          )}
        </View>

        {allSelected ? (
          allQuickFullySent && !allReopened ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sent to everyone. Tap to send another message."
              onPress={() => setAllReopened(true)}
              style={styles.circleRowSent}
            >
              <Text style={styles.circleRowSentText}>✓ Sent to everyone</Text>
              <Text style={styles.circleRowSentLabel}>
                {mostRecentQuickSentAt !== null
                  ? formatSentLabel(mostRecentQuickSentAt, "Instant message sent.")
                  : null}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.quickBody}>
              <TextInput
                accessibilityLabel="Message to everyone"
                multiline
                onChangeText={setSharedMessage}
                style={styles.input}
                value={sharedMessage}
              />
              <PrimaryButton
                disabled={allQuickTargets.length === 0}
                label={`Send to everyone (${allQuickTargets.length})`}
                onPress={sendToEveryone}
              />
            </View>
          )
        ) : (
          <View style={styles.circleRows}>
            {quickSections.map((section) => {
              if (section.sentAt !== null && !reopenedCircleIds.has(section.circleId)) {
                return (
                  <Pressable
                    key={section.circleId}
                    accessibilityRole="button"
                    accessibilityLabel={`${section.circleName}, sent. Tap to send another message.`}
                    onPress={() => reopenCircle(section.circleId)}
                    style={styles.circleRowSent}
                  >
                    <Text style={styles.circleRowSentText}>✓ {section.circleName}</Text>
                    <Text style={styles.circleRowSentLabel}>
                      {formatSentLabel(section.sentAt, "Instant message sent.")}
                    </Text>
                  </Pressable>
                );
              }

              const pendingPeople =
                section.sentAt !== null ? section.people : section.people.filter((person) => !person.sentAt);

              return (
                <View key={section.circleId} style={styles.circleRow}>
                  <View style={styles.circleRowHeader}>
                    <Text style={styles.circleRowTitle}>{section.circleName}</Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        setExpandedCircleId((current) =>
                          current === section.circleId ? null : section.circleId
                        )
                      }
                    >
                      <Text style={styles.linkText}>
                        {expandedCircleId === section.circleId ? "Hide people" : "Show people"}
                      </Text>
                    </Pressable>
                  </View>

                  <TextInput
                    accessibilityLabel={`Message to ${section.circleName}`}
                    multiline
                    onChangeText={(text) =>
                      setPerCircleMessages((current) => ({ ...current, [section.circleId]: text }))
                    }
                    style={styles.input}
                    value={perCircleMessages[section.circleId] ?? sharedMessage}
                  />
                  <SecondaryButton
                    label={`Send to ${section.circleName} (${pendingPeople.length})`}
                    onPress={() => sendToCircle(section)}
                  />

                  {expandedCircleId === section.circleId ? (
                    <View style={styles.expandedPeople}>
                      {pendingPeople.map((person) => (
                        <View key={person.id} style={styles.expandedPersonRow}>
                          <Text style={styles.expandedPersonName}>{person.name}</Text>
                          <Pressable accessibilityRole="button" onPress={() => untickFromQuick(person)}>
                            <Text style={styles.linkText}>Untick</Text>
                          </Pressable>
                        </View>
                      ))}
                      {section.circleId !== "other" ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => expandToFullCircle(section)}
                        >
                          <Text style={styles.linkText}>Expand to full Circle</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personalise</Text>

        {personalisePeople.length === 0 ? (
          <Text style={styles.helper}>
            Anyone unticked from Quick message, or added below, appears here.
          </Text>
        ) : (
          <View style={styles.personList}>
            {personalisePeople.map((person) => {
              const isOther = person.circleId === null;
              const selectedForCircle = selectedOtherIds.has(person.id);

              return (
                <View key={person.id} style={styles.personBlock}>
                  <View style={styles.personTapArea}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Mark ${person.name} complete`}
                      accessibilityState={{ checked: person.completed }}
                      onPress={() => toggle(person)}
                      hitSlop={8}
                    >
                      <View style={[styles.checkbox, person.completed && styles.checkboxChecked]} />
                    </Pressable>
                    {isOther ? (
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityLabel={`Select ${person.name} to group into a Circle`}
                        accessibilityState={{ checked: selectedForCircle }}
                        onPress={() => toggleOtherSelection(person)}
                      >
                        <Text
                          style={[
                            styles.personName,
                            person.completed && styles.personNameDone,
                            selectedForCircle && styles.personNameSelected
                          ]}
                        >
                          {person.name}
                        </Text>
                      </Pressable>
                    ) : (
                      <View>
                        <Text style={[styles.personName, person.completed && styles.personNameDone]}>
                          {person.name}
                        </Text>
                        {person.circleName ? (
                          <Text style={styles.circleTag}>{person.circleName}</Text>
                        ) : null}
                      </View>
                    )}
                  </View>

                  {!person.completed ? (
                    <PersonaliseAccordion
                      person={person}
                      isOpen={expandedPersonId === person.id}
                      onToggle={() => togglePersonalise(person.id)}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {circlePromptStage === "confirm" ? (
          <View style={styles.createCirclePrompt}>
            <Text style={styles.createCirclePromptText}>Create a Circle for these people?</Text>
            <View style={styles.createCircleActions}>
              <SecondaryButton label="No" onPress={declineCreateCircle} />
              <SecondaryButton label="Yes" onPress={() => setCirclePromptStage("naming")} />
            </View>
          </View>
        ) : circlePromptStage === "naming" ? (
          <View style={styles.createCirclePrompt}>
            <TextInput
              accessibilityLabel="New Circle name"
              autoCapitalize="words"
              onChangeText={setNewOtherCircleName}
              placeholder="Circle name"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={newOtherCircleName}
            />
            <SecondaryButton
              disabled={!newOtherCircleName.trim()}
              label="Create Circle"
              onPress={() => void submitCreateCircle()}
            />
          </View>
        ) : null}

        <SecondaryButton label="+ Add person" onPress={addNewPerson} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Templates</Text>

        {templates.length === 0 ? (
          <Text style={styles.helper}>
            Saved messages appear here once you save one from Going Quiet.
          </Text>
        ) : (
          <View style={styles.templateList}>
            {templates.map((row) => {
              const draft = templateDrafts[row.circleId] ?? row.text;
              return (
                <View key={row.circleId} style={styles.templateBlock}>
                  <Text style={styles.circleRowTitle}>{row.circleName}</Text>
                  <TextInput
                    accessibilityLabel={`Saved message for ${row.circleName}`}
                    multiline
                    onChangeText={(text) => changeTemplateDraft(row.circleId, text)}
                    style={styles.input}
                    textAlignVertical="top"
                    value={draft}
                  />
                  <SecondaryButton
                    disabled={!draft.trim()}
                    label="Save"
                    onPress={() => saveTemplate(row.circleId)}
                  />
                </View>
              );
            })}
          </View>
        )}
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  content: {
    gap: theme.spacing.xl
  },
  pageTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "600"
  },
  empty: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24
  },
  section: {
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: theme.spacing.md
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600"
  },
  helper: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  chip: {
    minHeight: 36,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: theme.spacing.md,
    alignItems: "center",
    justifyContent: "center"
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  chipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600"
  },
  chipTextSelected: {
    color: colors.onPrimary
  },
  chipSent: {
    minHeight: 36,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceStrong
  },
  chipSentText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600"
  },
  quickBody: {
    gap: theme.spacing.sm
  },
  input: {
    minHeight: 60,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    backgroundColor: colors.surface
  },
  friendMessageSettled: {
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: colors.surfaceStrong
  },
  friendMessageSettledText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21
  },
  circleRows: {
    gap: theme.spacing.md
  },
  circleRow: {
    gap: theme.spacing.xs
  },
  circleRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  circleRowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600"
  },
  circleRowSent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 40,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: colors.surfaceStrong
  },
  circleRowSentText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "600"
  },
  circleRowSentLabel: {
    color: colors.textMuted,
    fontSize: 13
  },
  linkText: {
    color: colors.link,
    fontSize: 13,
    fontWeight: "600"
  },
  expandedPeople: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
    paddingLeft: theme.spacing.sm
  },
  expandedPersonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 32
  },
  expandedPersonName: {
    color: colors.text,
    fontSize: 15
  },
  personList: {
    gap: theme.spacing.md
  },
  templateList: {
    gap: theme.spacing.md
  },
  templateBlock: {
    gap: theme.spacing.xs
  },
  personBlock: {
    gap: theme.spacing.xs
  },
  personTapArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: 44
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: theme.radius.sm,
    borderWidth: 1.5,
    borderColor: colors.primary
  },
  checkboxChecked: {
    backgroundColor: colors.primary
  },
  personName: {
    color: colors.text,
    fontSize: 16
  },
  personNameDone: {
    color: colors.textMuted,
    textDecorationLine: "line-through"
  },
  personNameSelected: {
    color: colors.primary,
    fontWeight: "600"
  },
  circleTag: {
    color: colors.textMuted,
    fontSize: 12
  },
  createCirclePrompt: {
    gap: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: colors.surface,
    padding: theme.spacing.md
  },
  createCirclePromptText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600"
  },
  createCircleActions: {
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  personaliseBlock: {
    gap: theme.spacing.sm,
    paddingLeft: 32
  },
  accordionPanel: {
    gap: theme.spacing.xs
  },
  contactedStatus: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: "italic"
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: theme.spacing.xs
  },
  styleChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs
  },
  styleChip: {
    minHeight: 32,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: theme.spacing.sm,
    alignItems: "center",
    justifyContent: "center"
  },
  styleChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  styleChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600"
  },
  styleChipTextSelected: {
    color: colors.onPrimary
  },
  accordionActions: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm
  }
  });
}
