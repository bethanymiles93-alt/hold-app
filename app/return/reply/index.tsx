import { useCallback, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Screen } from "@/components/Screen";
import { StepHeader } from "@/components/StepHeader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { theme } from "@/constants/theme";
import { endOpenHoldPeriod } from "@/services/holdHistoryService";
import { deleteReply, getActiveReplies } from "@/services/replyStorageService";
import type { StoredReply } from "@/types/hold";

function formatTimeRemaining(expiresAt: number, now: number): string {
  const minutes = Math.max(0, Math.round((expiresAt - now) / 60000));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m left`;
  return mins === 0 ? `${hours}h left` : `${hours}h ${mins}m left`;
}

export default function ReplyQueueScreen() {
  const [replies, setReplies] = useState<StoredReply[]>([]);
  const [clearedNotice, setClearedNotice] = useState(false);

  const refresh = useCallback(async () => {
    const { active, justExpiredIds } = await getActiveReplies(Date.now());
    setReplies(active);
    if (justExpiredIds.length > 0) {
      setClearedNotice(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();

      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          void refresh();
        }
      });

      return () => subscription.remove();
    }, [refresh])
  );

  const markSent = async (id: string) => {
    await deleteReply(id);
    await endOpenHoldPeriod();
    setReplies((current) => current.filter((reply) => reply.id !== id));
    setClearedNotice(true);
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View>
        <StepHeader
          eyebrow="Thoughtful reply"
          title="Replies in progress"
          body="Each one stays on this device only until you send it or its window closes."
        />

        {clearedNotice ? (
          <Text style={styles.notice}>Cleared from your device.</Text>
        ) : null}

        {replies.length === 0 ? (
          <Text style={styles.empty}>
            Nothing waiting right now. Add a reply when you’re ready.
          </Text>
        ) : (
          <View style={styles.list}>
            {replies.map((reply) => (
              <View key={reply.id} style={styles.item}>
                <Text style={styles.itemName}>{reply.recipientName}</Text>
                <Text style={styles.itemPreview} numberOfLines={2}>
                  {reply.draftReply || "Not written yet"}
                </Text>
                <Text style={styles.itemMeta}>
                  {formatTimeRemaining(reply.expiresAt, Date.now())}
                </Text>
                <View style={styles.itemActions}>
                  <SecondaryButton
                    label="Open"
                    onPress={() =>
                      router.push({
                        pathname: "/return/reply/edit",
                        params: { id: reply.id }
                      })
                    }
                  />
                  <SecondaryButton
                    label="Mark as sent"
                    onPress={() => void markSent(reply.id)}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <PrimaryButton
        label="Add a reply"
        onPress={() => router.push("/return/reply/edit")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: "space-between",
    gap: theme.spacing.xl
  },
  notice: {
    color: theme.colors.link,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: theme.spacing.md
  },
  empty: {
    color: theme.colors.textMuted,
    fontSize: 16,
    lineHeight: 24
  },
  list: {
    gap: theme.spacing.md
  },
  item: {
    gap: theme.spacing.xs,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: theme.spacing.md
  },
  itemName: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "600"
  },
  itemPreview: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22
  },
  itemMeta: {
    color: theme.colors.link,
    fontSize: 13,
    fontWeight: "600"
  },
  itemActions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs
  }
});
