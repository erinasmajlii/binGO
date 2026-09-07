import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/AuthContext";
import { useI18n } from "../../lib/i18n/I18nContext";
import {
  fetchUserEcoXpFromDb,
  getCaptureStats,
} from "../../lib/trashStats";

const XP_PER_LEVEL = 5000;

export function HomeScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, displayName, userKey } = useAuth();
  const [ecoXp, setEcoXp] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [cleanupCount, setCleanupCount] = useState(0);

  const goToProfile = () => router.push("/(tabs)/profile");
  const level = Math.floor(ecoXp / XP_PER_LEVEL) + 1;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
        const dbXp = user ? await fetchUserEcoXpFromDb(user.id) : 0;
        if (cancelled) return;
        setEcoXp(dbXp);

        const stats = await getCaptureStats(userKey, dbXp);
        if (cancelled) return;
        setStreakDays(stats.streak);
        setCleanupCount(stats.total);
      };

      load();
      return () => {
        cancelled = true;
      };
    }, [userKey, user]),
  );

  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          bin<Text style={{ fontWeight: "700" }}>Go</Text>
        </Text>
        <TouchableOpacity
          style={styles.headerRight}
          onPress={goToProfile}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={t("home.openProfile")}
        >
          <View style={styles.xpBadge}>
            <Text style={styles.xpText}>{ecoXp.toLocaleString()}</Text>
          </View>
          <View style={styles.lvBadge}>
            <Text style={styles.lvText}>{t("home.levelBadge", { level })}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userInitial}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t("home.sectionLabel")}</Text>
          <Text style={styles.pageTitle}>{t("home.title")}</Text>
          <Text style={styles.pageSubtitle}>{t("home.subtitle")}</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.grid}>
          <View style={[styles.card, styles.orangeCard]}>
            <View style={styles.cardIconRow}>
              <View style={[styles.iconBox, { backgroundColor: "#fb923c" }]}>
                <Ionicons name="flame" size={20} color="#fff" />
              </View>
              <Text style={[styles.cardLabel, { color: "#ea580c" }]}>{t("home.streak")}</Text>
            </View>
            <Text style={styles.cardValue}>{t("home.streakDays", { count: streakDays })}</Text>
            <Text style={styles.cardSub}>{t("home.keepItGoing")}</Text>
          </View>

          <View style={[styles.card, styles.blueCard]}>
            <View style={styles.cardIconRow}>
              <View style={[styles.iconBox, { backgroundColor: "#60a5fa" }]}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
              </View>
              <Text style={[styles.cardLabel, { color: "#2563eb" }]}>{t("home.cleanups")}</Text>
            </View>
            <Text style={styles.cardValue}>{cleanupCount}</Text>
            <Text style={styles.cardSub}>{t("home.verifiedMissions")}</Text>
          </View>
        </View>

        {/* Suggested Actions */}
        <View style={styles.actionCard}>
          <View style={styles.actionHeader}>
            <MaterialCommunityIcons name="target" size={20} color="#10b981" />
            <Text style={styles.actionTitle}>{t("home.suggestedActions")}</Text>
          </View>

          <TouchableOpacity style={styles.actionItem} activeOpacity={0.8} onPress={() => router.push("/(tabs)/report")}>
            <View style={[styles.iconBox, { backgroundColor: "#10b981" }]}>
              <Ionicons name="trash" size={20} color="#fff" />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionName}>{t("home.reportNearbyTrash")}</Text>
              <Text style={styles.actionSub}>{t("home.fastestWayToXp")}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionItem, styles.purpleItem]} activeOpacity={0.8} onPress={() => router.push("/(tabs)/missions")}>
            <View style={[styles.iconBox, { backgroundColor: "#c084fc" }]}>
              <Ionicons name="trophy" size={20} color="#fff" />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionName}>{t("home.completeAMission")}</Text>
              <Text style={styles.actionSub}>{t("home.bonusPointsLeaderboard")}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ecfdf5" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderBottomWidth: 1,
    borderBottomColor: "#d1fae5",
  },
  headerTitle: { fontSize: 22, color: "#059669", fontWeight: "300" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  xpBadge: { backgroundColor: "#ecfdf5", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  xpText: { color: "#059669", fontWeight: "700", fontSize: 13 },
  lvBadge: { backgroundColor: "#10b981", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  lvText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#34d399", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 20 },
  sectionLabel: { color: "#059669", fontWeight: "600", fontSize: 12, marginBottom: 6 },
  pageTitle: { fontSize: 28, fontWeight: "700", color: "#1e293b", marginBottom: 8 },
  pageSubtitle: { color: "#475569", fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: "row", gap: 12, marginBottom: 16 },
  card: { flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  orangeCard: { borderWidth: 1, borderColor: "#fed7aa" },
  blueCard: { borderWidth: 1, borderColor: "#bfdbfe" },
  cardIconRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  iconBox: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  cardLabel: { fontSize: 11, fontWeight: "600" },
  cardValue: { fontSize: 26, fontWeight: "700", color: "#1e293b", marginBottom: 2 },
  cardSub: { fontSize: 12, color: "#64748b" },
  actionCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#d1fae5", borderRadius: 16, padding: 16 },
  actionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  actionTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  actionItem: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#a7f3d0", borderRadius: 12, padding: 14, marginBottom: 10 },
  purpleItem: { backgroundColor: "#faf5ff", borderColor: "#e9d5ff" },
  actionText: { flex: 1 },
  actionName: { fontWeight: "600", color: "#1e293b", fontSize: 14, marginBottom: 2 },
  actionSub: { fontSize: 12, color: "#64748b" },
});
