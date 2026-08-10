import { useMemo } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { DockedFieldPreview } from "@/components/DockedFieldPreview";
import { connectEmailAccount, createEmailAccountId } from "@/services/emailAccountService";
import type { EmailAccount, EmailProvider } from "@/types/hold";

interface EmailOutOfOfficeProps {
  enabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  accounts: EmailAccount[];
  onAccountsChange: (accounts: EmailAccount[]) => void;
  useSameMessage: boolean;
  onToggleUseSameMessage: (value: boolean) => void;
  sharedMessage: string;
  onChangeSharedMessage: (message: string) => void;
  /** Field-key namespace owned by the parent screen — see docs/09-decision-log.md, 2026-08-10. Keys used here: "ooo-shared", `ooo-account-message:${id}`, `ooo-account-label:${id}`. */
  activeField: string | null;
  onActivateField: (key: string) => void;
}

export function EmailOutOfOffice({
  enabled,
  onToggleEnabled,
  accounts,
  onAccountsChange,
  useSameMessage,
  onToggleUseSameMessage,
  sharedMessage,
  onChangeSharedMessage,
  activeField,
  onActivateField
}: EmailOutOfOfficeProps) {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const connect = async (provider: EmailProvider, isWork: boolean) => {
    const result = await connectEmailAccount(provider, isWork);

    if (!result.ok) {
      Alert.alert(
        "Can’t connect this account",
        "Many workplaces block third-party apps from connecting to work email. Try adding a personal email instead."
      );
      return;
    }

    const defaultLabel = provider === "gmail" ? "Gmail" : "Outlook";

    Alert.prompt(
      "Label this account",
      "e.g. Work, Personal",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Add",
          onPress: (label?: string) => {
            const account: EmailAccount = {
              id: createEmailAccountId(),
              label: label?.trim() || defaultLabel,
              provider,
              message: "",
              enabled: true
            };
            onAccountsChange([...accounts, account]);
          }
        }
      ],
      "plain-text",
      defaultLabel
    );
  };

  const chooseType = (provider: EmailProvider) => {
    Alert.alert("Account type", "Is this a personal or work account?", [
      { text: "Personal", onPress: () => void connect(provider, false) },
      { text: "Work", onPress: () => void connect(provider, true) },
      { text: "Cancel", style: "cancel" }
    ]);
  };

  const addAccount = () => {
    Alert.alert("Add an email account", "Choose a provider", [
      { text: "Gmail", onPress: () => chooseType("gmail") },
      { text: "Outlook", onPress: () => chooseType("outlook") },
      { text: "Cancel", style: "cancel" }
    ]);
  };

  const removeAccount = (id: string) => {
    onAccountsChange(accounts.filter((account) => account.id !== id));
  };

  const updateAccount = (id: string, patch: Partial<EmailAccount>) => {
    onAccountsChange(
      accounts.map((account) => (account.id === id ? { ...account, ...patch } : account))
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Email out-of-office</Text>
          <Text style={styles.subtext}>
            {enabled
              ? "Preview: account connection is mocked for now, so nothing is sent automatically yet."
              : "Automatically let email senders know you’re away."}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Enable email out-of-office"
          value={enabled}
          onValueChange={onToggleEnabled}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>

      {enabled ? (
        <View style={styles.body}>
          <View style={styles.sameMessageRow}>
            <Text style={styles.sameMessageLabel}>Use the same message for all accounts</Text>
            <Switch
              accessibilityLabel="Use the same message for all accounts"
              value={useSameMessage}
              onValueChange={onToggleUseSameMessage}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>

          {useSameMessage ? (
            <DockedFieldPreview
              value={sharedMessage}
              placeholder="Out-of-office message"
              isActive={activeField === "ooo-shared"}
              onPress={() => onActivateField("ooo-shared")}
              accessibilityLabel="Out-of-office message"
            />
          ) : null}

          {accounts.length === 0 ? (
            <Text style={styles.empty}>No accounts connected yet.</Text>
          ) : (
            <View style={styles.accountList}>
              {accounts.map((account) => (
                <View key={account.id} style={styles.accountRow}>
                  <View style={styles.accountTopRow}>
                    <DockedFieldPreview
                      value={account.label}
                      placeholder="Account label"
                      isActive={activeField === `ooo-account-label:${account.id}`}
                      onPress={() => onActivateField(`ooo-account-label:${account.id}`)}
                      style={styles.flex1}
                    />
                    <Switch
                      accessibilityLabel={`Enable out-of-office for ${account.label}`}
                      value={account.enabled}
                      onValueChange={(value) => updateAccount(account.id, { enabled: value })}
                      trackColor={{ true: colors.primary, false: colors.border }}
                    />
                  </View>

                  {!useSameMessage ? (
                    <DockedFieldPreview
                      value={account.message}
                      placeholder={`Message for ${account.label}`}
                      isActive={activeField === `ooo-account-message:${account.id}`}
                      onPress={() => onActivateField(`ooo-account-message:${account.id}`)}
                    />
                  ) : null}

                  <Pressable accessibilityRole="button" onPress={() => removeAccount(account.id)}>
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={addAccount}
            style={({ pressed }) => [styles.addPill, pressed && styles.addPillPressed]}
          >
            <Text style={styles.addPillText}>+ Add account</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: theme.spacing.md
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md
    },
    headerText: {
      flex: 1,
      gap: 4
    },
    title: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "600"
    },
    subtext: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20
    },
    body: {
      gap: theme.spacing.md
    },
    sameMessageRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md
    },
    sameMessageLabel: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: "500"
    },
    empty: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21
    },
    accountList: {
      gap: theme.spacing.md
    },
    accountRow: {
      gap: theme.spacing.xs,
      borderRadius: theme.radius.sm,
      backgroundColor: colors.surface,
      padding: theme.spacing.sm
    },
    accountTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm
    },
    flex1: {
      flex: 1
    },
    remove: {
      color: colors.error,
      fontSize: 13,
      fontWeight: "600",
      alignSelf: "flex-start"
    },
    addPill: {
      alignSelf: "flex-start",
      minHeight: 38,
      borderRadius: theme.radius.pill,
      borderWidth: 1.5,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.md
    },
    addPillPressed: {
      backgroundColor: colors.surface
    },
    addPillText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "600"
    }
  });
}
