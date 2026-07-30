import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { AmendWithAI } from "@/components/AmendWithAI";
import { SelectionCircle } from "@/components/SelectionCircle";
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
  addPerson,
  getAll as getAllConversationPeople,
  markQuickSent,
  toggleComplete,
  type ConversationPerson
} from "@/services/conversationService";
import { addContactToGroup, createGroup, getGroups } from "@/services/circleService";
import { pickContact } from "@/services/contactPickerService";
import { sendOrShare } from "@/services/smsService";
import { createReplyDraft } from "@/services/draftService";
import { getReply, saveReply } from "@/services/replyStorageService";
import { formatSentLabel } from "@/services/holdHistoryFormat";
import { getAllTemplates, saveCircleTemplate } from "@/services/templateService";
import type { ReturnStyle, StoredReply } from "@/types/hold";

const DEFAULT_QUICK_MESSAGE = QUICK_RECONNECT_MESSAGES[0]?.text ?? "";

interface TemplateRow {
  circleId: string;
  circleName: string;
  text: string;
}

interface CircleSection {
  circleId: string;
  circleName: string;
  people: ConversationPerson[];
}

function groupByCircle(people: ConversationPerson[]): CircleSection[] {
  const sections: CircleSection[] = [];
  const indexByCircleId = new Map<string, number>();

  for (const person of people) {
    if (!person.circleId) continue;

    let index = indexByCircleId.get(person.circleId);
    if (index === undefined) {
      index = sections.length;
      indexByCircleId.set(person.circleId, index);
      sections.push({ circleId: person.circleId, circleName: person.circleName ?? "Circle", people: [] });
    }

    sections[index]?.people.push(person);
  }

  return sections;
}

interface PersonaliseAccordionProps {
  person: ConversationPerson;
  isOpen: boolean;
  onToggle: () => void;
  onSent: () => void;
}

