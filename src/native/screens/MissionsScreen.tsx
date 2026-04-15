import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

const fallbackDaily = [
  { id: -1, title: "Spot & report 1 trash pile", description: "Capture one clear photo of litter in your area.", reward_xp: 150 },
];
const fallbackWeekly = [
  { id: -2, title: "5 verified cleanups", description: "Complete five verified cleanup missions this week.", reward_xp: 500 },
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
  const [dailyMissions, setDailyMissions] = useState<any[]>(fallbackDaily);
  const [weeklyMissions, setWeeklyMissions] = useState<any[]>(fallbackWeekly);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      fetchMissions();
    });
  }, []);

  const fetchMissions = async () => {
    const { data, error } = await supabase.from('missions').select('*');
    if (!error && data && data.length > 0) {
      setDailyMissions(data.filter((m: any) => m.type === 'daily'));
      setWeeklyMissions(data.filter((m: any) => m.type === 'weekly'));
    }
    setLoading(false);
  };

  const completeMission = async (mission: any) => {
    if (!session) {
      Alert.alert("Login required", "Please login to complete missions.");
      return;
    }
    if (mission.id < 0) {
      Alert.alert("Setup Required", "Please run the SQL setup script to test real missions!");
      return;
    }

    setCompleting(true);
    
    // Auto-fix broken accounts (e.g. if public.users was dropped after auth.users existed)
    const { data: userExists } = await supabase.from('users').select('id').eq('id', session.user.id).maybeSingle();
    if (!userExists) {
      await supabase.from('users').insert({
        id: session.user.id,
        username: session.user.user_metadata?.name || session.user.email || 'User',
        points: 0, xp: 0, level: 1
      });
    }

    // Insert completion
    const { error: insertError } = await supabase.from('user_missions').insert({
      user_id: session.user.id,
      mission_id: mission.id
    });

    if (insertError) {
      if (insertError.code === '23505') { // unique violation
        Alert.alert("Already Completed", "You have already completed this mission!");
      } else {
        Alert.alert("Error", "Could not complete mission.");
      }
      setCompleting(false);
      return;
    }

    // Update XP
    const { data: user } = await supabase.from('users').select('xp').eq('id', session.user.id).single();
    if (user) {
      const newXp = (user.xp || 0) + mission.reward_xp;
      const newLevel = Math.floor(newXp / 200) + 1;
      await supabase.from('users').update({ xp: newXp, level: newLevel }).eq('id', session.user.id);
      Alert.alert("Awesome!", `You completed the mission and earned +${mission.reward_xp} XP!`);
    }
    setCompleting(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      </SafeAreaView>
    );
  }

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
                <View style={{flexDirection: 'row', gap: 8, alignItems: 'center'}}>
                  <TouchableOpacity style={styles.testBtn} onPress={() => completeMission(m)} disabled={completing}>
                    <Text style={styles.testBtnText}>Complete</Text>
                  </TouchableOpacity>
                  <View style={styles.rewardBadge}>
                    <Text style={styles.rewardText}>+{m.reward_xp} XP</Text>
                  </View>
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
                <View style={{flexDirection: 'row', gap: 8, alignItems: 'center'}}>
                  <TouchableOpacity style={styles.testBtn} onPress={() => completeMission(m)} disabled={completing}>
                    <Text style={styles.testBtnText}>Complete</Text>
                  </TouchableOpacity>
                  <View style={[styles.rewardBadge, { backgroundColor: "#c084fc" }]}>
                    <Text style={styles.rewardText}>+{m.reward_xp} XP</Text>
                  </View>
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
  testBtn: { backgroundColor: "#3b82f6", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  testBtnText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  missionDesc: { color: "#475569", fontSize: 12, lineHeight: 18 },
  leaderRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  rankNum: { fontWeight: "700", fontSize: 16, color: "#475569", width: 36 },
  rankName: { flex: 1, fontWeight: "600", color: "#1e293b", fontSize: 14 },
  rankScore: { fontWeight: "700", color: "#059669", fontSize: 14 },
});
