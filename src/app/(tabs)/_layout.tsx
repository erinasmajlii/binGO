import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SafeAreaView } from "react-native-safe-area-context";
import { Platform } from "react-native";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const isAndroid = Platform.OS === "android";

  const tabBarPaddingBottom = isAndroid
    ? insets.bottom > 0
      ? insets.bottom + 8
      : 8
    : 8;

  const tabs = (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#d1fae5",
          borderTopWidth: 1,
          height: 64,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 4,
        },
        tabBarActiveTintColor: "#059669",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarIcon: ({ focused, color }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            home: focused ? "home" : "home-outline",
            map: focused ? "map" : "map-outline",
            report: focused ? "camera" : "camera-outline",
            missions: focused ? "trophy" : "trophy-outline",
            profile: focused ? "person" : "person-outline",
          };
          return <Ionicons name={icons[route.name]} size={22} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="map" options={{ title: "Map" }} />
      <Tabs.Screen name="report" options={{ title: "Report" }} />
      <Tabs.Screen name="missions" options={{ title: "Missions" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );

  // Android: wrap in SafeAreaView to handle system navigation bar overlap
  if (isAndroid) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        {tabs}
      </SafeAreaView>
    );
  }

  // iOS: return tabs directly (already perfect, no changes)
  return tabs;
}
