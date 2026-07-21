import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { theme } from "@/constants/theme";

const sections = [
  {
    title: "You choose what is shared",
    body: "Hold shows you the full message and opens your device’s sharing options. The MVP does not message anyone automatically."
  },
  {
    title: "No address-book upload",
    body: "The MVP asks you to enter names manually. It does not request or upload your contact list."
  },
  {
    title: "No live AI in this build",
    body: "Drafts are created from local templates. A future AI feature must remain optional and will require a separate privacy review."
  },
  {
    title: "Not emergency support",
    body: "Hold is a communication aid. It is not medical care, therapy or an emergency service."
  }
];

export default function PrivacyScreen() {
  return (
    <Screen>
      <Text style={styles.heading}>Clear by design.</Text>
      <Text style={styles.intro}>
        Privacy is part of emotional safety. The first MVP deliberately collects very little.
      </Text>

      <View style={styles.sections}>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.title}>{section.title}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: "600",
    marginBottom: theme.spacing.md
  },
  intro: {
    color: theme.colors.textMuted,
    fontSize: 18,
    lineHeight: 28
  },
  sections: {
    marginTop: theme.spacing.xl,
    gap: theme.spacing.md
  },
  section: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.sm
  },
  title: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "600"
  },
  body: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 23
  }
});
