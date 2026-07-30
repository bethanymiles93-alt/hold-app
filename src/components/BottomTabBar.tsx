import type { ReactNode } from "react";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme, type ThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/useAppTheme";
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
  options: { title?: string };
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
  const { colors } = useAppTheme("normal");
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom || theme.spacing.sm }]}>
      <View style={styles.pill}>
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
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      alignItems: "center",
      backgroundColor: colors.background,
      paddingTop: theme.spacing.sm
    },
    pill: {
      flexDirection: "row",
      backgroundColor: colors.surfaceStrong,
      borderRadius: theme.radius.pill,
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
