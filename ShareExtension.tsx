import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { close, openHostApp, Text } from "expo-share-extension";
import type { InitialProps } from "expo-share-extension";

/**
 * Root component of the share extension's own separate bundle (registered
 * via index.share.js, a completely different JS entry point from the main
 * app — this never renders inside Hold's own navigator/theme/context tree,
 * since an iOS share extension is a genuinely separate process/sandbox
 * from the host app). Deliberately minimal, plain-styled rather than
 * pulling in useAppTheme/ThemeProvider — those depend on app-wide context
 * (HoldFlowContext etc.) this standalone bundle never mounts.
 *
 * Text-only, per hold-book's confirmed scope (04-navigation-architecture.md,
 * "Share to Hold": manual share-extension only) — the "text" initial prop
 * is what iOS hands over when someone shares a WhatsApp/iMessage/Instagram
 * message's contents, or selected text from any app. See
 * docs/09-decision-log.md, 2026-08-30.
 */
export default function ShareExtension({ text }: InitialProps) {
  const [handedOff, setHandedOff] = useState(false);
  const sharedText = text?.trim() ?? "";

  const addToHold = () => {
    setHandedOff(true);
    openHostApp(`shared-text?text=${encodeURIComponent(sharedText)}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.dot} />
      <Text allowFontScaling={false} style={styles.title}>
        Add to Hold
      </Text>
      {sharedText ? (
        <Text allowFontScaling={false} style={styles.preview} numberOfLines={4}>
          {sharedText}
        </Text>
      ) : (
        <Text allowFontScaling={false} style={styles.preview}>
          No text found in what was shared.
        </Text>
      )}

      {handedOff ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={!sharedText}
            onPress={addToHold}
            style={[styles.primaryButton, !sharedText && styles.disabled]}
          >
            <Text allowFontScaling={false} style={styles.primaryButtonText}>
              Add to Conversations
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={close} style={styles.cancelButton}>
            <Text allowFontScaling={false} style={styles.cancelButtonText}>
              Cancel
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2f3b31",
    padding: 20,
    gap: 12,
    alignItems: "center"
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#8fae8f",
    marginTop: 8
  },
  title: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600"
  },
  preview: {
    color: "#d7ddd6",
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center"
  },
  actions: {
    width: "100%",
    gap: 10,
    marginTop: 8
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: "#8fae8f",
    alignItems: "center",
    justifyContent: "center"
  },
  disabled: {
    opacity: 0.4
  },
  primaryButtonText: {
    color: "#1c231d",
    fontSize: 15,
    fontWeight: "600"
  },
  cancelButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  cancelButtonText: {
    color: "#d7ddd6",
    fontSize: 14,
    fontWeight: "500"
  }
});
