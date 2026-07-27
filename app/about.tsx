import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Linking, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { theme } from "@/constants/theme";
import { HAS_SEEN_WELCOME_KEY } from "@/constants/storageKeys";
import { useHoldFlow } from "@/context/HoldFlowContext";
import { deleteAllCircles } from "@/services/circleService";
import { deleteAllConversations } from "@/services/conversationService";
import { deleteAllHoldHistory } from "@/services/holdHistoryService";
import { deleteAllReplies } from "@/services/replyStorageService";
import { deleteAllTemplates } from "@/services/templateService";
import { deleteAllDrafts } from "@/services/messageDraftService";

// TODO: temporary placeholder inbox — replace with a dedicated feedback address.
const FEEDBACK_EMAIL = "bethany.miles.93@gmail.com";

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

function ActionRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
    >
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionChevron}>›</Text>
    </Pressable>
  );
}

function PlaceholderRow({ label }: { label: string }) {
  return (
    <View style={styles.actionRow}>
      <Text style={styles.placeholderLabel}>{label}</Text>
      <View style={styles.comingLaterTag}>
        <Text style={styles.comingLaterText}>Coming later</Text>
      </View>
    </View>
  );
}

export default function AboutScreen() {
  const { resetFlow } = useHoldFlow();

  const shareApp = async () => {
    await Share.share({
      message: "Hold: a gentler way to go quiet and come back, without guilt."
    });
  };

  const giveFeedback = () => {
    void Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=Hold%20feedback`);
  };

  const deleteEverything = () => {
    Alert.alert(
      "Delete everything on this device?",
      "This removes every saved Circle, Hold history entry, in-progress reply, Conversations list, and saved template. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              await Promise.all([
                deleteAllCircles(),
                deleteAllHoldHistory(),
                deleteAllReplies(),
                deleteAllConversations(),
                deleteAllTemplates(),
                deleteAllDrafts(),
                AsyncStorage.removeItem(HAS_SEEN_WELCOME_KEY)
              ]);
              resetFlow("hold");
              router.replace("/");
            })();
          }
        }
      ]
    );
  };

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

      <View style={styles.actions}>
        <ActionRow label="Share the app" onPress={() => void shareApp()} />
        <ActionRow label="Give feedback" onPress={giveFeedback} />
      </View>

      <Text style={styles.subheading}>Privacy</Text>
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

      <Text style={styles.subheading}>App Settings</Text>
      <View style={styles.actions}>
        <PlaceholderRow label="Pause" />
        <ActionRow label="Delete" onPress={deleteEverything} />
        <PlaceholderRow label="Language" />
        <PlaceholderRow label="Notifications" />
      </View>

      <Text style={styles.subheading}>Terms and Conditions</Text>
      <View style={styles.actions}>
        <PlaceholderRow label="Terms and Conditions" />
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
  subheading: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "600",
    marginTop: theme.spacing.lg,
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
  },
  actions: {
    marginTop: theme.spacing.xl,
    gap: theme.spacing.sm
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 54,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md
  },
  actionRowPressed: {
    backgroundColor: theme.colors.surface
  },
  actionLabel: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600"
  },
  actionChevron: {
    color: theme.colors.textMuted,
    fontSize: 20
  },
  placeholderLabel: {
    color: theme.colors.textMuted,
    fontSize: 16,
    fontWeight: "600"
  },
  comingLaterTag: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceStrong,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4
  },
  comingLaterText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  }
});
