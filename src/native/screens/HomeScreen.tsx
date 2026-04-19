import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

export function HomeScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("Guest");

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!mounted) return;

      setUsername(user?.email ?? "Guest");
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setUsername(user?.email ?? "Guest");
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const userInitial = username.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          bin<Text style={{ fontWeight: "700" }}>Go</Text>
        </Text>
        <View style={styles.headerRight}>
          <View style={styles.xpBadge}>
            <Text style={styles.xpText}>9,435</Text>
          </View>
          <View style={styles.lvBadge}>
            <Text style={styles.lvText}>Lv 7</Text>
          </View>
          <TouchableOpacity style={styles.avatar} onPress={() => router.push("/(tabs)/profile")}>
            <Text style={styles.avatarText}>{userInitial}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HOME</Text>
          <Text style={styles.pageTitle}>Your impact, today.</Text>
          <Text style={styles.pageSubtitle}>
            Quick snapshot of your eco progress. Report trash, complete missions, and climb the ranks.
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.grid}>
          <View style={[styles.card, styles.orangeCard]}>
            <View style={styles.cardIconRow}>
              <View style={[styles.iconBox, { backgroundColor: "#fb923c" }]}>
                <Ionicons name="flame" size={20} color="#fff" />
              </View>
              <Text style={[styles.cardLabel, { color: "#ea580c" }]}>STREAK</Text>
            </View>
            <Text style={styles.cardValue}>7 days</Text>
            <Text style={styles.cardSub}>Keep it going</Text>
          </View>

          <View style={[styles.card, styles.blueCard]}>
            <View style={styles.cardIconRow}>
              <View style={[styles.iconBox, { backgroundColor: "#60a5fa" }]}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
              </View>
              <Text style={[styles.cardLabel, { color: "#2563eb" }]}>CLEANUPS</Text>
            </View>
            <Text style={styles.cardValue}>50</Text>
            <Text style={styles.cardSub}>Verified missions</Text>
          </View>
        </View>

        {/* Suggested Actions */}
        <View style={styles.actionCard}>
          <View style={styles.actionHeader}>
            <MaterialCommunityIcons name="target" size={20} color="#10b981" />
            <Text style={styles.actionTitle}>Suggested next actions</Text>
          </View>

          <TouchableOpacity style={styles.actionItem} activeOpacity={0.8} onPress={() => router.push("/(tabs)/report")}>
            <View style={[styles.iconBox, { backgroundColor: "#10b981" }]}>
              <Ionicons name="trash" size={20} color="#fff" />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionName}>Report nearby trash</Text>
              <Text style={styles.actionSub}>Fastest way to gain EcoXP</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionItem, styles.purpleItem]} activeOpacity={0.8} onPress={() => router.push("/(tabs)/missions")}>
            <View style={[styles.iconBox, { backgroundColor: "#c084fc" }]}>
              <Ionicons name="trophy" size={20} color="#fff" />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionName}>Complete a mission</Text>
              <Text style={styles.actionSub}>Bonus points + leaderboard boosts</Text>
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
