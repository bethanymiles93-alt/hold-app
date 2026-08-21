import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Alert, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HoldMark } from "@/components/HoldMark";
import { SecondaryButton } from "@/components/SecondaryButton";
import { HeaderSettingsButton } from "@/components/HeaderSettingsButton";
import { TakingTimeUpdateDrawer } from "@/components/TakingTimeUpdateDrawer";
import { AddToGoingQuietDrawer } from "@/components/AddToGoingQuietDrawer";
import { theme } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useHoldFlow } from "@/context/HoldFlowContext";
import { useQuietPalette } from "@/context/QuietPaletteContext";
import {
  addCircleToAudience,
  endOpenHoldPeriod,
  endReconnecting,
  getOpenHoldPeriod,
  getReconnectCoverage,
  getReconnectingPeriod
} from "@/services/holdHistoryService";
import { completeAll, getProgress as getConversationProgress } from "@/services/conversationService";
import { formatShortDate, isSameCalendarDay } from "@/services/holdHistoryFormat";
import { pickContact } from "@/services/contactPickerService";
import { sendOrShare } from "@/services/smsService";
import { createGroup, addContactToGroup, getGroup, initialsPlaceholderName } from "@/services/circleService";
import { ADD_TO_GOING_QUIET_MESSAGE } from "@/constants/copy";
import { HAS_SEEN_WELCOME_KEY } from "@/constants/storageKeys";
import { NAV_BAR_RESERVED_HEIGHT } from "@/utils/navTier";
import type { CircleGroup, HoldPeriod } from "@/types/hold";

const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);

export const LARGE_CIRCLE_SIZE = 240;
export const QUIET_CIRCLE_SCALE = 0.75;

// Tap transitions are quick and purely physical (scale only) — the emotional
// colour shift lives on the resting screen instead, see the palette fade below.
// Deliberately snappy — an instant, responsive press (Instagram Stories
// opening on tap), not a slow fade the user has to wait through.
const TAP_DURATION = 120;
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

type HomeState = "loading" | "normal" | "taking-time" | "reconnecting" | "post-reconnect";