function PersonaliseAccordion({ person, isOpen, onToggle, onSent }: PersonaliseAccordionProps) {
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
      onSent();
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
  const [templateTextByCircleId, setTemplateTextByCircleId] = useState<Record<string, string>>({});

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sharedMessages, setSharedMessages] = useState<Record<string, string>>({});
  const [excludedPersonIds, setExcludedPersonIds] = useState<Set<string>>(new Set());
  const [individualMessages, setIndividualMessages] = useState<Record<string, string>>({});
  const [personaliseSwapIds, setPersonaliseSwapIds] = useState<Set<string>>(new Set());
  const [expandedPersonaliseId, setExpandedPersonaliseId] = useState<string | null>(null);

  const [selectedOtherIds, setSelectedOtherIds] = useState<Set<string>>(new Set());
  const [circlePromptStage, setCirclePromptStage] = useState<"none" | "confirm" | "naming">("none");
  const [newOtherCircleName, setNewOtherCircleName] = useState("");

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templateDrafts, setTemplateDrafts] = useState<Record<string, string>>({});

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

    const templateTextNext: Record<string, string> = {};
    for (const template of savedTemplates) templateTextNext[template.circleId] = template.text;
    setTemplateTextByCircleId(templateTextNext);

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

  const circleSections = useMemo(() => groupByCircle(people), [people]);
  const ungroupedPeople = useMemo(() => people.filter((person) => person.circleId === null), [people]);
  const allIds = useMemo(
    () => [...circleSections.map((section) => section.circleId), ...ungroupedPeople.map((person) => person.id)],
    [circleSections, ungroupedPeople]
  );
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  };

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

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const defaultMessageForCircle = (circleId: string) =>
    sharedMessages[circleId] ?? templateTextByCircleId[circleId] ?? DEFAULT_QUICK_MESSAGE;

  const toggleExcludeMember = (section: CircleSection, person: ConversationPerson) => {
    // A single-contact Circle never offers this — excluding the only person
    // already has the same effect as not selecting the Circle at all.
    if (section.people.length <= 1) return;

    setExcludedPersonIds((current) => {
      const next = new Set(current);
      if (next.has(person.id)) {
        next.delete(person.id);
      } else {
        next.add(person.id);
        setIndividualMessages((currentMessages) =>
          currentMessages[person.id] !== undefined
            ? currentMessages
            : { ...currentMessages, [person.id]: defaultMessageForCircle(section.circleId) }
        );
      }
      return next;
    });
  };

  const togglePersonaliseSwap = (personId: string) => {
    setPersonaliseSwapIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  };

  const sendCircle = (section: CircleSection) => {
    // Already-completed members are treated as handled — the shared box
    // doesn't resend to them by default, though they're still visible (and
    // individually re-toggleable) in the expanded member list.
    const included = section.people.filter(
      (person) => !excludedPersonIds.has(person.id) && !person.completed
    );
    const text = defaultMessageForCircle(section.circleId).trim();
    const excludedMembers = section.people.filter((person) => excludedPersonIds.has(person.id));
    const instantExcluded = excludedMembers.filter((person) => !personaliseSwapIds.has(person.id));

    const recipientCount = included.length + instantExcluded.length;
    if (recipientCount === 0) return;

    Alert.alert(`Send to ${section.circleName}?`, `Reaches ${recipientCount} people.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send",
        onPress: () =>
          void (async () => {
            if (included.length > 0 && text) {
              try {
                await sendOrShare(included.map((person) => person.phoneNumber), text);
              } catch {
                // Move on even if this compose sheet was dismissed.
              }
              await markQuickSent(included.map((person) => person.id));
            }

            for (const person of instantExcluded) {
              const individualText = (individualMessages[person.id] ?? "").trim();
              if (!individualText) continue;
              try {
                await sendOrShare([person.phoneNumber], individualText);
              } catch {
                // Move on to the next person even if this compose sheet was dismissed.
              }
              await markQuickSent([person.id]);
            }

            setExcludedPersonIds((current) => {
              const next = new Set(current);
              for (const person of section.people) next.delete(person.id);
              return next;
            });
            await refresh();
          })()
      }
    ]);
  };

  const sendIndividual = (person: ConversationPerson) => {
    const text = (individualMessages[person.id] ?? "").trim();
    if (!text) return;

    void (async () => {
      try {
        await sendOrShare([person.phoneNumber], text);
      } catch {
        // The compose sheet closing is the only signal available either way.
      }
      await markQuickSent([person.id]);
      await refresh();
    })();
  };

  const toggleCompletePerson = (person: ConversationPerson) => {
    void (async () => {
      await toggleComplete(person.id, !person.completed);
      await refresh();
    })();
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

    const selectedPeople = ungroupedPeople.filter((person) => selectedOtherIds.has(person.id));
    const group = await createGroup(name);
    for (const person of selectedPeople) {
      await addContactToGroup(group.id, { name: person.name, phoneNumber: person.phoneNumber });
    }

    setNewOtherCircleName("");
    setCirclePromptStage("none");
    setSelectedOtherIds(new Set());
    await refresh();
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {allIds.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: allSelected }}
            onPress={toggleAll}
            style={[styles.chip, allSelected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, allSelected && styles.chipTextSelected]}>All</Text>
          </Pressable>
        ) : null}
        {circleSections.map((section) => {
          const selected = selectedIds.has(section.circleId);
          return (
            <Pressable
              key={section.circleId}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => toggleId(section.circleId)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {section.circleName}
              </Text>
            </Pressable>
          );
        })}
        {ungroupedPeople.map((person) => {
          const selected = selectedIds.has(person.id);
          return (
            <Pressable
              key={person.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => toggleId(person.id)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{person.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.cardList}>
        {circleSections
          .filter((section) => selectedIds.has(section.circleId))
          .map((section) => {
            const expanded = expandedIds.has(section.circleId);
            const includedMembers = section.people.filter(
              (person) => !excludedPersonIds.has(person.id) && !person.completed
            );
            const excludedMembers = section.people.filter((person) => excludedPersonIds.has(person.id));
            const isSoleContact = section.people.length === 1;

            return (
              <View key={section.circleId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{section.circleName}</Text>
                  <Pressable accessibilityRole="button" onPress={() => toggleExpanded(section.circleId)}>
                    <Text style={styles.linkText}>{expanded ? "Hide people" : "Show people"}</Text>
                  </Pressable>
                </View>

                {expanded ? (
                  <View style={styles.memberList}>
                    {section.people.map((person) => (
                      <View key={person.id} style={styles.memberRow}>
                        <View style={styles.memberRowStart}>
                          {isSoleContact ? null : (
                            <SelectionCircle
                              selected={!excludedPersonIds.has(person.id)}
                              onPress={() => toggleExcludeMember(section, person)}
                              accessibilityLabel={`${
                                excludedPersonIds.has(person.id) ? "Excluded" : "Included"
                              }: ${person.name}`}
                            />
                          )}
                          <Text style={[styles.memberName, person.completed && styles.memberNameDone]}>
                            {person.name}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityLabel={`Mark ${person.name} complete`}
                          accessibilityState={{ checked: person.completed }}
                          onPress={() => toggleCompletePerson(person)}
                          hitSlop={8}
                        >
                          <View style={[styles.checkbox, person.completed && styles.checkboxChecked]} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}

                <TextInput
                  accessibilityLabel={`Message to ${section.circleName}`}
                  multiline
                  onChangeText={(text) =>
                    setSharedMessages((current) => ({ ...current, [section.circleId]: text }))
                  }
                  style={styles.input}
                  textAlignVertical="top"
                  value={defaultMessageForCircle(section.circleId)}
                />
                <AmendWithAI
                  surface="conversations-reply"
                  currentMessage={defaultMessageForCircle(section.circleId)}
                  onApply={(text) =>
                    setSharedMessages((current) => ({ ...current, [section.circleId]: text }))
                  }
                  context={{ recipientLabel: section.circleName }}
                />

                {expanded && excludedMembers.length > 0 ? (
                  <View style={styles.excludedList}>
                    {excludedMembers.map((person) => (
                      <View key={person.id} style={styles.excludedBlock}>
                        <Text style={styles.memberName}>{person.name}</Text>

                        {personaliseSwapIds.has(person.id) ? (
                          <>
                            <PersonaliseAccordion
                              person={person}
                              isOpen={expandedPersonaliseId === person.id}
                              onToggle={() =>
                                setExpandedPersonaliseId((current) =>
                                  current === person.id ? null : person.id
                                )
                              }
                              onSent={() => void refresh()}
                            />
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => togglePersonaliseSwap(person.id)}
                            >
                              <Text style={styles.linkText}>Use a quick message instead</Text>
                            </Pressable>
                          </>
                        ) : (
                          <>
                            <TextInput
                              accessibilityLabel={`Message for ${person.name}`}
                              multiline
                              onChangeText={(text) =>
                                setIndividualMessages((current) => ({ ...current, [person.id]: text }))
                              }
                              style={styles.input}
                              textAlignVertical="top"
                              value={individualMessages[person.id] ?? ""}
                            />
                            <AmendWithAI
                              surface="conversations-reply"
                              currentMessage={individualMessages[person.id] ?? ""}
                              onApply={(text) =>
                                setIndividualMessages((current) => ({ ...current, [person.id]: text }))
                              }
                              context={{ recipientLabel: person.name }}
                            />
                            <View style={styles.excludedActions}>
                              <SecondaryButton
                                disabled={!(individualMessages[person.id] ?? "").trim()}
                                label="Send"
                                onPress={() => sendIndividual(person)}
                              />
                              <Pressable
                                accessibilityRole="button"
                                onPress={() => togglePersonaliseSwap(person.id)}
                              >
                                <Text style={styles.linkText}>Personalise</Text>
                              </Pressable>
                            </View>
                          </>
                        )}
                      </View>
                    ))}
                  </View>
                ) : null}

                <SecondaryButton
                  label={`Send${includedMembers.length > 0 ? ` (${includedMembers.length})` : ""}`}
                  onPress={() => sendCircle(section)}
                />
              </View>
            );
          })}

        {ungroupedPeople
          .filter((person) => selectedIds.has(person.id))
          .map((person) => {
            const selectedForCircle = selectedOtherIds.has(person.id);

            return (
              <View key={person.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Select ${person.name} to group into a Circle`}
                    accessibilityState={{ checked: selectedForCircle }}
                    onPress={() => toggleOtherSelection(person)}
                  >
                    <Text style={[styles.cardTitle, selectedForCircle && styles.cardTitleSelected]}>
                      {person.name}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Mark ${person.name} complete`}
                    accessibilityState={{ checked: person.completed }}
                    onPress={() => toggleCompletePerson(person)}
                    hitSlop={8}
                  >
                    <View style={[styles.checkbox, person.completed && styles.checkboxChecked]} />
                  </Pressable>
                </View>

                {personaliseSwapIds.has(person.id) ? (
                  <>
                    <PersonaliseAccordion
                      person={person}
                      isOpen={expandedPersonaliseId === person.id}
                      onToggle={() =>
                        setExpandedPersonaliseId((current) => (current === person.id ? null : person.id))
                      }
                      onSent={() => void refresh()}
                    />
                    <Pressable accessibilityRole="button" onPress={() => togglePersonaliseSwap(person.id)}>
                      <Text style={styles.linkText}>Use a quick message instead</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <TextInput
                      accessibilityLabel={`Message for ${person.name}`}
                      multiline
                      onChangeText={(text) =>
                        setIndividualMessages((current) => ({ ...current, [person.id]: text }))
                      }
                      style={styles.input}
                      textAlignVertical="top"
                      value={individualMessages[person.id] ?? DEFAULT_QUICK_MESSAGE}
                    />
                    <AmendWithAI
                      surface="conversations-reply"
                      currentMessage={individualMessages[person.id] ?? DEFAULT_QUICK_MESSAGE}
                      onApply={(text) =>
                        setIndividualMessages((current) => ({ ...current, [person.id]: text }))
                      }
                      context={{ recipientLabel: person.name }}
                    />
                    <View style={styles.excludedActions}>
                      <SecondaryButton
                        disabled={!(individualMessages[person.id] ?? DEFAULT_QUICK_MESSAGE).trim()}
                        label="Send"
                        onPress={() => sendIndividual(person)}
                      />
                      <Pressable accessibilityRole="button" onPress={() => togglePersonaliseSwap(person.id)}>
                        <Text style={styles.linkText}>Personalise</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            );
          })}
      </View>

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
                  <Text style={styles.cardTitle}>{row.circleName}</Text>
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
    gap: theme.spacing.lg
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
  templateList: {
    gap: theme.spacing.md
  },
  templateBlock: {
    gap: theme.spacing.xs
  },
  chipRow: {
    flexDirection: "row",
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
  cardList: {
    gap: theme.spacing.lg
  },
  card: {
    gap: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: theme.spacing.md
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600"
  },
  cardTitleSelected: {
    color: colors.primary
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
  linkText: {
    color: colors.link,
    fontSize: 13,
    fontWeight: "600"
  },
  memberList: {
    gap: theme.spacing.xs
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 36
  },
  memberRowStart: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  memberName: {
    color: colors.text,
    fontSize: 15
  },
  memberNameDone: {
    color: colors.textMuted,
    textDecorationLine: "line-through"
  },
  excludedList: {
    gap: theme.spacing.md,
    marginLeft: 32,
    paddingLeft: theme.spacing.sm,
    borderLeftWidth: 1.5,
    borderLeftColor: colors.border
  },
  excludedBlock: {
    gap: theme.spacing.xs
  },
  excludedActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md
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
    gap: theme.spacing.sm
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
