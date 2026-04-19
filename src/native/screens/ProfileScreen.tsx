import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { checkSupabaseReachable, getSupabaseConfigIssue, supabase } from "../../lib/supabase";

export function ProfileScreen() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [username, setUsername] = useState("Guest");

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!mounted) return;

      setIsLoggedIn(Boolean(user));
      setUsername(user?.email ?? "Guest");
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setIsLoggedIn(Boolean(user));
      setUsername(user?.email ?? "Guest");
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    setAuthMessage(null);

    if (!email.trim() || !password) {
      setAuthMessage("Email and password are required.");
      return;
    }

    const configIssue = getSupabaseConfigIssue();
    if (configIssue) {
      setAuthMessage(configIssue);
      return;
    }

    const reachabilityIssue = await checkSupabaseReachable();
    if (reachabilityIssue) {
      setAuthMessage(reachabilityIssue);
      return;
    }

    if (!supabase) {
      setAuthMessage("Supabase client is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env and restart Expo.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setAuthMessage(error.message);
        return;
      }

      setPassword("");
      setAuthMessage(null);
      router.push("/(tabs)/home");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAuthMessage(message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }

    setIsLoggedIn(false);
    setUsername("Guest");
    setPassword("");
  };

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.loginContent}>
          <View style={styles.loginCard}>
            <Text style={styles.loginTitle}>Login</Text>
            <Text style={styles.loginNote}>Use your registered email and password.</Text>

            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="name@example.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            {authMessage ? <Text style={styles.authError}>{authMessage}</Text> : null}

            <TouchableOpacity style={[styles.loginBtn, loading && styles.loginBtnDisabled]} onPress={handleLogin} activeOpacity={0.85} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Login</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipBtn} onPress={() => setIsLoggedIn(true)}>
              <Text style={styles.skipBtnText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Header */}
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarText}>{username.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.usernameLabel}>USERNAME</Text>
              <Text style={styles.username}>{username}</Text>
            </View>
          </View>

          <View style={styles.xpBox}>
            <Text style={styles.xpLabel}>Total EcoXP</Text>
            <Text style={styles.xpValue}>98,500</Text>
            <Text style={styles.xpSub}>Level 7 • 110,000 needed for next level</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: "90%" }]} />
            </View>
            <Text style={styles.progressLabel}>90% to level 8</Text>
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
              { icon: "trophy-outline", color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0", label: "MISSIONS", value: "42", sub: "Missions" },
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

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
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
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  authError: { color: "#dc2626", fontSize: 12, marginBottom: 10 },
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
