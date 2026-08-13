import type { ReactNode } from "react";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useQuietPalette } from "@/context/QuietPaletteContext";
import { HoldMark } from "@/components/HoldMark";
import { LibraryIcon } from "@/components/LibraryIcon";
import { HistoryIcon } from "@/components/HistoryIcon";

// A minimal, locally-defined shape of BottomTabBarProps — just the fields
// actually used here — rather than importing expo-router's unexported,
// deep-internal bottom-tabs type path.
interface TabBarRoute {
  key: string;
  name: string;
}

interface TabBarState {
  index: number;
  routes: TabBarRoute[];
}

interface TabBarDescriptor {
  /**
   * `hideTabBar`: set via useComposingGestureLock, from whichever tab
   * screen currently has a docked text field actively focused (Library —
   * the only tab screen with a composition surface at all). Checked below
   * against the FOCUSED route specifically, not any/every route, so
   * switching tabs while composing doesn't leave the bar hidden for a
   * screen that was never actually composing. See docs/09-decision-log.md,
   * 2026-08-13.
   */
  options: { title?: string; hideTabBar?: boolean };
}

interface TabPressEvent {
  defaultPrevented: boolean;
}

interface BottomTabBarProps {
  state: TabBarState;
  descriptors: Record<string, TabBarDescriptor>;
  navigation: {
    navigate: (name: string) => void;
    emit: (event: { type: "tabPress"; target: string; canPreventDefault: true }) => TabPressEvent;
  };
}

const ICON_SIZE = 26;

const ICONS: Record<string, ReactNode> = {
  index: <HoldMark size={ICON_SIZE} />,
  library: <LibraryIcon size={ICON_SIZE} />,
  history: <HistoryIcon size={ICON_SIZE} />
};

/** All three tabs grouped into a single floating pill, rather than three separate tab-bar items. */
export function BottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // Theme-aware to whichever palette Home is currently resting in (normal
  // vs. quiet/Taking Time), not hardcoded to "normal" — was previously a
  // real, findable mismatch: the pill's fill could visibly clash with a
  // quiet-palette background behind it. See QuietPaletteContext and
  // docs/09-decision-log.md, 2026-08-13.
  const { isQuiet } = useQuietPalette();
  const { colors, isDark } = useAppTheme(isQuiet ? "quiet" : "normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  const focusedRoute = state.routes[state.index];
  const focusedDescriptor = focusedRoute ? descriptors[focusedRoute.key] : undefined;
  if (focusedDescriptor?.options.hideTabBar) return null;

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom || theme.spacing.sm }]}>
      {/* The pill itself is the only shape on screen — wrapper stays fully
          transparent, no box around the bar as a whole (see
          docs/09-decision-log.md, 2026-08-13, item 1). Translucent blur
          material, not a flat semi-transparent colour: BlurView gives the
          actual frosted/shimmery quality; the tint View on top (an 8-digit
          hex, alpha appended to the theme's own surfaceStrong colour) is
          what makes it read as tinted-to-Hold's-background rather than a
          generic system blur. overflow: hidden on pillShape clips both
          layers to the pill's own rounded corners — BlurView doesn't
          respect a parent's borderRadius on its own. Item 2. */}
      <View style={styles.pillShape}>
        <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `${colors.surfaceStrong}B3` }]} />
        <View style={styles.pillContent}>
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          const label = descriptor?.options.title ?? route.name;
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress" as const,
              target: route.key,
              canPreventDefault: true as const
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={label}
              onPress={onPress}
              style={styles.tab}
            >
              {ICONS[route.name] ?? null}
              <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
            </Pressable>
          );
        })}
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      alignItems: "center",
      paddingTop: theme.spacing.sm
    },
    // The pill's own rounded shape and clip boundary — no backgroundColor
    // here itself, since the blur + tint layers (absolute-filled siblings
    // inside it) are what actually paint it now, not a flat fill. See
    // docs/09-decision-log.md, 2026-08-13.
    pillShape: {
      borderRadius: theme.radius.pill,
      overflow: "hidden"
    },
    pillContent: {
      flexDirection: "row",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.xl
    },
    tab: {
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      minWidth: 52
    },
    label: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textMuted
    },
    labelActive: {
      color: colors.primary
    }
  });
}
