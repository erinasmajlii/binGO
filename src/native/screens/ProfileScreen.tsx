import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import * as Linking from "expo-linking";
import {
  checkSupabaseReachable,
  getSupabaseConfigIssue,
  supabase,
} from "../../lib/supabase";
import { useAuth } from "../../lib/AuthContext";
import { fetchUserEcoXpFromDb, getCaptureStats } from "../../lib/trashStats";

const XP_PER_LEVEL = 5000;

export function ProfileScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isGuest, displayName, userKey, continueAsGuest, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [forgotPasswordStatus, setForgotPasswordStatus] = useState<string | null>(null);
  const [sendingResetEmail, setSendingResetEmail] = useState(false);
  const [ecoXp, setEcoXp] = useState(0);
  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof getCaptureStats>
  > | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  const userEmail = user?.email ?? "";

  useEffect(() => {
    if (!supabase || !user?.id) {
      setEcoXp(0);
      return;
    }

    let mounted = true;

    (async () => {
      const { data: row } = await supabase
        .from("leaderboard_scores")
        .select("total_points")
        .eq("user_id", user.id)
        .single();

      if (row && mounted) {
        setEcoXp(Number(row.total_points ?? 0));
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const handleLogin = async () => {
    setAuthMessage(null);
    setNeedsEmailConfirmation(false);
    setResendStatus(null);

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
      setAuthMessage(
        "Supabase client is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env and restart Expo.",
      );
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
        setNeedsEmailConfirmation(
          error.code === "email_not_confirmed" ||
            error.message.toLowerCase().includes("email not confirmed"),
        );
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

  const handleResendConfirmation = async () => {
    if (!supabase || !email.trim()) return;

    setResending(true);
    setResendStatus(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
      });

      setResendStatus(
        error ? error.message : "Confirmation email sent. Check your inbox.",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setResendStatus(message || "Could not resend the confirmation email.");
    } finally {
      setResending(false);
    }
  };

  const handleSendPasswordReset = async () => {
    setForgotPasswordStatus(null);

    if (!email.trim()) {
      setForgotPasswordStatus("Enter your email above first.");
      return;
    }
    if (!supabase) {
      setForgotPasswordStatus("Supabase is not configured on this device.");
      return;
    }

    setSendingResetEmail(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: Linking.createURL("reset-password"),
      });

      setForgotPasswordStatus(
        error
          ? error.message
          : "If an account exists for that email, a reset link has been sent.",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setForgotPasswordStatus(message || "Could not send the reset email.");
    } finally {
      setSendingResetEmail(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setPassword("");
  };

  const refreshProfileFromServer = useCallback(
    async (isMounted: () => boolean) => {
      if (!user?.id) {
        setStats(await getCaptureStats(userKey));
        return;
      }

      try {
        const dbXp = await fetchUserEcoXpFromDb(user.id);
        if (!isMounted()) return;
        setEcoXp(dbXp);
        setStats(await getCaptureStats(userKey, dbXp));
      } catch {
        // Keep profile usable when refresh fails offline.
      }
    },
    [user?.id, userKey],
  );

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      refreshProfileFromServer(() => mounted);
      return () => {
        mounted = false;
      };
    }, [refreshProfileFromServer]),
  );

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const totalEcoXp = useMemo(
    () => ecoXp ?? stats?.totalPoints ?? 0,
    [ecoXp, stats?.totalPoints],
  );
  const level = useMemo(
    () => Math.floor(totalEcoXp / XP_PER_LEVEL) + 1,
    [totalEcoXp],
  );
  const xpIntoLevel = useMemo(() => totalEcoXp % XP_PER_LEVEL, [totalEcoXp]);
  const xpRemaining = useMemo(() => XP_PER_LEVEL - xpIntoLevel, [xpIntoLevel]);
  const levelProgress = useMemo(() => {
    const progress = (xpIntoLevel / XP_PER_LEVEL) * 100;
    return `${Math.round(progress)}%`;
  }, [xpIntoLevel]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.loginContent}>
          <View style={styles.loginCard}>
            {forgotPasswordMode ? (
              <>
                <Text style={styles.loginTitle}>Reset password</Text>
                <Text style={styles.loginNote}>
                  Enter your account email — we will send a link to set a new password.
                </Text>

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

                {forgotPasswordStatus ? (
                  <Text style={styles.resendStatus}>{forgotPasswordStatus}</Text>
                ) : null}

                <TouchableOpacity
                  style={[styles.loginBtn, sendingResetEmail && styles.loginBtnDisabled]}
                  onPress={handleSendPasswordReset}
                  activeOpacity={0.85}
                  disabled={sendingResetEmail}
                >
                  {sendingResetEmail ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.loginBtnText}>Send reset link</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.skipBtn}
                  onPress={() => {
                    setForgotPasswordMode(false);
                    setForgotPasswordStatus(null);
                  }}
                >
                  <Text style={styles.skipBtnText}>Back to login</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.loginTitle}>Login</Text>
                <Text style={styles.loginNote}>
                  Use your registered email and password.
                </Text>

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

                <TouchableOpacity
                  style={styles.forgotPasswordBtn}
                  onPress={() => {
                    setForgotPasswordMode(true);
                    setAuthMessage(null);
                    setForgotPasswordStatus(null);
                  }}
                >
                  <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                </TouchableOpacity>

                {authMessage ? (
                  <Text style={styles.authError}>{authMessage}</Text>
                ) : null}

                {needsEmailConfirmation ? (
                  <TouchableOpacity
                    style={styles.resendBtn}
                    onPress={handleResendConfirmation}
                    disabled={resending}
                  >
                    <Text style={styles.resendBtnText}>
                      {resending ? "Sending..." : "Resend confirmation email"}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {resendStatus ? (
                  <Text style={styles.resendStatus}>{resendStatus}</Text>
                ) : null}

                <TouchableOpacity
                  style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                  onPress={handleLogin}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.loginBtnText}>Login</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.skipBtn}
                  onPress={continueAsGuest}
                >
                  <Text style={styles.skipBtnText}>Skip for now</Text>
                </TouchableOpacity>
              </>
            )}
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
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.usernameLabel}>USERNAME</Text>
              <Text style={styles.username}>{isGuest && !user ? "Guest" : displayName}</Text>
              {userEmail && <Text style={styles.userEmail}>{userEmail}</Text>}
            </View>
          </View>

          <View style={styles.xpBox}>
            <Text style={styles.xpLabel}>Total EcoXP</Text>
            <Text style={styles.xpValue}>{totalEcoXp.toLocaleString()}</Text>
            <Text style={styles.xpSub}>
              Level {level} • {xpRemaining.toLocaleString()} needed
              for next level
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: levelProgress as any }]} />
            </View>
            <Text style={styles.progressLabel}>
              {levelProgress} to level {level + 1}
            </Text>
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
              {
                icon: "camera-outline",
                color: "#059669",
                bg: "#ecfdf5",
                border: "#a7f3d0",
                label: "PHOTOS",
                value: String(stats?.total ?? 0),
                sub: "Photos classified",
              },
              {
                icon: "analytics-outline",
                color: "#0f766e",
                bg: "#f0fdfa",
                border: "#99f6e4",
                label: "RATE",
                value: String(stats?.weeklyRate ?? 0),
                sub: "Daily avg (7d)",
              },
              {
                icon: "leaf-outline",
                color: "#047857",
                bg: "#dcfce7",
                border: "#86efac",
                label: "ECO XP",
                value: String(totalEcoXp),
                sub: "Total EcoXP",
              },
              {
                icon: "flame-outline",
                color: "#065f46",
                bg: "#ecfdf5",
                border: "#6ee7b7",
                label: "STREAK",
                value: String(stats?.streak ?? 0),
                sub: "Active days",
              },
            ].map((s, i) => (
              <View
                key={i}
                style={[
                  styles.statCard,
                  { backgroundColor: s.bg, borderColor: s.border },
                ]}
              >
                <View style={styles.statTop}>
                  <Ionicons name={s.icon as any} size={16} color={s.color} />
                  <Text style={[styles.statLabel, { color: s.color }]}>
                    {s.label}
                  </Text>
                </View>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statSub}>{s.sub}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="layers-outline" size={20} color="#059669" />
            <Text style={styles.cardTitle}>Waste Breakdown</Text>
          </View>

          {(stats?.breakdown ?? []).map((item, index) => (
            <View
              key={item.category}
              style={[
                styles.rankRow,
                {
                  backgroundColor: item.colors.bg,
                  borderColor: item.colors.border,
                },
              ]}
            >
              <Text style={styles.rankNumber}>{index + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rankLabel, { color: item.colors.text }]}>
                  {item.label}
                </Text>
                <Text style={styles.rankSub}>
                  {item.percent}% of your reports
                </Text>
              </View>
              <Text style={styles.rankCount}>{item.count}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="images-outline" size={20} color="#059669" />
            <Text style={styles.cardTitle}>Recent Captures</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photosRow}
          >
            {(stats?.recentPhotos ?? []).map((photo, index) => {
              const shift = pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [
                  index % 2 === 0 ? 0 : -4,
                  index % 2 === 0 ? -4 : 0,
                ],
              });

              return (
                <Animated.View
                  key={photo.id}
                  style={[
                    styles.photoCard,
                    { transform: [{ translateY: shift }] },
                  ]}
                >
                  <Image
                    source={{ uri: photo.uri }}
                    style={styles.photoThumb}
                  />
                  <Text style={styles.photoLabel}>{photo.category}</Text>
                </Animated.View>
              );
            })}
          </ScrollView>

          {(stats?.recentPhotos?.length ?? 0) === 0 ? (
            <Text style={styles.emptyHint}>
              No photos yet. Capture trash from Report to populate this section.
            </Text>
          ) : null}
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
  loginCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1fae5",
    borderRadius: 16,
    padding: 24,
  },
  loginTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 6,
  },
  loginNote: { fontSize: 12, color: "#94a3b8", marginBottom: 20 },
  label: { fontSize: 11, fontWeight: "600", color: "#475569", marginBottom: 6 },
  input: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1e293b",
    marginBottom: 14,
  },
  loginBtn: {
    backgroundColor: "#10b981",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  authError: { color: "#dc2626", fontSize: 12, marginBottom: 10 },
  forgotPasswordBtn: { alignSelf: "flex-end", marginBottom: 14, marginTop: -6 },
  forgotPasswordText: { color: "#059669", fontSize: 13, fontWeight: "600" },
  resendBtn: { alignSelf: "flex-start", marginBottom: 10 },
  resendBtnText: { color: "#059669", fontSize: 13, fontWeight: "600", textDecorationLine: "underline" },
  resendStatus: { color: "#475569", fontSize: 12, marginBottom: 10 },
  skipBtn: {
    backgroundColor: "#ecfdf5",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  skipBtnText: { color: "#059669", fontSize: 14 },
  content: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1fae5",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  avatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#34d399",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 24 },
  usernameLabel: { fontSize: 10, color: "#94a3b8", marginBottom: 2 },
  username: { fontSize: 18, fontWeight: "600", color: "#1e293b" },
  userEmail: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  xpBox: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: 12,
    padding: 16,
  },
  xpLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  xpValue: {
    fontSize: 36,
    fontWeight: "700",
    color: "#059669",
    marginBottom: 4,
  },
  xpSub: { fontSize: 12, color: "#475569", marginBottom: 10 },
  progressBar: {
    height: 10,
    backgroundColor: "#d1fae5",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#10b981", borderRadius: 5 },
  progressLabel: { fontSize: 11, color: "#94a3b8", marginTop: 6 },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "47%", borderWidth: 1, borderRadius: 12, padding: 12 },
  statTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  statLabel: { fontSize: 10, fontWeight: "600" },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 2,
  },
  statSub: { fontSize: 11, color: "#94a3b8" },
  rankRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  rankNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: "center",
    lineHeight: 28,
    backgroundColor: "#ffffff",
    color: "#065f46",
    fontWeight: "700",
  },
  rankLabel: { fontSize: 14, fontWeight: "700" },
  rankSub: { color: "#64748b", fontSize: 12, marginTop: 2 },
  rankCount: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  photosRow: { gap: 10, paddingBottom: 2 },
  photoCard: {
    width: 104,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    backgroundColor: "#f0fdf4",
    overflow: "hidden",
  },
  photoThumb: { width: "100%", height: 86, backgroundColor: "#dcfce7" },
  photoLabel: {
    paddingVertical: 6,
    textAlign: "center",
    fontWeight: "600",
    color: "#065f46",
    fontSize: 11,
  },
  emptyHint: { color: "#64748b", fontSize: 12 },
  logoutBtn: {
    backgroundColor: "#fee2e2",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: { color: "#dc2626", fontWeight: "600", fontSize: 15 },
});
