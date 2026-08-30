import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/Screen";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { pickContact } from "@/services/contactPickerService";
import { addPerson, getAll } from "@/services/conversationService";
import { saveReply } from "@/services/replyStorageService";
import { CONVERSATIONS_REPLY_RETENTION_DAYS } from "@/constants/copy";

/**
 * Landing route for the Share Extension's handoff (ShareExtension.tsx's
 * own openHostApp call) — `hold:///shared-text?text=...`. Not reachable
 * any other way; there's no in-app link to this route. Picks the contact
 * this message is from (there's no way for iOS to tell us that — a share
 * extension only ever gets the message content, never who sent it), seeds
 * their Conversations entry with it, and lands on Library ready to reply.
 * Mirrors "+ Add person"'s own addPerson call exactly, so a shared-in
 * message and a manually-added person end up in an identical state. See
 * docs/09-decision-log.md, 2026-08-30.
 */
export default function SharedTextScreen() {
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { text } = useLocalSearchParams<{ text?: string }>();
  const handledRef = useRef(false);
  const [status, setStatus] = useState<"working" | "no-contact">("working");

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    void (async () => {
      // expo-share-extension's native openHostApp (plugin/swift/
      // ShareExtensionViewController.swift) rebuilds the URL via
      // URLComponents, which re-percent-encodes whatever raw substring it
      // extracted from the query string — since ShareExtension.tsx already
      // encodeURIComponent's the text before calling openHostApp, that
      // value gets encoded a second time on the native side (confirmed by
      // tracing the Swift source directly, and by round-tripping a
      // deliberately double-encoded URL via `xcrun simctl openurl` — not
      // yet confirmed against the real extension's own live output, since
      // driving the interactive share sheet itself isn't possible in this
      // environment). One extra decode here undoes that second layer.
      const sharedMessage = text ? decodeURIComponent(text).trim() : "";
      if (!sharedMessage) {
        router.replace("/(tabs)/library");
        return;
      }

      const picked = await pickContact();
      if (!picked) {
        setStatus("no-contact");
        return;
      }

      await addPerson({ name: picked.name, phoneNumber: picked.phoneNumber });
      const people = await getAll();
      const person = people.find((candidate) => candidate.phoneNumber === picked.phoneNumber);

      if (person) {
        const now = Date.now();
        const expiresAt = now + CONVERSATIONS_REPLY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
        await saveReply({
          id: person.id,
          recipientName: person.name,
          friendMessage: sharedMessage,
          friendMessageExpiresAt: expiresAt,
          draftReply: "",
          draftReplyExpiresAt: expiresAt,
          createdAt: now
        });
      }

      router.replace({ pathname: "/(tabs)/library", params: { tab: "conversations" } });
    })();
  }, [text]);

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.center}>
        {status === "working" ? (
          <>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.body}>Who sent this?</Text>
          </>
        ) : (
          <Text style={styles.body}>No contact picked — nothing was added.</Text>
        )}
      </View>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      flexGrow: 1,
      justifyContent: "center"
    },
    center: {
      alignItems: "center",
      gap: theme.spacing.md
    },
    body: {
      color: colors.textMuted,
      fontSize: 16,
      textAlign: "center"
    }
  });
}
