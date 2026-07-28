import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { theme } from "@/constants/theme";
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
import { getGroup } from "@/services/circleService";
import { pickContact } from "@/services/contactPickerService";
import { sendOrShare } from "@/services/smsService";
import { createReplyDraft } from "@/services/draftService";
import { getReply, saveReply } from "@/services/replyStorageService";
import { formatSentLabel } from "@/services/holdHistoryFormat";
import type { ReturnStyle, StoredReply } from "@/types/hold";

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
  const [loaded, setLoaded] = useState(false);
  const [friendMessage, setFriendMessage] = useState("");
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
          <Text style={styles.fieldLabel}>What they sent</Text>
          <TextInput
            accessibilityLabel="Message they sent"
            multiline
            onChangeText={changeFriendMessage}
            style={styles.input}
            textAlignVertical="top"
            value={friendMessage}
          />

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
  const [people, setPeople] = useState<ConversationPerson[]>([]);
  const [allSelected, setAllSelected] = useState(true);
  const [sharedMessage, setSharedMessage] = useState(DEFAULT_QUICK_MESSAGE);
  const [perCircleMessages, setPerCircleMessages] = useState<Record<string, string>>({});
  const [expandedCircleId, setExpandedCircleId] = useState<string | null>(null);
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const all = await getAllConversationPeople();
    setPeople(all);

    // Only a real Reconnect journey earns the "You're reconnected" screen — Library is also
    // reachable standalone, where reaching zero-incomplete has no such journey to close out.
    if (all.length > 0 && all.every((person) => person.completed) && mode === "return") {
      router.replace("/return/done");
    }
  }, [mode]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const quickPeopleAll = people.filter((person) => person.bucket === "quick");
  const quickPeoplePending = quickPeopleAll.filter((person) => !person.sentAt);
  const personalisePeople = people.filter((person) => person.bucket === "personalise");
  const quickSections = groupByCircle(quickPeopleAll);

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

  const sendToEveryone = () => confirmAndSend(sharedMessage, quickPeoplePending, () => {});

  const sendToCircle = (section: CircleSection) => {
    const message = perCircleMessages[section.circleId] ?? sharedMessage;
    const pendingPeople = section.people.filter((person) => !person.sentAt);
    confirmAndSend(message, pendingPeople, () => {
      if (expandedCircleId === section.circleId) setExpandedCircleId(null);
    });
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
              <View key={section.circleId} style={styles.chipSent} accessibilityRole="text">
                <Text style={styles.chipSentText}>✓ {section.circleName}</Text>
              </View>
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
          <View style={styles.quickBody}>
            <TextInput
              accessibilityLabel="Message to everyone"
              multiline
              onChangeText={setSharedMessage}
              style={styles.input}
              value={sharedMessage}
            />
            <PrimaryButton
              disabled={quickPeoplePending.length === 0}
              label={`Send to everyone (${quickPeoplePending.length})`}
              onPress={sendToEveryone}
            />
          </View>
        ) : (
          <View style={styles.circleRows}>
            {quickSections.map((section) => {
              if (section.sentAt !== null) {
                return (
                  <View key={section.circleId} style={styles.circleRowSent}>
                    <Text style={styles.circleRowSentText}>✓ {section.circleName}</Text>
                    <Text style={styles.circleRowSentLabel}>
                      {formatSentLabel(section.sentAt, "Instant message sent.")}
                    </Text>
                  </View>
                );
              }

              const pendingPeople = section.people.filter((person) => !person.sentAt);

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
            {personalisePeople.map((person) => (
              <View key={person.id} style={styles.personBlock}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: person.completed }}
                  onPress={() => toggle(person)}
                  style={styles.personTapArea}
                >
                  <View style={[styles.checkbox, person.completed && styles.checkboxChecked]} />
                  <View>
                    <Text style={[styles.personName, person.completed && styles.personNameDone]}>
                      {person.name}
                    </Text>
                    {person.circleName ? (
                      <Text style={styles.circleTag}>{person.circleName}</Text>
                    ) : null}
                  </View>
                </Pressable>

                {!person.completed ? (
                  <PersonaliseAccordion
                    person={person}
                    isOpen={expandedPersonId === person.id}
                    onToggle={() => togglePersonalise(person.id)}
                  />
                ) : null}
              </View>
            ))}
          </View>
        )}

        <SecondaryButton label="+ Add person" onPress={addNewPerson} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: theme.spacing.xl
  },
  pageTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "600"
  },
  empty: {
    color: theme.colors.textMuted,
    fontSize: 16,
    lineHeight: 24
  },
  section: {
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "600"
  },
  helper: {
    color: theme.colors.textMuted,
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
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    alignItems: "center",
    justifyContent: "center"
  },
  chipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  chipText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600"
  },
  chipTextSelected: {
    color: theme.colors.onPrimary
  },
  chipSent: {
    minHeight: 36,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceStrong
  },
  chipSentText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: "600"
  },
  quickBody: {
    gap: theme.spacing.sm
  },
  input: {
    minHeight: 60,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    color: theme.colors.text,
    fontSize: 16,
    lineHeight: 22,
    backgroundColor: theme.colors.white
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
    color: theme.colors.text,
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
    backgroundColor: theme.colors.surfaceStrong
  },
  circleRowSentText: {
    color: theme.colors.textMuted,
    fontSize: 15,
    fontWeight: "600"
  },
  circleRowSentLabel: {
    color: theme.colors.textMuted,
    fontSize: 13
  },
  linkText: {
    color: theme.colors.link,
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
    color: theme.colors.text,
    fontSize: 15
  },
  personList: {
    gap: theme.spacing.md
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
    borderColor: theme.colors.primary
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary
  },
  personName: {
    color: theme.colors.text,
    fontSize: 16
  },
  personNameDone: {
    color: theme.colors.textMuted,
    textDecorationLine: "line-through"
  },
  circleTag: {
    color: theme.colors.textMuted,
    fontSize: 12
  },
  personaliseBlock: {
    gap: theme.spacing.sm,
    paddingLeft: 32
  },
  accordionPanel: {
    gap: theme.spacing.xs
  },
  fieldLabel: {
    color: theme.colors.textMuted,
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
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.sm,
    alignItems: "center",
    justifyContent: "center"
  },
  styleChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  styleChipText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "600"
  },
  styleChipTextSelected: {
    color: theme.colors.onPrimary
  },
  accordionActions: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm
  }
});
