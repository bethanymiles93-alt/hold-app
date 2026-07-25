import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { theme } from "@/constants/theme";
import { QUICK_RECONNECT_MESSAGES } from "@/constants/copy";
import {
  addCircleMembers,
  addPerson,
  getAll as getAllConversationPeople,
  moveToPersonalise,
  toggleComplete,
  type ConversationPerson
} from "@/services/conversationService";
import { getGroup } from "@/services/circleService";
import { pickContact } from "@/services/contactPickerService";
import { sendOrShare } from "@/services/smsService";

const DEFAULT_QUICK_MESSAGE = QUICK_RECONNECT_MESSAGES[0]?.text ?? "";

interface CircleSection {
  circleId: string;
  circleName: string;
  people: ConversationPerson[];
}

function groupByCircle(people: ConversationPerson[]): CircleSection[] {
  const sections: CircleSection[] = [];
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

  return sections;
}

export default function ConversationsScreen() {
  const [people, setPeople] = useState<ConversationPerson[]>([]);
  const [allSelected, setAllSelected] = useState(true);
  const [sharedMessage, setSharedMessage] = useState(DEFAULT_QUICK_MESSAGE);
  const [perCircleMessages, setPerCircleMessages] = useState<Record<string, string>>({});
  const [expandedCircleId, setExpandedCircleId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const all = await getAllConversationPeople();
    setPeople(all);

    if (all.length > 0 && all.every((person) => person.completed)) {
      router.replace("/return/done");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const quickPeople = people.filter((person) => person.bucket === "quick" && !person.completed);
  const personalisePeople = people.filter((person) => person.bucket === "personalise");
  const quickSections = groupByCircle(quickPeople);

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
            await Promise.all(targets.map((person) => toggleComplete(person.id, true)));
            onDone();
            await refresh();
          })()
      }
    ]);
  };

  const sendToEveryone = () => confirmAndSend(sharedMessage, quickPeople, () => {});

  const sendToCircle = (section: CircleSection) => {
    const message = perCircleMessages[section.circleId] ?? sharedMessage;
    confirmAndSend(message, section.people, () => {
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

  const personalise = (person: ConversationPerson) => {
    router.push({
      pathname: "/return/reply/edit",
      params: { personId: person.id, personName: person.name }
    });
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
        <Text style={styles.empty}>
          Nothing here yet. When you need help replying to someone, this is where you’ll find it.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.content}>
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
          {quickSections.map((section) => (
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
          ))}
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
              disabled={quickPeople.length === 0}
              label={`Send to everyone (${quickPeople.length})`}
              onPress={sendToEveryone}
            />
          </View>
        ) : (
          <View style={styles.circleRows}>
            {quickSections.map((section) => (
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
                  label={`Send to ${section.circleName} (${section.people.length})`}
                  onPress={() => sendToCircle(section)}
                />

                {expandedCircleId === section.circleId ? (
                  <View style={styles.expandedPeople}>
                    {section.people.map((person) => (
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
            ))}
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
              <View key={person.id} style={styles.personRow}>
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
                  <Pressable accessibilityRole="button" onPress={() => personalise(person)}>
                    <Text style={styles.linkText}>Personalise</Text>
                  </Pressable>
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
    fontSize: 18,
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
    gap: theme.spacing.sm
  },
  personRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  personTapArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: 44,
    flex: 1
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
  }
});
