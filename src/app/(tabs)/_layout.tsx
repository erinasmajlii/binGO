import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { useI18n } from "../../lib/i18n/I18nContext";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
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
      <Tabs.Screen name="home" options={{ title: t("tabs.home") }} />
      <Tabs.Screen name="map" options={{ title: t("tabs.map") }} />
      <Tabs.Screen name="report" options={{ title: t("tabs.report") }} />
      <Tabs.Screen name="missions" options={{ title: t("tabs.missions") }} />
      <Tabs.Screen name="profile" options={{ title: t("tabs.profile") }} />
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
