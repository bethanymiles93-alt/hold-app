import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SelectionCircle } from "@/components/SelectionCircle";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { pickContact, type PickedContact } from "@/services/contactPickerService";
import {
  addContactToGroup,
  createGroup,
  deleteGroup,
  getGroups,
  removeContactFromGroup
} from "@/services/circleService";
import type { CircleGroup } from "@/types/hold";

export default function CircleIndexScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [groups, setGroups] = useState<CircleGroup[]>([]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Staged, not persisted, until "Update circle" — keyed by existing contact id.
  const [stagedExcluded, setStagedExcluded] = useState<Set<string>>(new Set());
  const [stagedAdditions, setStagedAdditions] = useState<PickedContact[]>([]);

  const [creatingStage, setCreatingStage] = useState<"none" | "naming">("none");
  const [newCircleContacts, setNewCircleContacts] = useState<PickedContact[]>([]);
  const [newCircleName, setNewCircleName] = useState("");

  const refresh = useCallback(async () => {
    setGroups(await getGroups());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const toggleExpanded = (group: CircleGroup) => {
    setExpandedId((current) => {
      if (current === group.id) return null;

      setStagedExcluded(new Set());
      setStagedAdditions([]);
      return group.id;
    });
  };

  const toggleMember = (contactId: string) => {
    setStagedExcluded((current) => {
      const next = new Set(current);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  const addMemberToStaged = async () => {
    const picked = await pickContact();
    if (!picked) return;

    setStagedAdditions((current) =>
      current.some((contact) => contact.phoneNumber === picked.phoneNumber)
        ? current
        : [...current, picked]
    );
  };

  const removeStagedAddition = (phoneNumber: string) => {
    setStagedAdditions((current) => current.filter((contact) => contact.phoneNumber !== phoneNumber));
  };

  const stagedCountFor = (group: CircleGroup) =>
    group.contacts.filter((contact) => !stagedExcluded.has(contact.id)).length + stagedAdditions.length;

  const updateCircle = async (group: CircleGroup) => {
    if (stagedCountFor(group) === 0) return;

    for (const contact of group.contacts) {
      if (stagedExcluded.has(contact.id)) {
        await removeContactFromGroup(group.id, contact.id);
      }
    }
    for (const contact of stagedAdditions) {
      await addContactToGroup(group.id, contact);
    }

    setExpandedId(null);
    setStagedExcluded(new Set());
    setStagedAdditions([]);
    await refresh();
  };

  const removeGroup = (group: CircleGroup) => {
    Alert.alert("Delete this Circle?", "This removes the Circle and its saved contacts from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteGroup(group.id).then(() => {
            setExpandedId(null);
            void refresh();
          });
        }
      }
    ]);
  };

  const startCreating = async () => {
    const picked = await pickContact();
    if (!picked) return;

    setNewCircleContacts([picked]);
    setCreatingStage("naming");
  };

  const addAnotherNewCircleContact = async () => {
    const picked = await pickContact();
    if (!picked) return;

    setNewCircleContacts((current) =>
      current.some((contact) => contact.phoneNumber === picked.phoneNumber) ? current : [...current, picked]
    );
  };

  const cancelCreating = () => {
    setCreatingStage("none");
    setNewCircleContacts([]);
    setNewCircleName("");
  };

  const submitNewCircle = async () => {
    const name = newCircleName.trim();
    if (!name || newCircleContacts.length === 0) return;

    const group = await createGroup(name);
    for (const contact of newCircleContacts) {
      await addContactToGroup(group.id, contact);
    }

    cancelCreating();
    await refresh();
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <StepHeader body="Create and amend your circles." />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
        {groups.map((group) => {
          const selected = expandedId === group.id;
          return (
            <Pressable
              key={group.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => toggleExpanded(group)}
              style={[styles.pill, selected && styles.pillSelected]}
            >
              <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                {group.name} {selected ? "▲" : "▼"}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {groups
        .filter((group) => group.id === expandedId)
        .map((group) => {
          const resultingCount = stagedCountFor(group);

          return (
            <View key={group.id} style={styles.card}>
              {group.contacts.length === 0 && stagedAdditions.length === 0 ? (
                <Text style={styles.empty}>No one added yet.</Text>
              ) : (
                <View style={styles.memberList}>
                  {group.contacts.map((contact) => {
                    const included = !stagedExcluded.has(contact.id);
                    return (
                      <View key={contact.id} style={styles.memberRow}>
                        <SelectionCircle
                          selected={included}
                          onPress={() => toggleMember(contact.id)}
                          accessibilityLabel={`${included ? "Included" : "Excluded"}: ${contact.name}`}
                        />
                        <Text style={[styles.memberName, !included && styles.memberNameExcluded]}>
                          {contact.name}
                        </Text>
                      </View>
                    );
                  })}
                  {stagedAdditions.map((contact) => (
                    <View key={contact.phoneNumber} style={styles.memberRow}>
                      <SelectionCircle
                        selected={true}
                        onPress={() => removeStagedAddition(contact.phoneNumber)}
                        accessibilityLabel={`Remove ${contact.name} before saving`}
                      />
                      <Text style={styles.memberName}>{contact.name}</Text>
                      <Text style={styles.newTag}>New</Text>
                    </View>
                  ))}
                </View>
              )}

              <Pressable accessibilityRole="button" onPress={() => void addMemberToStaged()}>
                <Text style={styles.linkText}>Add from Contacts</Text>
              </Pressable>

              <PrimaryButton
                disabled={resultingCount === 0}
                label="Update circle"
                onPress={() => void updateCircle(group)}
              />

              {!group.isCloseCircle ? (
                <Pressable accessibilityRole="button" onPress={() => removeGroup(group)}>
                  <Text style={styles.deleteLabel}>Delete Circle</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}

      {creatingStage === "none" ? (
        <Pressable accessibilityRole="button" onPress={() => void startCreating()}>
          <Text style={styles.linkText}>Create a new circle</Text>
        </Pressable>
      ) : (
        <View style={styles.newCircle}>
          <Text style={styles.label}>New Circle</Text>

          <View style={styles.memberList}>
            {newCircleContacts.map((contact) => (
              <Text key={contact.phoneNumber} style={styles.memberName}>
                {contact.name}
              </Text>
            ))}
          </View>

          <Pressable accessibilityRole="button" onPress={() => void addAnotherNewCircleContact()}>
            <Text style={styles.linkText}>+ Add another person</Text>
          </Pressable>

          <View style={styles.inputRow}>
            <TextInput
              accessibilityLabel="New Circle name"
              autoCapitalize="words"
              onChangeText={setNewCircleName}
              onSubmitEditing={() => void submitNewCircle()}
              placeholder="Circle name, e.g. School friends"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              style={styles.input}
              value={newCircleName}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create Circle"
              disabled={!newCircleName.trim()}
              onPress={() => void submitNewCircle()}
              style={({ pressed }) => [
                styles.addButton,
                pressed && styles.addPressed,
                !newCircleName.trim() && styles.disabled
              ]}
            >
              <Text style={styles.addText}>Add</Text>
            </Pressable>
          </View>

          <Pressable accessibilityRole="button" onPress={cancelCreating}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  content: {
    gap: theme.spacing.xl
  },
  pillRow: {
    flexDirection: "row",
    gap: theme.spacing.sm
  },
  pill: {
    minHeight: 38,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: theme.spacing.md,
    alignItems: "center",
    justifyContent: "center"
  },
  pillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  pillText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600"
  },
  pillTextSelected: {
    color: colors.onPrimary
  },
  card: {
    gap: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: theme.spacing.md
  },
  empty: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22
  },
  memberList: {
    gap: theme.spacing.xs
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: 36
  },
  memberName: {
    color: colors.text,
    fontSize: 16
  },
  memberNameExcluded: {
    color: colors.textMuted,
    textDecorationLine: "line-through"
  },
  newTag: {
    color: colors.link,
    fontSize: 12,
    fontWeight: "600"
  },
  linkText: {
    color: colors.link,
    fontSize: 14,
    fontWeight: "600"
  },
  deleteLabel: {
    color: colors.error,
    fontSize: 14,
    fontWeight: "600"
  },
  newCircle: {
    gap: theme.spacing.sm
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600"
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  input: {
    flex: 1,
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    color: colors.text,
    fontSize: 17,
    backgroundColor: colors.surface
  },
  addButton: {
    minHeight: 40,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  addPressed: {
    backgroundColor: colors.primaryPressed
  },
  disabled: {
    opacity: 0.4
  },
  addText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: "600"
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600"
  }
  });
}
