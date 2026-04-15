import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../../lib/supabase";

export function ProfileScreen() {
  const [session, setSession] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [missionsCompleted, setMissionsCompleted] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
    if (!error && data) {
      setUserData(data);
    }
    
    // Fetch actual count of completed missions
    const { count } = await supabase.from('user_missions').select('*', { count: 'exact', head: true }).eq('user_id', userId);
    setMissionsCompleted(count || 0);

    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user?.id) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) fetchProfile(session.user.id);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (session?.user?.id) {
        fetchProfile(session.user.id);
      }
    }, [session?.user?.id])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#10b981" />
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.loginContent}>
          <View style={styles.loginCard}>
            <Text style={styles.loginTitle}>Not Logged In</Text>
            <Text style={styles.loginNote}>Please log in to view your profile and track your progress.</Text>

            <TouchableOpacity style={styles.loginBtn} onPress={() => router.push("/login")} activeOpacity={0.85}>
              <Text style={styles.loginBtnText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const xp = userData?.xp || 0;
  const level = userData?.level || 1;
  const nextLevelXp = level * 200;
  const currentLevelBaseXp = (level - 1) * 200;
  const xpIntoCurrentLevel = Math.max(0, xp - currentLevelBaseXp);
  const levelProgress = Math.min(100, Math.max(0, (xpIntoCurrentLevel / 200) * 100));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Header */}
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarText}>G</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.usernameLabel}>USERNAME</Text>
              <Text style={styles.username}>
                {session?.user?.user_metadata?.name || session?.user?.email || "Guest"}
              </Text>
            </View>
          </View>

          <View style={styles.xpBox}>
            <Text style={styles.xpLabel}>Total EcoXP</Text>
            <Text style={styles.xpValue}>{xp.toLocaleString()}</Text>
            <Text style={styles.xpSub}>Level {level} • {nextLevelXp.toLocaleString()} needed for next level</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${levelProgress}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{Math.round(levelProgress)}% to level {level + 1}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="flash" size={20} color="#fbbf24" />
            <Text style={styles.cardTitle}>Stats</Text>
          </View>
          <View style={styles.statsGrid}>
            {[
              { icon: "camera-outline", color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe", label: "PHOTOS", value: "128", sub: "Photos uploaded" },
              { icon: "flash-outline", color: "#9333ea", bg: "#faf5ff", border: "#e9d5ff", label: "RATE", value: "3.4", sub: "Daily rate" },
              { icon: "trophy-outline", color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0", label: "MISSIONS", value: missionsCompleted.toString(), sub: "Missions" },
              { icon: "flame-outline", color: "#f97316", bg: "#fff7ed", border: "#fed7aa", label: "STREAK", value: "7", sub: "Streak" },
            ].map((s, i) => (
              <View key={i} style={[styles.statCard, { backgroundColor: s.bg, borderColor: s.border }]}>
                <View style={styles.statTop}>
                  <Ionicons name={s.icon as any} size={16} color={s.color} />
                  <Text style={[styles.statLabel, { color: s.color }]}>{s.label}</Text>
                </View>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statSub}>{s.sub}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ecfdf5" },
  loginContent: { flex: 1, padding: 24, justifyContent: "center" },
  loginCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#d1fae5", borderRadius: 16, padding: 24 },
  loginTitle: { fontSize: 22, fontWeight: "700", color: "#1e293b", marginBottom: 6 },
  loginNote: { fontSize: 12, color: "#94a3b8", marginBottom: 20 },
  label: { fontSize: 11, fontWeight: "600", color: "#475569", marginBottom: 6 },
  input: { backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#a7f3d0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#1e293b", marginBottom: 14 },
  loginBtn: { backgroundColor: "#10b981", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginBottom: 10 },
  loginBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  skipBtn: { backgroundColor: "#ecfdf5", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  skipBtnText: { color: "#059669", fontSize: 14 },
  content: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#d1fae5", borderRadius: 16, padding: 16, marginBottom: 14 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  avatarLarge: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#34d399", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 24 },
  usernameLabel: { fontSize: 10, color: "#94a3b8", marginBottom: 2 },
  username: { fontSize: 18, fontWeight: "600", color: "#1e293b" },
  xpBox: { backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#a7f3d0", borderRadius: 12, padding: 16 },
  xpLabel: { fontSize: 15, fontWeight: "700", color: "#1e293b", marginBottom: 4 },
  xpValue: { fontSize: 36, fontWeight: "700", color: "#059669", marginBottom: 4 },
  xpSub: { fontSize: 12, color: "#475569", marginBottom: 10 },
  progressBar: { height: 10, backgroundColor: "#d1fae5", borderRadius: 5, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#c084fc", borderRadius: 5 },
  progressLabel: { fontSize: 11, color: "#94a3b8", marginTop: 6 },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "47%", borderWidth: 1, borderRadius: 12, padding: 12 },
  statTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  statLabel: { fontSize: 10, fontWeight: "600" },
  statValue: { fontSize: 22, fontWeight: "700", color: "#1e293b", marginBottom: 2 },
  statSub: { fontSize: 11, color: "#94a3b8" },
  logoutBtn: { backgroundColor: "#fee2e2", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  logoutText: { color: "#dc2626", fontWeight: "600", fontSize: 15 },
});
