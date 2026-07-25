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
  toggleComplete,
  type ConversationPerson
} from "@/services/conversationService";
import { getGroup } from "@/services/circleService";
import { pickContact } from "@/services/contactPickerService";
import { isSmsAvailable, sendTextMessage } from "@/services/smsService";
import { shareMessage } from "@/services/shareService";

const DEFAULT_QUICK_MESSAGE = QUICK_RECONNECT_MESSAGES[0]?.text ?? "";
const OTHER_KEY = "__other__";

interface CircleSection {
  circleId: string | null;
  circleName: string;
  people: ConversationPerson[];
}

async function quickSend(numbers: string[], message: string): Promise<void> {
  if (numbers.length > 0 && (await isSmsAvailable())) {
    await sendTextMessage(numbers, message);
  } else {
    await shareMessage(message);
  }
}

function groupByCircle(people: ConversationPerson[]): CircleSection[] {
  const sections: CircleSection[] = [];
  const indexByKey = new Map<string, number>();

  for (const person of people) {
    const key = person.circleId ?? OTHER_KEY;
    let index = indexByKey.get(key);

    if (index === undefined) {
      index = sections.length;
      indexByKey.set(key, index);
      sections.push({ circleId: person.circleId, circleName: person.circleName ?? "Other", people: [] });
    }

    sections[index]?.people.push(person);
  }

  return sections;
}

