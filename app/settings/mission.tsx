import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { theme } from "@/constants/theme";

const MISSION_SECTIONS = [
  {
    title: "Silence shouldn't mean guilt",
    body: "Going quiet to protect your own capacity often comes with guilt, like you owe everyone an explanation just for needing space. Hold lets you say what's true without carrying that weight."
  },
  {
    title: "It protects both sides",
    body: "The people you go quiet on can be affected too, left wondering what happened. Hold gives you an easy way to tell them something honest, so the relationship isn't just left in silence."
  },
  {
    title: "No one has to guess",
    body: "When someone goes quiet without a word, people fill the gap themselves, often with the wrong story. A short, honest message means the people who matter don't have to guess who you are based on your silence."
  }
];

export default function MissionScreen() {
  return (
    <Screen>
      <Text style={styles.heading}>Why Hold exists.</Text>
      <Text style={styles.intro}>
        Going quiet shouldn’t mean guilt, damaged relationships, or people assuming the worst
        about you. Hold exists to make a brief, honest word possible when you have nothing more
        to give.
      </Text>

      <View style={styles.sections}>
        {MISSION_SECTIONS.map((section) => (
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
    fontSize: 22,
    fontWeight: "600",
    marginBottom: theme.spacing.md
  },
  intro: {
    color: theme.colors.textMuted,
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
