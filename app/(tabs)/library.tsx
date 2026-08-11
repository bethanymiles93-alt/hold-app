import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { SecondaryButton } from "@/components/SecondaryButton";
import { CompactSendButton } from "@/components/CompactSendButton";
import { DockedInputBar } from "@/components/DockedInputBar";
import { DockedFieldPreview } from "@/components/DockedFieldPreview";
import { SelectionCircle } from "@/components/SelectionCircle";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { PersonaliseAccordion } from "@/components/PersonaliseAccordion";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { QUICK_RECONNECT_MESSAGES } from "@/constants/copy";
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
import { getReconnectingPeriod } from "@/services/holdHistoryService";
import { getAllTemplates, saveCircleTemplate } from "@/services/templateService";
import type { ReturnStyle } from "@/types/hold";

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

/** Every screen-owned docked-bar field, keyed by tag — mirrors create/people.tsx's pattern. Personalise's "Your reply" is handled separately (personaliseReplyTarget below), since its persistence is owned by each PersonaliseAccordion instance, not by the screen. */
type ActiveField = `circle-message:${string}` | `individual-message:${string}` | "new-circle" | `template:${string}`;

interface PersonaliseReplyTarget {
  personId: string;
  onChangeText: (text: string) => void;
  friendMessage: string;
}