export default function ConversationsScreen() {
  const [people, setPeople] = useState<ConversationPerson[]>([]);
  const [everyoneMessage, setEveryoneMessage] = useState(DEFAULT_QUICK_MESSAGE);
  const [circleMessages, setCircleMessages] = useState<Record<string, string>>({});
  const [openPersonId, setOpenPersonId] = useState<string | null>(null);
  const [personMessages, setPersonMessages] = useState<Record<string, string>>({});

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

  const incomplete = people.filter((person) => !person.completed);
  const sections = groupByCircle(people);

  const sendToEveryone = () => {
    const message = everyoneMessage.trim();
    if (incomplete.length === 0 || !message) return;

    Alert.alert(`Send "${message}" to ${incomplete.length} people?`, undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send",
        onPress: () =>
          void (async () => {
            await quickSend(incomplete.map((person) => person.phoneNumber), message);
            await Promise.all(incomplete.map((person) => toggleComplete(person.id, true)));
            await refresh();
          })()
      }
    ]);
  };

  const sendToCircle = (section: CircleSection) => {
    const key = section.circleId ?? OTHER_KEY;
    const targets = section.people.filter((person) => !person.completed);
    const message = (circleMessages[key] ?? everyoneMessage).trim();
    if (targets.length === 0 || !message) return;

    Alert.alert(`Send "${message}" to ${targets.length} people?`, undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send",
        onPress: () =>
          void (async () => {
            await quickSend(targets.map((person) => person.phoneNumber), message);
            await Promise.all(targets.map((person) => toggleComplete(person.id, true)));
            await refresh();
          })()
      }
    ]);
  };

  const toggle = (person: ConversationPerson) => {
    void (async () => {
      await toggleComplete(person.id, !person.completed);
      await refresh();
    })();
  };

  const sendQuickMessageTo = (person: ConversationPerson) => {
    const message = (personMessages[person.id] ?? DEFAULT_QUICK_MESSAGE).trim();
    if (!message) return;

    void (async () => {
      await quickSend([person.phoneNumber], message);
      await toggleComplete(person.id, true);
      setOpenPersonId(null);
      await refresh();
    })();
  };

  const personalise = (person: ConversationPerson) => {
    router.push({
      pathname: "/return/reply/edit",
      params: { personId: person.id, personName: person.name }
    });
  };

  const expandCircle = (section: CircleSection) => {
    if (!section.circleId) return;

    void (async () => {
      const group = await getGroup(section.circleId!);
      if (!group) return;

      await addCircleMembers(
        group.id,
        group.name,
        group.contacts.map((contact) => ({ name: contact.name, phoneNumber: contact.phoneNumber }))
      );
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

  return (
    <Screen contentContainerStyle={styles.content}>
      {people.length === 0 ? (
        <Text style={styles.empty}>
          Nothing here yet. When you need help replying to someone, this is where you’ll find it.
        </Text>
      ) : (
        <View style={styles.body}>
          <View style={styles.everyone}>
            <Text style={styles.sectionTitle}>Send to everyone</Text>
            <TextInput
              accessibilityLabel="Message to everyone"
              multiline
              onChangeText={setEveryoneMessage}
              style={styles.input}
              value={everyoneMessage}
            />
            <PrimaryButton
              disabled={incomplete.length === 0}
              label={`Send to everyone (${incomplete.length})`}
              onPress={sendToEveryone}
            />
          </View>

          {sections.map((section) => {
            const key = section.circleId ?? OTHER_KEY;
            const remaining = section.people.filter((person) => !person.completed).length;

            return (
              <View key={key} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{section.circleName}</Text>
                  {section.circleId ? (
                    <Pressable accessibilityRole="button" onPress={() => expandCircle(section)}>
                      <Text style={styles.linkText}>Expand to full Circle</Text>
                    </Pressable>
                  ) : null}
                </View>

                {remaining > 0 ? (
                  <View style={styles.circleSend}>
                    <TextInput
                      accessibilityLabel={`Message to ${section.circleName}`}
                      onChangeText={(text) => setCircleMessages((current) => ({ ...current, [key]: text }))}
                      placeholder={everyoneMessage}
                      placeholderTextColor={theme.colors.textMuted}
                      style={styles.circleInput}
                      value={circleMessages[key] ?? ""}
                    />
                    <SecondaryButton
                      label={`Send to ${section.circleName} (${remaining})`}
                      onPress={() => sendToCircle(section)}
                    />
                  </View>
                ) : null}

                <View style={styles.personList}>
                  {section.people.map((person) => (
                    <View key={person.id} style={styles.personRow}>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: person.completed }}
                        onPress={() => toggle(person)}
                        style={styles.personTapArea}
                      >
                        <View style={[styles.checkbox, person.completed && styles.checkboxChecked]} />
                        <Text style={[styles.personName, person.completed && styles.personNameDone]}>
                          {person.name}
                        </Text>
                      </Pressable>

                      {!person.completed ? (
                        <View style={styles.personActions}>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() =>
                              setOpenPersonId((current) => (current === person.id ? null : person.id))
                            }
                          >
                            <Text style={styles.linkText}>Quick message</Text>
                          </Pressable>
                          <Pressable accessibilityRole="button" onPress={() => personalise(person)}>
                            <Text style={styles.linkText}>Personalise</Text>
                          </Pressable>
                        </View>
                      ) : null}

                      {openPersonId === person.id ? (
                        <View style={styles.quickMessageBox}>
                          <TextInput
                            accessibilityLabel={`Quick message to ${person.name}`}
                            multiline
                            onChangeText={(text) =>
                              setPersonMessages((current) => ({ ...current, [person.id]: text }))
                            }
                            style={styles.input}
                            value={personMessages[person.id] ?? DEFAULT_QUICK_MESSAGE}
                          />
                          <PrimaryButton label="Send" onPress={() => sendQuickMessageTo(person)} />
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.footer}>
        <SecondaryButton label="+ Add person" onPress={addNewPerson} />
        <Pressable accessibilityRole="button" onPress={() => router.push("/create/people")}>
          <Text style={styles.goingQuietLink}>Need to go quiet again?</Text>
        </Pressable>
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
  body: {
    gap: theme.spacing.xl
  },
  everyone: {
    gap: theme.spacing.sm
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "600"
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
  section: {
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  linkText: {
    color: theme.colors.link,
    fontSize: 13,
    fontWeight: "600"
  },
  circleSend: {
    gap: theme.spacing.xs
  },
  circleInput: {
    minHeight: 44,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    color: theme.colors.text,
    fontSize: 15,
    backgroundColor: theme.colors.white
  },
  personList: {
    gap: theme.spacing.sm
  },
  personRow: {
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
  personActions: {
    flexDirection: "row",
    gap: theme.spacing.md,
    paddingLeft: 34
  },
  quickMessageBox: {
    gap: theme.spacing.xs,
    paddingLeft: 34
  },
  footer: {
    gap: theme.spacing.md,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.lg
  },
  goingQuietLink: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: "600"
  }
});
