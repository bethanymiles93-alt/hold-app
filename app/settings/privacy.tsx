import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";

const PRIVACY_SECTIONS = [
  {
    title: "You choose what is shared",
    body: "Hold shows you the full message and opens your device’s sharing options. The MVP does not message anyone automatically."
  },
  {
    title: "No bulk address-book access",
    body: "Hold never requests ongoing access to your contacts. Adding someone to a saved Circle opens your phone’s own Contacts picker, one person at a time. Hold only ever sees the one you pick."
  },
  {
    title: "No live AI in this build",
    body: "Drafts are created from local templates. A future AI feature must remain optional and will require a separate privacy review."
  },
  {
    title: "One narrow exception for Thoughtful reply",
    body: "If you draft a reply to a specific message, it’s kept in encrypted device storage only until you mark it sent or its time window passes, then it’s cleared automatically. Nothing else in Hold is saved this way."
  },
  {
    title: "Your Hold history is kept until you delete it",
    body: "Settings keeps a plain record of past Hold periods in encrypted device storage: who you told, when it started, when it ended. Hold draws no conclusions from it. You can delete any entry yourself."
  },
  {
    title: "Your Circle stores real names and numbers, on purpose",
    body: "People you add to a saved Circle are kept (real name and phone number, from your Contacts picker choice) in encrypted device storage until you remove them, so Hold can text that Circle directly. This is more sensitive than anything else Hold stores, and it doesn’t go live publicly without a dedicated privacy review of its own."
  },
  {
    title: "Not emergency support",
    body: "Hold is a communication aid. It is not medical care, therapy or an emergency service."
  }
];

export default function PrivacyScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Screen>
      <Text style={styles.heading}>Privacy.</Text>
      <Text style={styles.intro}>
        Privacy is part of emotional safety. The first MVP deliberately collects very little.
      </Text>

      <View style={styles.sections}>
        {PRIVACY_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.title}>{section.title}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    heading: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "600",
      marginBottom: theme.spacing.md
    },
    intro: {
      color: colors.textMuted,
      fontSize: 17,
      lineHeight: 26
    },
    sections: {
      marginTop: theme.spacing.xl,
      gap: theme.spacing.md
    },
    section: {
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: colors.surface,
      gap: theme.spacing.sm
    },
    title: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "600"
    },
    body: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 23
    }
  });
}
