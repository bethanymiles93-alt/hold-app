import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SelectionCircle } from "@/components/SelectionCircle";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { HeaderAddButton } from "@/components/HeaderAddButton";
import { HeaderSettingsButton } from "@/components/HeaderSettingsButton";
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
  const navigation = useNavigation();
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [groups, setGroups] = useState<CircleGroup[]>([]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // Staged, not persisted, until "Update circle" — keyed by circle id, since
  // more than one card can be open at once (via "All").
  const [stagedExcludedByCircle, setStagedExcludedByCircle] = useState<Record<string, Set<string>>>({});
  const [stagedAdditionsByCircle, setStagedAdditionsByCircle] = useState<Record<string, PickedContact[]>>({});

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

  const clearStagedFor = (circleId: string) => {
    setStagedExcludedByCircle((current) => {
      const { [circleId]: _removed, ...rest } = current;
      return rest;
    });
    setStagedAdditionsByCircle((current) => {
      const { [circleId]: _removed, ...rest } = current;
      return rest;
    });
  };

  const toggleExpanded = (group: CircleGroup) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(group.id)) {
        next.delete(group.id);
        clearStagedFor(group.id);
      } else {
        next.add(group.id);
      }
      return next;
    });
  };

  const allExpanded = groups.length > 0 && groups.every((group) => expandedIds.has(group.id));

  const toggleAllExpanded = () => {
    if (allExpanded) {
      setExpandedIds(new Set());
      setStagedExcludedByCircle({});
      setStagedAdditionsByCircle({});
    } else {
      setExpandedIds(new Set(groups.map((group) => group.id)));
    }
  };

  const toggleMember = (circleId: string, contactId: string) => {
    setStagedExcludedByCircle((current) => {
      const next = new Set(current[circleId] ?? []);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return { ...current, [circleId]: next };
    });
  };

  const addMemberToStaged = async (circleId: string) => {
    const picked = await pickContact();
    if (!picked) return;

    setStagedAdditionsByCircle((current) => {
      const existing = current[circleId] ?? [];
      if (existing.some((contact) => contact.phoneNumber === picked.phoneNumber)) return current;
      return { ...current, [circleId]: [...existing, picked] };
    });
  };

  const removeStagedAddition = (circleId: string, phoneNumber: string) => {
    setStagedAdditionsByCircle((current) => ({
      ...current,
      [circleId]: (current[circleId] ?? []).filter((contact) => contact.phoneNumber !== phoneNumber)
    }));
  };

  const stagedCountFor = (group: CircleGroup) => {
    const excluded = stagedExcludedByCircle[group.id] ?? new Set<string>();
    const additions = stagedAdditionsByCircle[group.id] ?? [];
    return group.contacts.filter((contact) => !excluded.has(contact.id)).length + additions.length;
  };

  const updateCircle = async (group: CircleGroup) => {
    if (stagedCountFor(group) === 0) return;

    const excluded = stagedExcludedByCircle[group.id] ?? new Set<string>();
    const additions = stagedAdditionsByCircle[group.id] ?? [];

    for (const contact of group.contacts) {
      if (excluded.has(contact.id)) {
        await removeContactFromGroup(group.id, contact.id);
      }
    }
    for (const contact of additions) {
      await addContactToGroup(group.id, contact);
    }

    setExpandedIds((current) => {
      const next = new Set(current);
      next.delete(group.id);
      return next;
    });
    clearStagedFor(group.id);
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
            setExpandedIds((current) => {
              const next = new Set(current);
              next.delete(group.id);
              return next;
            });
            clearStagedFor(group.id);
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

  // "+ New Circle" moves into the header bar itself, alongside the
  // hamburger — Going Quiet's own GroupPicker keeps its pinned pill as-is;
  // this is specific to Your Circles' header/title structure.
  useLayoutEffect(() => {
    const headerRightElement = () => (
      <View style={styles.headerActions}>
        <HeaderAddButton accessibilityLabel="New Circle" onPress={() => void startCreating()} />
        <HeaderSettingsButton />
      </View>
    );
    navigation.setOptions({
      headerRight: headerRightElement,
      // See app/_layout.tsx: iOS 26 gives custom headerRight views a native
      // "Liquid Glass" shared pill background unless opted out via the
      // items API, which overrides headerRight on iOS.
      unstable_headerRightItems: () => [
        { type: "custom", element: headerRightElement(), hidesSharedBackground: true }
      ]
    });
  }, [navigation, styles]);

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

  // Purely organisational/display grouping — does not merge Close and
  // Friends' data, membership, or templates. Close always exists
  // (ensureCloseCircle), so this heading always has at least one Circle
  // under it; Friends joins it only if the user has actually created one.
  const coreGroups = groups.filter((group) => group.isCloseCircle || group.name === "Friends");
  const otherGroups = groups.filter((group) => !group.isCloseCircle && group.name !== "Friends");

  const renderPill = (group: CircleGroup) => {
    const selected = expandedIds.has(group.id);
    return (
      <AdaptiveCircleChip
        key={group.id}
        label={`${group.name} ${selected ? "▲" : "▼"}`}
        isSelected={selected}
        isPrimary={group.isCloseCircle}
        onPress={() => toggleExpanded(group)}
        accessibilityRole="button"
      />
    );
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <StepHeader body="Create and amend your circles." />

      {coreGroups.length > 0 ? (
        <View style={styles.coreSection}>
          <Text style={styles.coreSectionHeading}>Core</Text>
          <Text style={styles.coreSectionCopy}>
            Your closest few, and the close friends around them, tend to form one connected group
            in how relationships naturally work.
          </Text>
          <Pressable
            accessibilityRole="link"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => router.push("/settings/research")}
          >
            <Text style={styles.coreSectionSource}>Where this comes from</Text>
          </Pressable>
          <View style={styles.corePillRow}>{coreGroups.map(renderPill)}</View>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
        {groups.length > 0 ? (
          <AdaptiveCircleChip label="All" isSelected={allExpanded} onPress={toggleAllExpanded} accessibilityRole="button" />
        ) : null}
        {otherGroups.map(renderPill)}
      </ScrollView>

      {creatingStage === "naming" ? (
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
      ) : null}

      <View style={styles.cardList}>
        {groups
          .filter((group) => expandedIds.has(group.id))
          .map((group) => {
            const excluded = stagedExcludedByCircle[group.id] ?? new Set<string>();
            const additions = stagedAdditionsByCircle[group.id] ?? [];
            const resultingCount = stagedCountFor(group);

            return (
              <View key={group.id} style={styles.card}>
                <Text style={styles.cardTitle}>{group.name}</Text>

                {group.contacts.length === 0 && additions.length === 0 ? (
                  <Text style={styles.empty}>No one added yet.</Text>
                ) : (
                  <View style={styles.memberList}>
                    {group.contacts.map((contact) => {
                      const included = !excluded.has(contact.id);
                      return (
                        <View key={contact.id} style={styles.memberRow}>
                          <SelectionCircle
                            selected={included}
                            onPress={() => toggleMember(group.id, contact.id)}
                            accessibilityLabel={`${included ? "Included" : "Excluded"}: ${contact.name}`}
                          />
                          <Text style={[styles.memberName, !included && styles.memberNameExcluded]}>
                            {contact.name}
                          </Text>
                        </View>
                      );
                    })}
                    {additions.map((contact) => (
                      <View key={contact.phoneNumber} style={styles.memberRow}>
                        <SelectionCircle
                          selected={true}
                          onPress={() => removeStagedAddition(group.id, contact.phoneNumber)}
                          accessibilityLabel={`Remove ${contact.name} before saving`}
                        />
                        <Text style={styles.memberName}>{contact.name}</Text>
                        <Text style={styles.newTag}>New</Text>
                      </View>
                    ))}
                  </View>
                )}

                <Pressable accessibilityRole="button" onPress={() => void addMemberToStaged(group.id)}>
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
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  content: {
    gap: theme.spacing.lg
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center"
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  coreSection: {
    gap: theme.spacing.xs
  },
  coreSectionHeading: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase"
  },
  coreSectionCopy: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
  },
  // Small and muted, deliberately not styled like a normal in-flow link or
  // an academic footnote number — a quiet pointer to the reasoning behind
  // the copy above, not a call to action.
  coreSectionSource: {
    color: colors.textMuted,
    fontSize: 11,
    fontStyle: "italic",
    minHeight: 20
  },
  corePillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    flexWrap: "wrap"
  },
  cardList: {
    gap: theme.spacing.lg
  },
  card: {
    gap: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: theme.spacing.md
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600"
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
