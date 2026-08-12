import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  getDefaultSendingChannel,
  setDefaultSendingChannel,
  type SendingChannel
} from "@/services/sendingPreferencesService";

const OPTIONS: { value: SendingChannel; title: string; body: string }[] = [
  {
    value: "sms",
    title: "Text message",
    body: "Individual sends go out one native compose sheet per person. A Circle set to \"send as group\" uses a real multi-recipient text thread."
  },
  {
    value: "whatsapp",
    title: "WhatsApp",
    body: "Individual sends open a pre-filled WhatsApp conversation per person. A Circle set to \"send as group\" opens the share sheet, where picking WhatsApp lets you choose an existing group there — WhatsApp can't be deep-linked into a group directly."
  }
];

export default function SendingChannelScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [channel, setChannel] = useState<SendingChannel>("sms");

  useFocusEffect(
    useCallback(() => {
      void getDefaultSendingChannel().then(setChannel);
    }, [])
  );

  const choose = (value: SendingChannel) => {
    setChannel(value);
    void setDefaultSendingChannel(value);
  };

  return (
    <Screen>
      <Text style={styles.intro}>
        Which channel individual/BCC-style sends use by default, in Going Quiet and Reconnect. A
        Circle's own "send as group" setting (in Manage Circles, or when creating a Circle) is
        unaffected — it still always sends as one shared message, just through whichever channel
        is chosen here.
      </Text>

      <View style={styles.options}>
        {OPTIONS.map((option) => {
          const selected = channel === option.value;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option.title}
              onPress={() => choose(option.value)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <View style={[styles.radio, selected && styles.radioSelected]} />
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionBody}>{option.body}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    intro: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22
    },
    options: {
      marginTop: theme.spacing.xl,
      gap: theme.spacing.md
    },
    option: {
      flexDirection: "row",
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface
    },
    optionSelected: {
      borderColor: colors.primary
    },
    radio: {
      marginTop: 2,
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.border
    },
    radioSelected: {
      borderColor: colors.primary,
      borderWidth: 6
    },
    optionText: {
      flex: 1,
      gap: 2
    },
    optionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600"
    },
    optionBody: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20
    }
  });
}