export default function LibraryScreen() {
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
  const [personaliseDrafts, setPersonaliseDrafts] = useState<Record<string, string>>({});
  const [personaliseStyles, setPersonaliseStyles] = useState<Record<string, ReturnStyle>>({});
  const [personaliseReplyTarget, setPersonaliseReplyTarget] = useState<PersonaliseReplyTarget | null>(null);

  const [selectedOtherIds, setSelectedOtherIds] = useState<Set<string>>(new Set());
  const [circlePromptStage, setCirclePromptStage] = useState<"none" | "confirm" | "naming">("none");
  const [newOtherCircleName, setNewOtherCircleName] = useState("");
  const [activeField, setActiveField] = useState<ActiveField | null>(null);

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templateDrafts, setTemplateDrafts] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const all = await getAllConversationPeople();
    setPeople(all);

    // Only a real, still-open Reconnect journey earns the "You're reconnected" screen —
    // Library is also reachable standalone, where reaching zero-incomplete has no such
    // journey to close out. Checked against the same durable RECONNECTING_KEY marker
    // Home's own resume logic uses, not in-memory flow-context mode — mode resets to
    // its default on force-quit, which would otherwise silently swallow this redirect
    // for anyone who closes the app mid-Reconnect and finishes addressing everyone later.
    if (all.length > 0 && all.every((person) => person.completed)) {
      const reconnectingPeriod = await getReconnectingPeriod();
      if (reconnectingPeriod) {
        router.replace("/return/done");
      }
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
  }, []);

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

  const activeCircleMessageId = activeField?.startsWith("circle-message:")
    ? activeField.slice("circle-message:".length)
    : null;
  const activeIndividualMessageId = activeField?.startsWith("individual-message:")
    ? activeField.slice("individual-message:".length)
    : null;
  const activeTemplateId = activeField?.startsWith("template:") ? activeField.slice("template:".length) : null;
  const activeIndividualPerson = activeIndividualMessageId
    ? people.find((p) => p.id === activeIndividualMessageId)
    : undefined;
  const activeTemplate = activeTemplateId ? templates.find((t) => t.circleId === activeTemplateId) : undefined;

  const activeFieldValue = (): string => {
    if (activeCircleMessageId) return defaultMessageForCircle(activeCircleMessageId);
    if (activeIndividualMessageId) {
      // Ungrouped people default to the quick-message text; a circle's
      // excluded member defaults to empty — matches each field's own prior
      // fallback exactly.
      const fallback = activeIndividualPerson?.circleId === null ? DEFAULT_QUICK_MESSAGE : "";
      return individualMessages[activeIndividualMessageId] ?? fallback;
    }
    if (activeField === "new-circle") return newOtherCircleName;
    if (activeTemplateId) return templateDrafts[activeTemplateId] ?? activeTemplate?.text ?? "";
    return "";
  };

  const setActiveFieldValue = (text: string) => {
    if (activeCircleMessageId) {
      setSharedMessages((current) => ({ ...current, [activeCircleMessageId]: text }));
    } else if (activeIndividualMessageId) {
      setIndividualMessages((current) => ({ ...current, [activeIndividualMessageId]: text }));
    } else if (activeField === "new-circle") {
      setNewOtherCircleName(text);
    } else if (activeTemplateId) {
      changeTemplateDraft(activeTemplateId, text);
    }
  };

  const activeFieldLabel = (): string => {
    if (activeCircleMessageId) {
      const section = circleSections.find((s) => s.circleId === activeCircleMessageId);
      return `Message to ${section?.circleName ?? "Circle"}`;
    }
    if (activeIndividualPerson) return `Message for ${activeIndividualPerson.name}`;
    if (activeField === "new-circle") return "New Circle name";
    if (activeTemplate) return `Saved message for ${activeTemplate.circleName}`;
    return "Message";
  };

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
    <Screen
      contentContainerStyle={styles.content}
      dockedInput={
        personaliseReplyTarget ? (
          <DockedInputBar
            value={personaliseDrafts[personaliseReplyTarget.personId] ?? ""}
            onChangeText={personaliseReplyTarget.onChangeText}
            onDone={() => setPersonaliseReplyTarget(null)}
            placeholder="Your reply"
            accessibilityLabel="Your reply"
            aiAmend={{
              surface: "conversations-reply",
              context: {
                returnStyle: personaliseStyles[personaliseReplyTarget.personId] ?? undefined,
                friendMessage: personaliseReplyTarget.friendMessage
              }
            }}
          />
        ) : activeField ? (
          <DockedInputBar
            value={activeFieldValue()}
            onChangeText={setActiveFieldValue}
            onDone={() => setActiveField(null)}
            placeholder={activeFieldLabel()}
            accessibilityLabel={activeFieldLabel()}
            aiAmend={
              activeCircleMessageId
                ? {
                    surface: "conversations-reply",
                    context: {
                      recipientLabel: circleSections.find((s) => s.circleId === activeCircleMessageId)
                        ?.circleName
                    }
                  }
                : activeIndividualPerson
                  ? {
                      surface: "conversations-reply",
                      context: { recipientLabel: activeIndividualPerson.name }
                    }
                  : activeTemplateId
                    ? { surface: "template" }
                    : undefined
            }
          />
        ) : null
      }
    >
      <Text style={styles.pageTitle}>Conversations</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {allIds.length > 0 ? (
          <AdaptiveCircleChip label="All" isSelected={allSelected} onPress={toggleAll} accessibilityRole="button" />
        ) : null}
        {circleSections.map((section) => {
          const isSelected = selectedIds.has(section.circleId);
          // Derived from existing durable per-person state (ConversationPerson.completed,
          // set by markQuickSent), not a new persisted flag — every included person in this
          // Circle already being marked complete is exactly "already sent this session."
          const hasSentThisSession = section.people.length > 0 && section.people.every((person) => person.completed);
          const sentLook = hasSentThisSession && !isSelected;

          return (
            <AdaptiveCircleChip
              key={section.circleId}
              label={sentLook ? `✓ ${section.circleName}` : section.circleName}
              isSelected={isSelected}
              hasSentThisSession={hasSentThisSession}
              onPress={() => toggleId(section.circleId)}
              accessibilityRole="button"
              accessibilityLabel={
                sentLook
                  ? `${section.circleName}, already sent. Tap to send another message.`
                  : section.circleName
              }
            />
          );
        })}
        {ungroupedPeople.map((person) => {
          const isSelected = selectedIds.has(person.id);
          const sentLook = person.completed && !isSelected;

          return (
            <AdaptiveCircleChip
              key={person.id}
              label={sentLook ? `✓ ${person.name}` : person.name}
              isSelected={isSelected}
              hasSentThisSession={person.completed}
              onPress={() => toggleId(person.id)}
              accessibilityRole="button"
              accessibilityLabel={sentLook ? `${person.name}, already sent. Tap to send another message.` : person.name}
            />
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

                <DockedFieldPreview
                  value={defaultMessageForCircle(section.circleId)}
                  placeholder={`Message to ${section.circleName}`}
                  isActive={activeField === `circle-message:${section.circleId}`}
                  onPress={() => setActiveField(`circle-message:${section.circleId}`)}
                  accessibilityLabel={`Message to ${section.circleName}`}
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
                              draft={personaliseDrafts[person.id] ?? ""}
                              onChangeDraft={(text) =>
                                setPersonaliseDrafts((current) => ({ ...current, [person.id]: text }))
                              }
                              style={personaliseStyles[person.id] ?? null}
                              onChangeStyle={(style) =>
                                setPersonaliseStyles((current) => ({ ...current, [person.id]: style }))
                              }
                              isReplyActive={personaliseReplyTarget?.personId === person.id}
                              onActivateReply={(bundle) =>
                                setPersonaliseReplyTarget({ personId: person.id, ...bundle })
                              }
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
                            <DockedFieldPreview
                              value={individualMessages[person.id] ?? ""}
                              placeholder={`Message for ${person.name}`}
                              isActive={activeField === `individual-message:${person.id}`}
                              onPress={() => setActiveField(`individual-message:${person.id}`)}
                              accessibilityLabel={`Message for ${person.name}`}
                            />
                            <View style={styles.excludedActions}>
                              <CompactSendButton
                                disabled={!(individualMessages[person.id] ?? "").trim()}
                                accessibilityLabel={`Send to ${person.name}`}
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

                <View style={styles.sendRow}>
                  <CompactSendButton
                    label={
                      includedMembers.length > 0
                        ? `Send (${includedMembers.length} ${includedMembers.length === 1 ? "person" : "people"})`
                        : undefined
                    }
                    accessibilityLabel={
                      includedMembers.length > 0
                        ? `Send to ${includedMembers.length} ${includedMembers.length === 1 ? "person" : "people"} in ${section.circleName}`
                        : `Send to ${section.circleName}`
                    }
                    onPress={() => sendCircle(section)}
                  />
                </View>
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
                      draft={personaliseDrafts[person.id] ?? ""}
                      onChangeDraft={(text) =>
                        setPersonaliseDrafts((current) => ({ ...current, [person.id]: text }))
                      }
                      style={personaliseStyles[person.id] ?? null}
                      onChangeStyle={(style) =>
                        setPersonaliseStyles((current) => ({ ...current, [person.id]: style }))
                      }
                      isReplyActive={personaliseReplyTarget?.personId === person.id}
                      onActivateReply={(bundle) =>
                        setPersonaliseReplyTarget({ personId: person.id, ...bundle })
                      }
                    />
                    <Pressable accessibilityRole="button" onPress={() => togglePersonaliseSwap(person.id)}>
                      <Text style={styles.linkText}>Use a quick message instead</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <DockedFieldPreview
                      value={individualMessages[person.id] ?? DEFAULT_QUICK_MESSAGE}
                      placeholder={`Message for ${person.name}`}
                      isActive={activeField === `individual-message:${person.id}`}
                      onPress={() => setActiveField(`individual-message:${person.id}`)}
                      accessibilityLabel={`Message for ${person.name}`}
                    />
                    <View style={styles.excludedActions}>
                      <CompactSendButton
                        disabled={!(individualMessages[person.id] ?? DEFAULT_QUICK_MESSAGE).trim()}
                        accessibilityLabel={`Send to ${person.name}`}
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
          <DockedFieldPreview
            value={newOtherCircleName}
            placeholder="Circle name"
            isActive={activeField === "new-circle"}
            onPress={() => setActiveField("new-circle")}
            accessibilityLabel="New Circle name"
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
                  <DockedFieldPreview
                    value={draft}
                    placeholder={`Saved message for ${row.circleName}`}
                    isActive={activeField === `template:${row.circleId}`}
                    onPress={() => setActiveField(`template:${row.circleId}`)}
                    accessibilityLabel={`Saved message for ${row.circleName}`}
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
    alignItems: "center",
    gap: theme.spacing.sm
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
  sendRow: {
    flexDirection: "row",
    justifyContent: "flex-end"
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
  });
}
