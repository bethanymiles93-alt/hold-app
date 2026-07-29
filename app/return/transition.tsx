import { useMemo } from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { HoldMark } from "@/components/HoldMark";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

export default function ReconnectTransitionScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const goToReconnect = () => {
    router.replace("/return/reconnect");
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.message}>
        <HoldMark size={92} />
        <Text style={styles.title}>Welcome back.</Text>
        <Text style={styles.subtitle}>
          Here’s who’s waiting to hear from you. Reply however feels right today.
        </Text>
      </View>

      <PrimaryButton label="Continue" onPress={goToReconnect} />
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      justifyContent: "space-between",
      paddingTop: 88
    },
    message: {
      alignItems: "center",
      gap: theme.spacing.md
    },
    title: {
      color: colors.text,
      fontSize: 22,
      lineHeight: 28,
      textAlign: "center",
      fontWeight: "600"
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 17,
      lineHeight: 25,
      textAlign: "center",
      maxWidth: 300
    }
  });
}
