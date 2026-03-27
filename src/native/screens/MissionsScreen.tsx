import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

const dailyMissions = [
  { title: "Spot & report 1 trash pile", description: "Capture one clear photo of litter in your area.", reward: "+120 EcoXP" },
];
const weeklyMissions = [
  { title: "5 verified cleanups", description: "Complete five verified cleanup missions this week.", reward: "+1,200 EcoXP" },
];
const leaderboard = [
  { rank: 1, name: "Aylin", score: 1420 },
  { rank: 2, name: "Mert", score: 1280 },
  { rank: 3, name: "Kenan", score: 1190 },
];

const rankStyle = (rank: number) => {
  if (rank === 1) return { bg: "#fef3c7", border: "#fde68a" };
  if (rank === 2) return { bg: "#f1f5f9", border: "#e2e8f0" };
  return { bg: "#fff7ed", border: "#fed7aa" };
};

export function MissionsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Missions & Leaderboards</Text>
        <Text style={styles.subtitle}>One mission from each is shown.</Text>

        {/* Daily */}
        <View style={[styles.card, { borderColor: "#d1fae5" }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="target" size={20} color="#10b981" />
              <Text style={styles.cardTitle}>Daily missions</Text>
            </View>
            <TouchableOpacity style={styles.showMore}>
              <Text style={styles.showMoreText}>Show more</Text>
            </TouchableOpacity>
          </View>
          {dailyMissions.map((m, i) => (
            <View key={i} style={styles.missionItem}>
              <View style={styles.missionTop}>
                <Text style={[styles.missionTitle, { flex: 1 }]}>{m.title}</Text>
                <View style={styles.rewardBadge}>
                  <Text style={styles.rewardText}>{m.reward}</Text>
                </View>
              </View>
              <Text style={styles.missionDesc}>{m.description}</Text>
            </View>
          ))}
        </View>

        {/* Weekly */}
        <View style={[styles.card, { borderColor: "#e9d5ff" }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="trophy" size={20} color="#c084fc" />
              <Text style={styles.cardTitle}>Weekly missions</Text>
            </View>
            <TouchableOpacity style={[styles.showMore, { backgroundColor: "#faf5ff" }]}>
              <Text style={[styles.showMoreText, { color: "#9333ea" }]}>Show more</Text>
            </TouchableOpacity>
          </View>
          {weeklyMissions.map((m, i) => (
            <View key={i} style={[styles.missionItem, { backgroundColor: "#faf5ff", borderColor: "#e9d5ff" }]}>
              <View style={styles.missionTop}>
                <Text style={[styles.missionTitle, { flex: 1 }]}>{m.title}</Text>
                <View style={[styles.rewardBadge, { backgroundColor: "#c084fc" }]}>
                  <Text style={styles.rewardText}>{m.reward}</Text>
                </View>
              </View>
              <Text style={styles.missionDesc}>{m.description}</Text>
            </View>
          ))}
        </View>

        {/* Leaderboard */}
        <View style={[styles.card, { borderColor: "#fde68a" }]}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="crown" size={22} color="#fbbf24" />
            <Text style={styles.cardTitle}>Leaderboards</Text>
          </View>
          <Text style={[styles.missionTitle, { color: "#059669", marginTop: 12, marginBottom: 8 }]}>Daily</Text>
          {leaderboard.map((e) => {
            const s = rankStyle(e.rank);
            return (
              <View key={e.rank} style={[styles.leaderRow, { backgroundColor: s.bg, borderColor: s.border }]}>
                <Text style={styles.rankNum}>#{e.rank}</Text>
                <Text style={styles.rankName}>{e.name}</Text>
                <Text style={styles.rankScore}>{e.score.toLocaleString()}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ecfdf5" },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: "700", color: "#1e293b", marginBottom: 6 },
  subtitle: { color: "#475569", fontSize: 13, marginBottom: 20 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  showMore: { backgroundColor: "#ecfdf5", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  showMoreText: { color: "#059669", fontSize: 12, fontWeight: "600" },
  missionItem: { backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#a7f3d0", borderRadius: 12, padding: 14 },
  missionTop: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  missionTitle: { fontWeight: "600", color: "#1e293b", fontSize: 14 },
  rewardBadge: { backgroundColor: "#10b981", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 },
  rewardText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  missionDesc: { color: "#475569", fontSize: 12, lineHeight: 18 },
  leaderRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  rankNum: { fontWeight: "700", fontSize: 16, color: "#475569", width: 36 },
  rankName: { flex: 1, fontWeight: "600", color: "#1e293b", fontSize: 14 },
  rankScore: { fontWeight: "700", color: "#059669", fontSize: 14 },
});
