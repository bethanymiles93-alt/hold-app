import { useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { theme } from "@/constants/theme";
import { HAS_SEEN_WELCOME_KEY } from "@/constants/storageKeys";
import { useHoldFlow } from "@/context/HoldFlowContext";
import { useSettingsDrawer } from "@/context/SettingsDrawerContext";
import { deleteAllCircles } from "@/services/circleService";
import { deleteAllConversations } from "@/services/conversationService";
import { deleteAllHoldHistory } from "@/services/holdHistoryService";
import { deleteAllReplies } from "@/services/replyStorageService";
import { deleteAllTemplates } from "@/services/templateService";
import { deleteAllDrafts } from "@/services/messageDraftService";

const FEEDBACK_EMAIL = "bethany.miles.93@gmail.com";
const PANEL_WIDTH = Math.min(320, Dimensions.get("window").width * 0.86);
const ANIMATION_MS = 260;

// theme.colors.error (#8B2E2E) blended toward theme.colors.text (#242825), reduced
// further than the prior #7C2D2D since that still read as brick-brown rather than red
// on-device. #A6342A pulls the blend back closer to the raw error hue while staying a
// little darker/calmer than it. If this still reads brown on an actual phone screen,
// #B3392E is a punchier alternative worth trying — eyeball both before calling it final.
const DESTRUCTIVE_LABEL_COLOR = "#A6342A";

function NavRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowChevron}>›</Text>
    </Pressable>
  );
}

function ActionRow({
  label,
  onPress,
  destructive
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
    </Pressable>
  );
}

function ComingLaterRow({ label }: { label: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabelMuted}>{label}</Text>
      <View style={styles.comingLaterTag}>
        <Text style={styles.comingLaterText}>Coming later</Text>
      </View>
    </View>
  );
}

export function SettingsDrawer() {
  const { isOpen, close } = useSettingsDrawer();
  const { resetFlow } = useHoldFlow();
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(PANEL_WIDTH)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: isOpen ? 0 : PANEL_WIDTH,
      duration: ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [isOpen, translateX]);

  const backdropOpacity = translateX.interpolate({
    inputRange: [0, PANEL_WIDTH],
    outputRange: [1, 0]
  });

  const goTo = (
    path: "/settings/mission" | "/settings/privacy" | "/settings/research" | "/settings/hold-plus" | "/settings/circle"
  ) => {
    close();
    router.push(path);
  };

  const shareApp = () => {
    close();
    void Share.share({ message: "Hold: a gentler way to go quiet and come back, without guilt." });
  };

  const giveFeedback = () => {
    close();
    void Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=Hold%20feedback`);
  };

  const deleteEverything = () => {
    close();
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
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        pointerEvents={isOpen ? "auto" : "none"}
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close settings"
          accessibilityElementsHidden={!isOpen}
          style={styles.backdropTouchable}
          onPress={close}
        />
      </Animated.View>
      <Animated.View style={[styles.panel, { width: PANEL_WIDTH, transform: [{ translateX }] }]}>
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + theme.spacing.lg,
              // Deliberately smaller than the top's added spacing (lg) — the
              // top gap has the status bar/Dynamic Island doing visual work,
              // so an equal numeric add reads as too much air at the bottom.
              // Raw literal (not a spacing token): tuned by eye between
              // sm (10, still too big) and xs (6, likely too small).
              paddingBottom: insets.bottom + 8,
              paddingRight: insets.right + theme.spacing.lg
            }
          ]}
        >
          <View style={styles.group}>
            <NavRow label="Manage Circles" onPress={() => goTo("/settings/circle")} />
            <ComingLaterRow label="Notifications" />
            <ComingLaterRow label="Language" />
            <ComingLaterRow label="Connected Accounts" />
          </View>

          <View style={[styles.group, styles.groupSpaced]}>
            <NavRow label="Our Mission" onPress={() => goTo("/settings/mission")} />
            <NavRow label="Research" onPress={() => goTo("/settings/research")} />
            <NavRow label="Hold+" onPress={() => goTo("/settings/hold-plus")} />
          </View>

          <View style={styles.bottomCluster}>
            <View style={styles.group}>
              <ActionRow label="Feedback" onPress={giveFeedback} />
              <ActionRow label="Share Hold" onPress={shareApp} />
            </View>

            <View style={[styles.group, styles.groupWithDivider]}>
              <NavRow label="Privacy Policy" onPress={() => goTo("/settings/privacy")} />
              <ComingLaterRow label="Terms" />
              <ActionRow label="Delete my data" onPress={deleteEverything} destructive />
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "flex-end",
    zIndex: 50
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)"
  },
  backdropTouchable: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  panel: {
    backgroundColor: theme.colors.background,
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12
  },
  // paddingTop/paddingBottom/paddingRight are applied inline (insets.top/
  // bottom/right + a fixed amount) since this drawer is a standalone
  // overlay rather than an in-flow screen — explicit useSafeAreaInsets()
  // math, not SafeAreaView's edges prop, so the gaps beyond the device's
  // safe area are deliberate and consistent regardless of notch/home-
  // indicator height differences.
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg
  },
  group: {
    gap: theme.spacing.xs
  },
  // Clearly bigger than a group's own row-to-row gap (xs), so groups read as
  // distinct sections rather than one continuous list. Used above About Hold
  // and above Legal and data — both the "small" group gap.
  groupSpaced: {
    marginTop: theme.spacing.xl
  },
  // The single largest gap in the drawer, above the bottom cluster only —
  // separates the daily-use groups (Manage Circles, Our Mission) from the
  // occasional-use cluster (Feedback/Share + Legal and data) below.
  // Pinned to the bottom of the drawer via the flexible auto margin (content
  // is flex: 1), rather than a fixed distance from Our Mission above it —
  // this whole cluster sits the same distance from the bottom edge as
  // Manage Circles is from the top. Feedback/Share and Legal and data move
  // as one block so Feedback/Share reads as belonging with the bottom
  // cluster rather than floating alone in the gap.
  bottomCluster: {
    marginTop: "auto"
  },
  // marginTop (space above the line) matches paddingTop (space below it,
  // before Privacy Policy) so the divider sits centred between Share Hold
  // and Privacy Policy rather than closer to one side.
  groupWithDivider: {
    marginTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 36
  },
  rowPressed: {
    opacity: 0.6
  },
  rowLabel: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600"
  },
  rowLabelDestructive: {
    color: DESTRUCTIVE_LABEL_COLOR
  },
  rowLabelMuted: {
    color: theme.colors.textMuted,
    fontSize: 16,
    fontWeight: "600"
  },
  rowChevron: {
    color: theme.colors.textMuted,
    fontSize: 18
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
