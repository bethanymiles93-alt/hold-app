import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { AdaptiveCircleChip } from "@/components/AdaptiveCircleChip";
import { DropdownArrowBadge } from "@/components/DropdownArrowBadge";
import { CitationMarker } from "@/components/CitationMarker";
import { DockedInputBar } from "@/components/DockedInputBar";
import { DockedFieldPreview } from "@/components/DockedFieldPreview";
import { HeaderSettingsButton } from "@/components/HeaderSettingsButton";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { pickContact, type PickedContact } from "@/services/contactPickerService";
import {
  addContactToGroup,
  createGroup,
  deleteGroup,
  getGroups,
  removeContactFromGroup,
  setContactPreferredChannel,
  setSendAsGroup
} from "@/services/circleService";
import type { CircleGroup, SendingChannel } from "@/types/hold";

const CHANNEL_LABELS: Record<"default" | SendingChannel, string> = {
  default: "Default",
  sms: "Text",
  whatsapp: "WhatsApp"
};

/** Default → Text → WhatsApp → Default. Applies immediately, unlike the rest of this card's staged/"Update circle" changes — there's no meaningful "undo before saving" state for a preference this small. */
function nextChannel(current: SendingChannel | undefined): SendingChannel | undefined {
  if (current === undefined) return "sms";
  if (current === "sms") return "whatsapp";
  return undefined;
}

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
  const [newCircleSendAsGroup, setNewCircleSendAsGroup] = useState(false);
  const [activeField, setActiveField] = useState<"new-circle-name" | null>(null);

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

  /** If anyone's currently marked for removal, "All" clears that (restores everyone) — otherwise it marks every existing member for removal. A plain toggle, mirroring toggleAllExpanded's own shape at the top of this screen. */
  const toggleAllMembers = (group: CircleGroup) => {
    setStagedExcludedByCircle((current) => {
      const existing = current[group.id] ?? new Set<string>();
      const next = existing.size > 0 ? new Set<string>() : new Set(group.contacts.map((contact) => contact.id));
      return { ...current, [group.id]: next };
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

  // "+ New Circle" moved out of the header (2026-08-30) — down onto the
  // description row instead, next to "Create and amend your circles."
  // The header now carries only the settings hamburger, same as most
  // other screens.
  useLayoutEffect(() => {
    const headerRightElement = () => <HeaderSettingsButton />;
    navigation.setOptions({
      headerRight: headerRightElement,
      // See app/_layout.tsx: iOS 26 gives custom headerRight views a native
      // "Liquid Glass" shared pill background unless opted out via the
      // items API, which overrides headerRight on iOS.
      unstable_headerRightItems: () => [
        { type: "custom", element: headerRightElement(), hidesSharedBackground: true }
      ]
    });
  }, [navigation]);

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
    setNewCircleSendAsGroup(false);
    setActiveField(null);
  };

  const submitNewCircle = async () => {
    const name = newCircleName.trim();
    if (!name || newCircleContacts.length === 0) return;

    const group = await createGroup(name, newCircleSendAsGroup);
    for (const contact of newCircleContacts) {
      await addContactToGroup(group.id, contact);
    }

    cancelCreating();
    await refresh();
  };

  /** Individual/BCC-style delivery is the default for every Circle — this only ever turns the shared-group-thread option on or off. See docs/09-decision-log.md, 2026-08-11. */
  const toggleGroupDelivery = async (group: CircleGroup, value: boolean) => {
    await setSendAsGroup(group.id, value);
    await refresh();
  };

  const cycleContactChannel = async (groupId: string, contactId: string, current: SendingChannel | undefined) => {
    await setContactPreferredChannel(groupId, contactId, nextChannel(current));
    await refresh();
  };

  // Purely organisational/display grouping — does not merge Close and
  // Friends' data, membership, or templates. Close always exists
  // (ensureCloseCircle); Friends is now also seeded automatically, once
  // per install (ensureFriendsCircleSeeded, 2026-08-30) — this heading
  // always has both under it unless Friends was later deleted.
  const coreGroups = groups.filter((group) => group.isCloseCircle || group.name === "Friends");
  const otherGroups = groups.filter((group) => !group.isCloseCircle && group.name !== "Friends");
  // "All" (below) only makes sense with something to sweep across — counts
  // every non-empty circle app-wide (Core included), not just otherGroups,
  // since toggleAllExpanded itself acts on the full list.
  const nonEmptyGroupCount = groups.filter((group) => group.contacts.length > 0).length;

  const renderPill = (group: CircleGroup) => {
    const selected = expandedIds.has(group.id);
    return (
      <View key={group.id} style={styles.circleUnit}>
        <AdaptiveCircleChip
          label={group.name}
          isSelected={selected}
          labelBold={group.isCloseCircle}
          onPress={() => toggleExpanded(group)}
          accessibilityRole="button"
        />
        <DropdownArrowBadge
          expanded={selected}
          onPress={() => toggleExpanded(group)}
          accessibilityLabel={`${group.name}, ${selected ? "hide" : "show"} people`}
          style={styles.arrowButton}
        />
      </View>
    );
  };

  return (
    <Screen
      contentContainerStyle={styles.content}
      dockedInput={
        activeField === "new-circle-name" ? (
          <DockedInputBar
            value={newCircleName}
            onChangeText={setNewCircleName}
            onDone={() => setActiveField(null)}
            placeholder="Circle name, e.g. School friends"
            accessibilityLabel="New Circle name"
          />
        ) : null
      }
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerBody}>Create and amend your circles.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New Circle"
          onPress={() => void startCreating()}
          style={styles.newCircleButton}
        >
          <Ionicons name="add" size={22} color={colors.onPrimary} />
        </Pressable>
      </View>

      {coreGroups.length > 0 ? (
        <View style={styles.coreSection}>
          <Text style={styles.coreSectionHeading}>Core</Text>
          <Text style={styles.coreSectionCopy}>
            Your closest few, and the close friends around them, tend to form one connected group
            in how relationships naturally work.
          </Text>
          <CitationMarker researchSectionId="why-core-groups-close-and-friends" />
          <View style={styles.corePillRow}>{coreGroups.map(renderPill)}</View>
        </View>
      ) : null}

      {nonEmptyGroupCount >= 2 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
          <AdaptiveCircleChip label="All" isSelected={allExpanded} onPress={toggleAllExpanded} accessibilityRole="button" />
          {otherGroups.map(renderPill)}
        </ScrollView>
      ) : otherGroups.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
          {otherGroups.map(renderPill)}
        </ScrollView>
      ) : null}

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

          <View style={styles.sendAsGroupRow}>
            <View style={styles.sendAsGroupText}>
              <Text style={styles.sendAsGroupTitle}>Send as group</Text>
              <Text style={styles.sendAsGroupBody}>
                Off by default: everyone gets their own separate message. Turn on to send one
                shared message everyone in this Circle can see together instead.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Send as one shared group message instead of individually"
              value={newCircleSendAsGroup}
              onValueChange={setNewCircleSendAsGroup}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>

          <View style={styles.inputRow}>
            <DockedFieldPreview
              value={newCircleName}
              placeholder="Circle name, e.g. School friends"
              isActive={activeField === "new-circle-name"}
              onPress={() => setActiveField("new-circle-name")}
              accessibilityLabel="New Circle name"
              style={styles.flex1}
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
                  <View style={styles.emptyCircleRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Add from Contacts"
                      onPress={() => void addMemberToStaged(group.id)}
                      style={styles.addPill}
                    >
                      <Ionicons name="add" size={18} color={colors.primary} />
                    </Pressable>
                    <Text style={styles.empty}>Add contacts here.</Text>
                  </View>
                ) : (
                  <>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.memberPillRow}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Add from Contacts"
                        onPress={() => void addMemberToStaged(group.id)}
                        style={styles.addPill}
                      >
                        <Ionicons name="add" size={18} color={colors.primary} />
                      </Pressable>
                      {group.contacts.length >= 2 ? (
                        <AdaptiveCircleChip
                          label="All"
                          compact
                          isSelected={false}
                          onPress={() => toggleAllMembers(group)}
                          accessibilityRole="button"
                        />
                      ) : null}
                      {group.contacts.map((contact) => {
                        const included = !excluded.has(contact.id);
                        return (
                          <View key={contact.id} style={!included ? styles.memberPillDimmed : undefined}>
                            <AdaptiveCircleChip
                              label={contact.name}
                              compact
                              isSelected={false}
                              onPress={() => toggleMember(group.id, contact.id)}
                              accessibilityRole="checkbox"
                              accessibilityLabel={
                                included
                                  ? `${contact.name}, included. Tap to mark for removal.`
                                  : `${contact.name}, marked for removal. Tap to keep.`
                              }
                            />
                          </View>
                        );
                      })}
                      {additions.map((contact) => (
                        <View key={contact.phoneNumber} style={styles.newPillUnit}>
                          <AdaptiveCircleChip
                            label={contact.name}
                            compact
                            isSelected
                            onPress={() => removeStagedAddition(group.id, contact.phoneNumber)}
                            accessibilityRole="checkbox"
                            accessibilityLabel={`${contact.name}, new. Tap to remove before saving.`}
                          />
                          <Text style={styles.newTag}>New</Text>
                        </View>
                      ))}
                    </ScrollView>

                    {/* Per-contact sending-channel preference — its own
                        compact list, not on the pill itself (an avatar-style
                        chip has no room for a second line of text). Existing
                        members only; a still-staged addition has no
                        persisted contact.id to key this against yet. */}
                    <View style={styles.channelList}>
                      {group.contacts.map((contact) => (
                        <View key={contact.id} style={styles.channelRow}>
                          <Text
                            style={[styles.channelRowName, excluded.has(contact.id) && styles.memberNameExcluded]}
                          >
                            {contact.name}
                          </Text>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${contact.name}'s sending channel: ${CHANNEL_LABELS[contact.preferredChannel ?? "default"]}. Tap to change.`}
                            onPress={() => void cycleContactChannel(group.id, contact.id, contact.preferredChannel)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={styles.channelLabel}>
                              {CHANNEL_LABELS[contact.preferredChannel ?? "default"]}
                            </Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                <View style={styles.sendAsGroupRow}>
                  <View style={styles.sendAsGroupText}>
                    <Text style={styles.sendAsGroupTitle}>Send as group</Text>
                    <Text style={styles.sendAsGroupBody}>
                      Off by default: everyone gets their own separate message. Turn on to send
                      one shared message everyone in this Circle can see together instead.
                    </Text>
                  </View>
                  <Switch
                    accessibilityLabel={`Send as one shared group message instead of individually for ${group.name}`}
                    value={group.sendAsGroup ?? false}
                    onValueChange={(value) => void toggleGroupDelivery(group, value)}
                    trackColor={{ true: colors.primary, false: colors.border }}
                  />
                </View>

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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg
  },
  headerBody: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 26
  },
  newCircleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  circleUnit: {
    position: "relative",
    alignSelf: "flex-start"
  },
  arrowButton: {
    position: "absolute",
    right: 10,
    bottom: 12,
    alignItems: "center",
    justifyContent: "center"
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
  memberName: {
    flex: 1,
    color: colors.text,
    fontSize: 16
  },
  emptyCircleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  addPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  memberPillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs
  },
  memberPillDimmed: {
    opacity: 0.4
  },
  newPillUnit: {
    alignItems: "center",
    gap: 2
  },
  channelList: {
    gap: theme.spacing.xs
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 32
  },
  channelRowName: {
    flex: 1,
    color: colors.text,
    fontSize: 14
  },
  channelLabel: {
    color: colors.link,
    fontSize: 13,
    fontWeight: "600"
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
  sendAsGroupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md
  },
  sendAsGroupText: {
    flex: 1,
    gap: 2
  },
  sendAsGroupTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600"
  },
  sendAsGroupBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18
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
  flex1: {
    flex: 1
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
