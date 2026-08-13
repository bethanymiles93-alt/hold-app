import type { ReactNode } from "react";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useQuietPalette } from "@/context/QuietPaletteContext";
import { useComposing } from "@/context/ComposingContext";
import { isTier1Route } from "@/utils/navTier";
import { HoldMark } from "@/components/HoldMark";
import { LibraryIcon } from "@/components/LibraryIcon";
import { HistoryIcon } from "@/components/HistoryIcon";

interface TabRoute {
  name: string;
  path: string;
  label: string;
  icon: ReactNode;
}

const ICON_SIZE = 26;

const TAB_ROUTES: TabRoute[] = [
  { name: "index", path: "/", label: "Home", icon: <HoldMark size={ICON_SIZE} /> },
  { name: "library", path: "/library", label: "Library", icon: <LibraryIcon size={ICON_SIZE} /> },
  { name: "history", path: "/history", label: "History", icon: <HistoryIcon size={ICON_SIZE} /> }
];

/**
 * Root-level overlay, not the Tabs navigator's own `tabBar` render prop
 * (moved here 2026-08-13) — Settings and Going Quiet/Reconnect/Transition
 * are all pushed root-stack screens outside the `(tabs)` group entirely,
 * so a `tabBar` prop scoped to that one navigator could never show or hide
 * itself there no matter what its own visibility logic said. Mounted once
 * in the root layout, sibling to the Stack, so it can overlay any screen
 * regardless of which navigator actually owns it.
 */
export function BottomTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isQuiet } = useQuietPalette();
  const { isComposing } = useComposing();
  const { colors, isDark } = useAppTheme(isQuiet ? "quiet" : "normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (isTier1Route(pathname)) return null;
  if (isComposing) return null;

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom || theme.spacing.sm }]}>
      {/* The pill itself is the only shape on screen — wrapper stays fully
          transparent, no box around the bar as a whole. Translucent blur
          material, not a flat semi-transparent colour: BlurView gives the
          actual frosted/shimmery quality; the tint View on top (an 8-digit
          hex, alpha appended to the theme's own surfaceStrong colour) is
          what makes it read as tinted-to-Hold's-background rather than a
          generic system blur. overflow: hidden on pillShape clips both
          layers to the pill's own rounded corners — BlurView doesn't
          respect a parent's borderRadius on its own. See
          docs/09-decision-log.md, 2026-08-13. */}
      <View style={styles.pillShape}>
        <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `${colors.surfaceStrong}B3` }]} />
        <View style={styles.pillContent}>
          {TAB_ROUTES.map((route) => {
            const focused = route.path === "/" ? pathname === "/" : pathname.startsWith(route.path);

            return (
              <Pressable
                key={route.name}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={route.label}
                onPress={() => {
                  if (!focused) router.navigate(route.path as never);
                }}
                style={styles.tab}
              >
                {route.icon}
                <Text style={[styles.label, focused && styles.labelActive]}>{route.label}</Text>
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
    // Absolutely positioned, not a normal flex sibling — mounted at root
    // level now (2026-08-13), alongside the Stack rather than inside a
    // navigator that used to lay it out in its own reserved bottom slot.
    wrapper: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      paddingTop: theme.spacing.sm
    },
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
