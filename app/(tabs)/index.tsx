import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HoldMark } from "@/components/HoldMark";
import { HeldMark } from "@/components/HeldMark";
import { NavPill } from "@/components/NavPill";
import { SecondaryButton } from "@/components/SecondaryButton";
import { HeaderSettingsButton } from "@/components/HeaderSettingsButton";
import { theme } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useHoldFlow } from "@/context/HoldFlowContext";
import { addToAudience, endOpenHoldPeriod, getOpenHoldPeriod } from "@/services/holdHistoryService";
import {
  completeAll,
  getProgress as getConversationProgress,
  seedFromAudience
} from "@/services/conversationService";
import { formatShortDate, isSameCalendarDay } from "@/services/holdHistoryFormat";
import { pickContact } from "@/services/contactPickerService";
import { sendOrShare } from "@/services/smsService";
import { ADD_TO_GOING_QUIET_MESSAGE } from "@/constants/copy";
import { HAS_SEEN_WELCOME_KEY } from "@/constants/storageKeys";
import type { HoldPeriod } from "@/types/hold";

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);

export const LARGE_CIRCLE_SIZE = 240;
export const QUIET_CIRCLE_SCALE = 0.75;

// Tap transitions are quick and purely physical (scale only) — the emotional
// colour shift lives on the resting screen instead, see the palette fade below.
const TAP_DURATION = 280;
const NAVIGATE_TRIGGER_MS = Math.round(TAP_DURATION * 0.8);

// Reconnect is the one moment that should feel actively alive: the circle grows
// back out alongside a one-shot ripple that widens and fades, like an exhale.
// Taking Time itself stays fully static — genuinely restful, not quiet-but-animating.
const RECONNECT_RIPPLE_DURATION = 480;

// Palette fade: a separate, slower, decoupled transition between the normal and
// quiet colour palettes, triggered on focus rather than tied to the tap.
const PALETTE_FADE_MS = 1200;

// Taking Time breathing: once settled, an extremely subtle, slow scale cycle —
// no pulse, no glow, no obvious rhythm. Layered as its own transform on top of
// the settled QUIET_CIRCLE_SCALE rather than folded into scaleAnim, so it never
// interferes with the discrete tap/reconnect scale transitions.
const BREATHE_MIN_SCALE = 0.98;
const BREATHE_HALF_CYCLE_MS = 4000;

type HomeState = "loading" | "normal" | "taking-time" | "post-reconnect";

interface PostReconnectProgress {
  done: number;
  total: number;
}

