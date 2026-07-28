import { router, Tabs } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { AboutIcon } from "@/components/AboutIcon";
import { HoldMark } from "@/components/HoldMark";
import { LibraryIcon } from "@/components/LibraryIcon";
import { HistoryIcon } from "@/components/HistoryIcon";
import { theme } from "@/constants/theme";

function HeaderAboutButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="About"
      onPress={() => router.push("/about")}
      style={styles.headerButton}
    >
      <AboutIcon size={20} />
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: theme.colors.text,
        headerStyle: { backgroundColor: theme.colors.background },
        headerRight: () => <HeaderAboutButton />,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600"
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: "Home",
          tabBarIcon: () => <HoldMark size={22} />
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          tabBarIcon: () => <LibraryIcon />
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: () => <HistoryIcon />
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center"
  }
});
