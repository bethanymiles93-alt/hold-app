import { Tabs } from "expo-router";
import { HeaderSettingsButton } from "@/components/HeaderSettingsButton";
import { HoldMark } from "@/components/HoldMark";
import { LibraryIcon } from "@/components/LibraryIcon";
import { HistoryIcon } from "@/components/HistoryIcon";
import { theme } from "@/constants/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: theme.colors.text,
        headerStyle: { backgroundColor: theme.colors.background },
        headerRight: () => <HeaderSettingsButton />,
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