export default function HomeScreen() {
  const { resetFlow, setAudience } = useHoldFlow();
  const normalTheme = useAppTheme("normal");
  const quietTheme = useAppTheme("quiet");
  const [openPeriod, setOpenPeriod] = useState<HoldPeriod | null>(null);
  const [homeState, setHomeState] = useState<HomeState>("loading");
  const [postReconnectProgress, setPostReconnectProgress] = useState<PostReconnectProgress | null>(
    null
  );
  const [isAnimating, setIsAnimating] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const paletteAnim = useRef(new Animated.Value(0)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (homeState === "taking-time" && !reduceMotion) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breatheAnim, {
            toValue: BREATHE_MIN_SCALE,
            duration: BREATHE_HALF_CYCLE_MS,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true
          }),
          Animated.timing(breatheAnim, {
            toValue: 1,
            duration: BREATHE_HALF_CYCLE_MS,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true
          })
        ])
      );
      loop.start();
      return () => loop.stop();
    }

    breatheAnim.setValue(1);
    return undefined;
  }, [homeState, reduceMotion, breatheAnim]);

  useFocusEffect(
    useCallback(() => {
      setIsAnimating(false);

      void (async () => {
        const hasSeenWelcome = await AsyncStorage.getItem(HAS_SEEN_WELCOME_KEY).catch(() => null);
        if (!hasSeenWelcome) {
          router.replace("/welcome");
          return;
        }

        const period = await getOpenHoldPeriod().catch(() => null);
        setOpenPeriod(period);

        let resolvedState: HomeState = "normal";
        let progress: PostReconnectProgress | null = null;

        if (period) {
          resolvedState = "taking-time";
        } else {
          const conversationProgress = await getConversationProgress().catch(() => null);

          if (conversationProgress && conversationProgress.completed < conversationProgress.total) {
            resolvedState = "post-reconnect";
            progress = { done: conversationProgress.completed, total: conversationProgress.total };
          }
        }

        setHomeState(resolvedState);
        setPostReconnectProgress(progress);

        scaleAnim.setValue(resolvedState === "taking-time" ? QUIET_CIRCLE_SCALE : 1);
        Animated.timing(paletteAnim, {
          toValue: resolvedState === "taking-time" ? 1 : 0,
          duration: reduceMotion ? 0 : PALETTE_FADE_MS,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false
        }).start();
      })();
    }, [reduceMotion, scaleAnim, paletteAnim])
  );

  const start = (target: "hold") => {
    resetFlow(target);
    router.push("/create/people");
  };

  const beginReconnect = async () => {
    const circles = openPeriod?.audienceCircles ?? [];
    const ungrouped = openPeriod?.audienceUngrouped ?? [];

    await endOpenHoldPeriod();
    await seedFromAudience(circles, ungrouped);
    resetFlow("return");
    setAudience(circles, ungrouped);
    router.push("/return/transition");
  };

  const finishReconnecting = () => {
    router.push("/library");
  };

  const startNewQuietSession = () => {
    // Old unfinished Conversations stay saved, not cleared — starting a new quiet
    // session doesn't erase them, it just takes priority on Home until it ends.
    start("hold");
  };

  const addToGoingQuiet = () => {
    void (async () => {
      const picked = await pickContact();
      if (!picked) return;

      try {
        await sendOrShare([picked.phoneNumber], ADD_TO_GOING_QUIET_MESSAGE);
      } catch {
        // Still add them even if the compose sheet was cancelled — better to keep
        // track of them than lose the moment over a dismissed native sheet.
      }

      await addToAudience(picked);
    })();
  };

  const doClearPostReconnect = async () => {
    await completeAll();
    // This dismisses the journey without ever visiting the Reconnected screen,
    // so mode needs resetting here too — otherwise it stays stuck on "return"
    // and a later standalone Library visit would wrongly redirect to Reconnected.
    resetFlow("hold");
    setHomeState("normal");
    setPostReconnectProgress(null);
  };

  const confirmClear = (message: string) => {
    Alert.alert("Are you sure?", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Yes, clear it", onPress: () => void doClearPostReconnect() }
    ]);
  };

  const openAlreadySorted = () => {
    Alert.alert("Already sorted?", undefined, [
      {
        text: "I’ve already replied",
        onPress: () => confirmClear("This clears your reconnecting reminder.")
      },
      {
        text: "I’ll reply myself",
        onPress: () => confirmClear("This clears your reconnecting reminder.")
      },
      { text: "Stay in Reconnecting", style: "cancel" }
    ]);
  };

  const isQuietPalette = homeState === "taking-time";
  const currentTheme = isQuietPalette ? quietTheme : normalTheme;

  const animateAndNavigate = (
    targetScale: number,
    onArrive: () => void,
    options?: { ripple?: boolean }
  ) => {
    if (isAnimating) return;

    if (reduceMotion) {
      onArrive();
      return;
    }

    setIsAnimating(true);
    Animated.timing(scaleAnim, {
      toValue: targetScale,
      duration: TAP_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();

    if (options?.ripple) {
      rippleAnim.setValue(0);
      Animated.timing(rippleAnim, {
        toValue: 1,
        duration: RECONNECT_RIPPLE_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }).start();
    }

    setTimeout(onArrive, NAVIGATE_TRIGGER_MS);
  };

  const rippleOpacity = rippleAnim.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0.35, 0]
  });
  const rippleScale = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.6]
  });

  const animatedBackground = paletteAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [normalTheme.colors.background, quietTheme.colors.background]
  });
  const animatedPrimary = paletteAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [normalTheme.colors.primary, quietTheme.colors.primary]
  });

  const postReconnectSubtext = postReconnectProgress
    ? `Continue where you left off. ${postReconnectProgress.done} of ${postReconnectProgress.total} replies sent`
    : "Continue where you left off";

  return (
    <AnimatedSafeAreaView
      style={[styles.safe, { backgroundColor: animatedBackground }]}
      edges={["top", "bottom", "left", "right"]}
    >
      <View style={styles.headerRow}>
        <HeaderSettingsButton />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brand}>
          <HoldMark size={72} />
          <View style={styles.wordmarkRow}>
            <Text style={[styles.wordmark, { color: currentTheme.colors.text }]}>Hold</Text>
            <HeldMark size={20} />
          </View>
        </View>

        <View style={styles.hero}>
          {homeState === "taking-time" ? (
            <View style={styles.takingTimeHeader}>
              <Text style={[styles.comingBackLabel, { color: currentTheme.colors.text }]}>
                Taking time
              </Text>
              {openPeriod ? (
                <Text style={[styles.quietSinceText, { color: currentTheme.colors.textMuted }]}>
                  Quiet since {formatShortDate(openPeriod.startedAt)}
                </Text>
              ) : null}
            </View>
          ) : null}

          {homeState === "loading" ? (
            <View style={styles.circleBox}>
              <View
                style={[
                  styles.circleVisual,
                  styles.circlePlaceholder,
                  { backgroundColor: currentTheme.colors.surfaceStrong }
                ]}
              />
            </View>
          ) : homeState === "taking-time" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reconnect"
              disabled={isAnimating}
              onPress={() => animateAndNavigate(1, () => void beginReconnect(), { ripple: true })}
            >
              <View style={styles.circleStack}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.rippleRing,
                    {
                      backgroundColor: quietTheme.colors.primary,
                      opacity: rippleOpacity,
                      transform: [{ scale: rippleScale }]
                    }
                  ]}
                />
                <Animated.View
                  style={[
                    styles.circleBox,
                    { transform: [{ scale: scaleAnim }, { scale: breatheAnim }] }
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.circleVisual,
                      { backgroundColor: animatedPrimary, shadowColor: animatedPrimary }
                    ]}
                  >
                    <Text style={[styles.circleLabel, { color: currentTheme.colors.onPrimary }]}>
                      Reconnect
                    </Text>
                    <Text style={[styles.circleSubtext, { color: currentTheme.colors.onPrimary }]}>
                      Tap when you're ready
                    </Text>
                  </Animated.View>
                </Animated.View>
              </View>
            </Pressable>
          ) : homeState === "post-reconnect" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Finish Reconnecting"
              disabled={isAnimating}
              onPress={() => animateAndNavigate(QUIET_CIRCLE_SCALE, finishReconnecting)}
            >
              <Animated.View style={[styles.circleBox, { transform: [{ scale: scaleAnim }] }]}>
                <Animated.View
                  style={[
                    styles.circleVisual,
                    { backgroundColor: animatedPrimary, shadowColor: animatedPrimary }
                  ]}
                >
                  <Text style={[styles.circleLabel, { color: currentTheme.colors.onPrimary }]}>
                    Finish Reconnecting
                  </Text>
                  <Text style={[styles.circleSubtext, { color: currentTheme.colors.onPrimary }]}>
                    {postReconnectSubtext}
                  </Text>
                </Animated.View>
              </Animated.View>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Going quiet"
              disabled={isAnimating}
              onPress={() => animateAndNavigate(QUIET_CIRCLE_SCALE, () => start("hold"))}
            >
              <Animated.View style={[styles.circleBox, { transform: [{ scale: scaleAnim }] }]}>
                <Animated.View
                  style={[
                    styles.circleVisual,
                    { backgroundColor: animatedPrimary, shadowColor: animatedPrimary }
                  ]}
                >
                  <Text style={[styles.circleLabel, { color: currentTheme.colors.onPrimary }]}>
                    Going quiet
                  </Text>
                  <Text style={[styles.circleSubtext, { color: currentTheme.colors.onPrimary }]}>
                    Tap to let your people know
                  </Text>
                </Animated.View>
              </Animated.View>
            </Pressable>
          )}

          <Text style={[styles.reassuranceText, { color: currentTheme.colors.textMuted }]}>
            {homeState === "taking-time"
              ? "Come back at your own pace."
              : homeState === "post-reconnect"
                ? "There's no rush to finish."
                : "Take the time you need."}
          </Text>

          {homeState === "taking-time" ? (
            <View style={styles.takingTimeActions}>
              {openPeriod && !isSameCalendarDay(openPeriod.startedAt, Date.now()) ? (
                <SecondaryButton
                  label="Send an update"
                  onPress={() => router.push("/return/update")}
                />
              ) : null}
              <Pressable accessibilityRole="button" onPress={addToGoingQuiet}>
                <Text style={[styles.alreadySortedText, { color: currentTheme.colors.link }]}>
                  Someone new reached out?
                </Text>
              </Pressable>
            </View>
          ) : null}

          {homeState === "post-reconnect" ? (
            <View style={styles.postReconnectActions}>
              <SecondaryButton
                label="Start a New Quiet Session"
                onPress={() => void startNewQuietSession()}
              />
              <Pressable accessibilityRole="button" onPress={openAlreadySorted}>
                <Text style={[styles.alreadySortedText, { color: currentTheme.colors.link }]}>
                  Already sorted?
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.navRow}>
          <NavPill
            label="Circles"
            icon={<HeldMark size={20} />}
            onPress={() => router.push("/settings/circle")}
          />
        </View>
      </ScrollView>
    </AnimatedSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: theme.spacing.md
  },
  content: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.lg
  },
  brand: {
    alignItems: "center",
    gap: theme.spacing.sm
  },
  wordmarkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs
  },
  wordmark: {
    fontSize: 25,
    fontWeight: "600",
    letterSpacing: 0.3
  },
  hero: {
    alignItems: "center",
    gap: theme.spacing.xl
  },
  takingTimeHeader: {
    alignItems: "center",
    gap: theme.spacing.xs
  },
  comingBackLabel: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center"
  },
  quietSinceText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center"
  },
  takingTimeActions: {
    alignItems: "center",
    gap: theme.spacing.md
  },
  circleStack: {
    width: LARGE_CIRCLE_SIZE,
    height: LARGE_CIRCLE_SIZE
  },
  rippleRing: {
    position: "absolute",
    top: 0,
    left: 0,
    width: LARGE_CIRCLE_SIZE,
    height: LARGE_CIRCLE_SIZE,
    borderRadius: theme.radius.pill
  },
  circleBox: {
    width: LARGE_CIRCLE_SIZE,
    height: LARGE_CIRCLE_SIZE
  },
  circleVisual: {
    flex: 1,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.xs,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 10
  },
  circlePlaceholder: {
    shadowOpacity: 0
  },
  circleLabel: {
    fontSize: 30,
    fontWeight: "700",
    textAlign: "center"
  },
  circleSubtext: {
    fontSize: 13,
    fontWeight: "400",
    opacity: 0.75,
    textAlign: "center"
  },
  postReconnectActions: {
    alignItems: "center",
    gap: theme.spacing.md,
    alignSelf: "stretch"
  },
  alreadySortedText: {
    fontSize: 14,
    fontWeight: "600"
  },
  reassuranceText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 260
  },
  navRow: {
    flexDirection: "row",
    gap: theme.spacing.sm
  }
});
