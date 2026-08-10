import { useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  SAFEGUARDING_GROUNDING_PROMPT_PLACEHOLDER,
  SAFEGUARDING_NOTIFY_MESSAGE_PLACEHOLDER,
  SAFEGUARDING_RESOURCES
} from "@/constants/copy";
import { getGroups } from "@/services/circleService";
import { sendOrShare } from "@/services/smsService";

interface SafeguardingBannerProps {
  visible: boolean;
}

/**
 * Non-blocking, persistent — shown above a message box once
 * useSafeguardingCheck triggers, never a full-screen block. Drafting stays
 * available throughout; this doesn't dismiss itself. See hold-book's
 * 06-privacy-security/03-safeguarding.md, 2026-08-10 decision. Only ever
 * rendered from a __DEV__-gated trigger — see safeguardingService.ts.
 */
export function SafeguardingBanner({ visible }: SafeguardingBannerProps) {
  const { colors } = useAppTheme("normal");
  const styles = createStyles(colors);
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);

  if (!visible) return null;

  const openResource = (resource: (typeof SAFEGUARDING_RESOURCES)[number]) => {
    const url =
      resource.action.type === "tel"
        ? `tel:${resource.action.value}`
        : `sms:${resource.action.value}${
            resource.action.body ? `&body=${encodeURIComponent(resource.action.body)}` : ""
          }`;
    void Linking.openURL(url);
  };

  const notifyCloseCircle = async () => {
    setNotifying(true);
    try {
      const groups = await getGroups();
      const numbers = (groups[0]?.contacts ?? []).map((contact) => contact.phoneNumber);
      if (numbers.length === 0) return;

      try {
        await sendOrShare(numbers, SAFEGUARDING_NOTIFY_MESSAGE_PLACEHOLDER);
      } catch {
        // The compose sheet closing is the only signal available either way — same pattern as elsewhere.
      }
      setNotified(true);
    } finally {
      setNotifying(false);
    }
  };

  const confirmNotify = () => {
    Alert.alert("Notify your Close Circle?", "Sends a message now, letting them know you need support.", [
      { text: "Cancel", style: "cancel" },
      { text: "Send", onPress: () => void notifyCloseCircle() }
    ]);
  };

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.title}>If things feel unsafe right now</Text>

      {SAFEGUARDING_RESOURCES.map((resource) => (
        <Pressable
          key={resource.id}
          accessibilityRole="button"
          onPress={() => openResource(resource)}
          style={styles.resourceRow}
        >
          <Text style={styles.resourceLabel}>{resource.label}</Text>
          <Text style={styles.resourceDetail}>{resource.detail}</Text>
        </Pressable>
      ))}

      <Text style={styles.grounding}>{SAFEGUARDING_GROUNDING_PROMPT_PLACEHOLDER}</Text>

      {notified ? (
        <Text style={styles.notifiedText}>Sent to your Close Circle.</Text>
      ) : (
        <Pressable accessibilityRole="button" disabled={notifying} onPress={confirmNotify}>
          <Text style={styles.notifyText}>Notify someone from your Close Circle now</Text>
        </Pressable>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    banner: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: colors.error,
      backgroundColor: colors.surfaceStrong
    },
    title: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700"
    },
    resourceRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: theme.spacing.xs,
      minHeight: 32
    },
    resourceLabel: {
      color: colors.link,
      fontSize: 14,
      fontWeight: "700"
    },
    resourceDetail: {
      color: colors.textMuted,
      fontSize: 13,
      flexShrink: 1
    },
    grounding: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
      fontStyle: "italic"
    },
    notifyText: {
      color: colors.link,
      fontSize: 14,
      fontWeight: "600"
    },
    notifiedText: {
      color: colors.textMuted,
      fontSize: 14
    }
  });
}
