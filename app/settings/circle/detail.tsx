import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { Screen } from "@/components/Screen";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { pickContact } from "@/services/contactPickerService";
import {
  addContactToGroup,
  deleteGroup,
  getGroup,
  removeContactFromGroup
} from "@/services/circleService";
import type { CircleGroup } from "@/types/hold";

export default function CircleDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const navigation = useNavigation();
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [group, setGroup] = useState<CircleGroup | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    setGroup(await getGroup(id));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useEffect(() => {
    if (group) navigation.setOptions({ title: group.name });
  }, [group, navigation]);

  const addFromContacts = async () => {
    if (!id) return;

    const picked = await pickContact();
    if (!picked) return;

    setGroup(await addContactToGroup(id, picked));
  };

  const removeContact = async (contactId: string) => {
    if (!id) return;
    setGroup(await removeContactFromGroup(id, contactId));
  };

  const removeGroup = () => {
    if (!id) return;

    Alert.alert("Delete this Circle?", "This removes the Circle and its saved contacts from this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteGroup(id).then(() => router.back());
        }
      }
    ]);
  };

  if (!group) return null;

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.label}>People in this Circle</Text>

        {group.contacts.length === 0 ? (
          <Text style={styles.empty}>No one added yet.</Text>
        ) : (
          <View style={styles.list}>
            {group.contacts.map((contact) => (
              <View key={contact.id} style={styles.item}>
                <View>
                  <Text style={styles.itemName}>{contact.name}</Text>
                  <Text style={styles.itemMeta}>{contact.phoneNumber}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${contact.name}`}
                  onPress={() => void removeContact(contact.id)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeLabel}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.note}>
          Adding someone opens your phone's own Contacts picker. Hold only ever sees the one
          person you pick (their name and phone number) and never asks for access to your
          full address book.
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Add from Contacts" onPress={() => void addFromContacts()} />
        {!group.isCloseCircle ? (
          <Pressable accessibilityRole="button" onPress={removeGroup} style={styles.deleteButton}>
            <Text style={styles.deleteLabel}>Delete Circle</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "space-between",
    gap: theme.spacing.xl
  },
  section: {
    gap: theme.spacing.md
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600"
  },
  empty: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24
  },
  list: {
    gap: theme.spacing.sm
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: theme.spacing.md
  },
  itemName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600"
  },
  itemMeta: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 2
  },
  removeButton: {
    minHeight: 44,
    justifyContent: "center"
  },
  removeLabel: {
    color: colors.error,
    fontSize: 14,
    fontWeight: "600"
  },
  note: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21
  },
  actions: {
    gap: theme.spacing.sm
  },
  deleteButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  deleteLabel: {
    color: colors.error,
    fontSize: 15,
    fontWeight: "600"
  }
  });
}