export default function HomeScreen() {
  const { resetFlow, setAudience } = useHoldFlow();
  const { setIsQuiet } = useQuietPalette();
  const normalTheme = useAppTheme("normal");
  const quietTheme = useAppTheme("quiet");
  const [openPeriod, setOpenPeriod] = useState<HoldPeriod | null>(null);
  const [homeState, setHomeState] = useState<HomeState>("loading");
  const [showUpdateDrawer, setShowUpdateDrawer] = useState(false);
  const [showAddToGoingQuietDrawer, setShowAddToGoingQuietDrawer] = useState(false);
  // Circles created via "Add to Going Quiet" this session — Home stays
  // mounted across tab switches, so this persists across the drawer being
  // closed and reopened, matching "alongside any others added this
  // session." Resets on a fresh app launch (component state, not
  // persisted) — that's the natural boundary of "this session."
  const [addToGoingQuietCircles, setAddToGoingQuietCircles] = useState<CircleGroup[]>([]);

  // BottomTabBar sits alongside the screens in the tab navigator, not
  // inside this component's own tree, so it has no way to know which
  // palette Home is currently resting in on its own — this is the one
  // place that fact gets written to the shared context it reads from. See
  // docs/09-decision-log.md, 2026-08-13.
  useEffect(() => {
    setIsQuiet(homeState === "taking-time");
  }, [homeState, setIsQuiet]);
  const [isAnimating, setIsAnimating] = useState(false);
  // Was this screen's own inline check (one-time AccessibilityInfo.isReduceMotionEnabled(),
  // no live-change listener) — now the shared app-wide hook instead, which
  // also picks up the OS setting changing mid-session. See
  // src/hooks/useReducedMotion.ts, docs/09-decision-log.md, 2026-08-21.
  const reduceMotion = useReducedMotion();

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const paletteAnim = useRef(new Animated.Value(0)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;

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

        if (period) {
          resolvedState = "taking-time";
        } else {
          const reconnectingPeriod = await getReconnectingPeriod().catch(() => null);
          const coverage = reconnectingPeriod ? getReconnectCoverage(reconnectingPeriod) : null;

          if (reconnectingPeriod && coverage && !coverage.complete) {
            // Coverage gate not yet satisfied — resume the Reconnect picker
            // directly rather than showing a misleading Normal Home, so a
            // force-quit mid-Reconnect never loses track of who's left.
            resolvedState = "reconnecting";
          } else {
            const conversationProgress = await getConversationProgress().catch(() => null);
            const personaliseDone = !conversationProgress || conversationProgress.completed >= conversationProgress.total;

            if (!personaliseDone) {
              resolvedState = "post-reconnect";
            } else if (reconnectingPeriod) {
              // Coverage was already complete and Personalise has now also
              // caught up (either here or via a later Library visit) — the
              // marker's only remaining job was letting reconnect.tsx
              // re-derive state for "Finish Reconnecting"; nothing left to
              // resume, so retire it now rather than leaving it set
              // indefinitely. See docs/09-decision-log.md, 2026-08-13.
              await endReconnecting();
            }
          }
        }

        setHomeState(resolvedState);

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
    const periodId = openPeriod?.id ?? null;

    await endOpenHoldPeriod();
    resetFlow("return");
    // Neither the durable RECONNECTING_KEY marker nor Conversations seeding
    // happens here — both are deferred to the first genuine send, inside
    // reconnect.tsx's send(). Doing either on tap meant backing out before
    // ever sending still left Home showing "Continue reconnecting" or
    // "Finish Reconnecting" on the next open, for a Reconnect nothing had
    // actually happened in. periodId travels via context so Reconnect can
    // still source its audience immediately, without needing either.
    setAudience(circles, ungrouped, periodId);
    router.push("/return/transition");
  };

  const continueReconnecting = () => {
    router.push("/return/reconnect");
  };

  const finishReconnecting = () => {
    // Was "/library" — a real bug, not a naming choice: it dead-ended in
    // general Library browsing with no way back into Reconnect's own
    // remaining steps (OOO/status gate, Done, the Transition screen).
    // reconnect.tsx re-derives its own state from durable storage on
    // focus, so resuming the actual flow here is both correct and
    // sufficient, matching continueReconnecting's sibling case above. See
    // docs/09-decision-log.md, 2026-08-13.
    router.push("/return/reconnect");
  };

  const startNewQuietSession = () => {
    // Old unfinished Conversations stay saved, not cleared — starting a new quiet
    // session doesn't erase them, it just takes priority on Home until it ends.
    start("hold");
  };

  // Every contact added this way becomes their own new Circle first — same
  // "+ New Circle" convention Going Quiet's own screen uses, not an
  // ungrouped entry (2026-08-13: there's no "individual, non-Circle"
  // category anywhere in this app). Circle creation alone doesn't add them
  // to the tracked audience yet — the drawer's own Send is what does that
  // (addCircleToAudience), matching "sending here adds to the ongoing
  // tracked audience" from the spec. See docs/09-decision-log.md.
  const createCircleFromPickedContact = async (): Promise<CircleGroup | null> => {
    const picked = await pickContact();
    if (!picked) return null;

    const name = initialsPlaceholderName([{ name: picked.name }]);
    const group = await createGroup(name);
    await addContactToGroup(group.id, { name: picked.name, phoneNumber: picked.phoneNumber });
    return getGroup(group.id);
  };

  const addToGoingQuiet = () => {
    void (async () => {
      // Mandatory: the contact picker opens first, before anything else —
      // no drawer appears at all if it's cancelled.
      const group = await createCircleFromPickedContact();
      if (!group) return;

      setAddToGoingQuietCircles((current) => [...current, group]);
      setShowAddToGoingQuietDrawer(true);
    })();
  };

  const addAnotherToGoingQuiet = () => {
    void (async () => {
      const group = await createCircleFromPickedContact();
      if (!group) return;
      setAddToGoingQuietCircles((current) => [...current, group]);
    })();
  };

  const addPersonToGoingQuietCircle = (circleId: string) => {
    void (async () => {
      const picked = await pickContact();
      if (!picked) return;

      await addContactToGroup(circleId, { name: picked.name, phoneNumber: picked.phoneNumber });
      const refreshed = await getGroup(circleId);
      if (!refreshed) return;
      setAddToGoingQuietCircles((current) => current.map((circle) => (circle.id === circleId ? refreshed : circle)));
    })();
  };

  const sendAddToGoingQuiet = async (
    selectedCircleIds: Set<string>,
    excludedPersonIds: Set<string>,
    message: string
  ) => {
    const selectedCircles = addToGoingQuietCircles.filter((circle) => selectedCircleIds.has(circle.id));
    const numbers = selectedCircles
      .flatMap((circle) => circle.contacts)
      .filter((contact) => !excludedPersonIds.has(contact.phoneNumber))
      .map((contact) => contact.phoneNumber);

    if (numbers.length > 0) {
      try {
        await sendOrShare(numbers, message);
      } catch {
        // Still add them even if the compose sheet was cancelled — better to keep
        // track of them than lose the moment over a dismissed native sheet.
      }
    }

    for (const circle of selectedCircles) {
      await addCircleToAudience({
        circleId: circle.id,
        circleName: circle.name,
        contacts: circle.contacts.map((contact) => ({ name: contact.name, phoneNumber: contact.phoneNumber }))
      });
    }
  };

  const doClearPostReconnect = async () => {
    await completeAll();
    // This dismisses the journey without ever visiting the Reconnected screen,
    // so the durable reconnecting marker needs clearing here too — otherwise
    // it stays set and a later standalone Library visit, seeing everyone
    // already complete, would wrongly redirect to Reconnected.
    await endReconnecting();
    resetFlow("hold");
    setHomeState("normal");
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

  return (
    <>
    <AnimatedSafeAreaView
      style={[styles.safe, { backgroundColor: animatedBackground }]}
      edges={["top", "bottom", "left", "right"]}
    >
      <View style={styles.headerRow}>
        <HeaderSettingsButton />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brand}>
          <HoldMark size={36} />
          <Text style={[styles.wordmark, { color: currentTheme.colors.text }]}>Hold</Text>
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
                style={[styles.circleVisual, { backgroundColor: currentTheme.colors.surfaceStrong }]}
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
                      { backgroundColor: animatedPrimary }
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
          ) : homeState === "reconnecting" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue reconnecting"
              disabled={isAnimating}
              onPress={() => animateAndNavigate(QUIET_CIRCLE_SCALE, continueReconnecting)}
            >
              <Animated.View style={[styles.circleBox, { transform: [{ scale: scaleAnim }] }]}>
                <Animated.View
                  style={[
                    styles.circleVisual,
                    { backgroundColor: animatedPrimary }
                  ]}
                >
                  <Text style={[styles.circleLabel, { color: currentTheme.colors.onPrimary }]}>
                    Continue reconnecting
                  </Text>
                  <Text style={[styles.circleSubtext, { color: currentTheme.colors.onPrimary }]}>
                    Pick up where you left off
                  </Text>
                </Animated.View>
              </Animated.View>
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
                    { backgroundColor: animatedPrimary }
                  ]}
                >
                  <Text style={[styles.circleLabel, { color: currentTheme.colors.onPrimary }]}>
                    Finish Reconnecting
                  </Text>
                  <Text style={[styles.circleSubtext, { color: currentTheme.colors.onPrimary }]}>
                    Continue where you left off
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
                    { backgroundColor: animatedPrimary }
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
              : homeState === "reconnecting"
                ? "Reach everyone at your own pace, a few at a time."
                : homeState === "post-reconnect"
                  ? "There's no rush to finish."
                  : "Take the time you need."}
          </Text>

          {homeState === "taking-time" ? (
            <View style={styles.takingTimeActions}>
              {openPeriod && !isSameCalendarDay(openPeriod.startedAt, Date.now()) ? (
                <SecondaryButton label="Send an update" onPress={() => setShowUpdateDrawer(true)} />
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
      </ScrollView>
    </AnimatedSafeAreaView>
    {openPeriod ? (
      <TakingTimeUpdateDrawer
        visible={showUpdateDrawer}
        onClose={() => setShowUpdateDrawer(false)}
        period={openPeriod}
        onSent={() => void getOpenHoldPeriod().then(setOpenPeriod)}
      />
    ) : null}
    <AddToGoingQuietDrawer
      visible={showAddToGoingQuietDrawer}
      onClose={() => setShowAddToGoingQuietDrawer(false)}
      circles={addToGoingQuietCircles}
      onAddAnother={addAnotherToGoingQuiet}
      onAddPersonToCircle={addPersonToGoingQuietCircle}
      onSend={sendAddToGoingQuiet}
      defaultMessage={ADD_TO_GOING_QUIET_MESSAGE}
    />
    </>
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
    // Home is always Tier 2 (see src/utils/navTier.ts) — the floating nav
    // bar always shows here (unless composing, which Home has no concept
    // of), so this always needs the reserved space, unlike Screen.tsx's
    // conditional version shared between both tiers.
    paddingBottom: theme.spacing.lg + NAV_BAR_RESERVED_HEIGHT
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
  // Matches circleLabel below exactly — hold-book's type-scale rule ("only
  // screen titles/the Home circle header and primary buttons read as
  // large") applies here too: "Taking time" is this state's headline, not
  // incidental text, same as "Going quiet"/"Reconnect" are for theirs.
  comingBackLabel: {
    fontSize: 22,
    lineHeight: 27,
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
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.xs
  },
  circleLabel: {
    fontSize: 22,
    lineHeight: 27,
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
  }
});
