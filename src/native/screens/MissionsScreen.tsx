import { useCallback, useState, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Modal } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  awardMissionXp,
  getCaptureStats,
  getGlobalLeaderboard,
  LeaderboardEntry,
} from "../../lib/trashStats";
import {
  getDailyMissionState,
  getWeeklyMissionState,
  Mission,
  MissionCategory,
  getMissionProgress,
  claimMissionReward,
} from "../../lib/missions";
import { getSupabaseConfigIssue, checkSupabaseReachable, supabase } from "../../lib/supabase";

const rankStyle = (rank: number) => {
  if (rank === 1) return { bg: "#fef3c7", border: "#fde68a" };
  if (rank === 2) return { bg: "#f1f5f9", border: "#e2e8f0" };
  return { bg: "#fff7ed", border: "#fed7aa" };
};

export function MissionsScreen() {
  const insets = useSafeAreaInsets();
  const [dailyMissions, setDailyMissions] = useState<Mission[]>([]);
  const [weeklyMissions, setWeeklyMissions] = useState<Mission[]>([]);
  const [dailyClaimedIds, setDailyClaimedIds] = useState<string[]>([]);
  const [weeklyClaimedIds, setWeeklyClaimedIds] = useState<string[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [missionStats, setMissionStats] = useState<Awaited<ReturnType<typeof getCaptureStats>> | null>(null);
  const [statsUserKey, setStatsUserKey] = useState("guest");
  const [claimingMissionId, setClaimingMissionId] = useState<string | null>(null);
  
  const [loadingMissions, setLoadingMissions] = useState(true);
  const [loadingMissionStats, setLoadingMissionStats] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [lastLeaderboardRefresh, setLastLeaderboardRefresh] = useState<number>(0);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!mounted) return;

      setStatsUserKey(user?.id || user?.email || "guest");
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setStatsUserKey(user?.id || user?.email || "guest");
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const loadMissions = useCallback(async () => {
    setLoadingMissions(true);
    try {
      const [dailyState, weeklyState] = await Promise.all([getDailyMissionState(), getWeeklyMissionState()]);
      setDailyMissions(dailyState.missions);
      setWeeklyMissions(weeklyState.missions);
      setDailyClaimedIds(dailyState.claimedMissionIds ?? []);
      setWeeklyClaimedIds(weeklyState.claimedMissionIds ?? []);
    } catch (error) {
      console.error("Error loading missions:", error);
    } finally {
      setLoadingMissions(false);
    }
  }, []);

  const loadMissionStats = useCallback(async () => {
    setLoadingMissionStats(true);
    try {
      const stats = await getCaptureStats(statsUserKey);
      setMissionStats(stats);
    } catch (error) {
      console.error("Error loading mission stats:", error);
    } finally {
      setLoadingMissionStats(false);
    }
  }, [statsUserKey]);

  const shouldRefreshLeaderboard = useCallback((): boolean => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastLeaderboardRefresh;
    // Refresh if never refreshed or if 24 hours have passed (86400000 ms)
    return lastLeaderboardRefresh === 0 || timeSinceLastRefresh >= 86400000;
  }, [lastLeaderboardRefresh]);

  const loadLeaderboard = useCallback(async () => {
    if (!shouldRefreshLeaderboard()) return;

    setLoadingLeaderboard(true);
    setLeaderboardError(null);

    // Check config quickly
    const configIssue = getSupabaseConfigIssue();
    if (configIssue) {
      setLeaderboard([]);
      setLeaderboardError(configIssue);
      setLoadingLeaderboard(false);
      return;
    }

    // Optional reachability check (short timeout)
    try {
      const reach = await checkSupabaseReachable(3000);
      if (reach) {
        setLeaderboardError(reach);
        setLoadingLeaderboard(false);
        return;
      }
    } catch {
      // ignore and proceed to fetch
    }

    try {
      const rows = await getGlobalLeaderboard(3);
      setLeaderboard(rows);
      setLastLeaderboardRefresh(Date.now());
    } catch (error) {
      console.error("Error loading leaderboard:", error);
      setLeaderboardError(String(error ?? "Unknown error fetching leaderboard"));
    } finally {
      setLoadingLeaderboard(false);
    }
  }, [shouldRefreshLeaderboard]);

  /** Unconditional leaderboard fetch — used after mission claims to bypass the 24h cache. */
  const forceRefreshLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    setLeaderboardError(null);
    try {
      const rows = await getGlobalLeaderboard(3);
      setLeaderboard(rows);
      setLastLeaderboardRefresh(Date.now());
    } catch (error) {
      console.error("Error refreshing leaderboard:", error);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMissions();
      loadMissionStats();
      loadLeaderboard();
    }, [loadMissions, loadMissionStats, loadLeaderboard])
  );

  // Set up daily leaderboard refresh timer
  useEffect(() => {
    const dailyRefreshInterval = setInterval(() => {
      setLastLeaderboardRefresh(0); // Force refresh on next load
    }, 86400000); // 24 hours

    return () => clearInterval(dailyRefreshInterval);
  }, []);

  const missionProgressContext = useMemo(
    () => ({
      todayCount: missionStats?.todayCount ?? 0,
      weekCount: missionStats?.weekCount ?? 0,
    }),
    [missionStats]
  );

  const isClaimed = useCallback(
    (category: MissionCategory, missionId: string) =>
      (category === "daily" ? dailyClaimedIds : weeklyClaimedIds).includes(missionId),
    [dailyClaimedIds, weeklyClaimedIds]
  );

  const renderMissionCard = useCallback(
    (mission: Mission, category: MissionCategory, compact = false) => {
      const progress = getMissionProgress(mission, missionProgressContext);
      const claimed = isClaimed(category, mission.id);
      const isDaily = category === "daily";
      const progressColor = isDaily ? "#10b981" : "#8b5cf6";
      const safePercent = Number.isFinite(progress.percent) ? progress.percent : 0;

      return (
        <View
          key={mission.id}
          style={[
            styles.missionItem,
            compact ? styles.missionCompact : null,
            isDaily ? styles.missionDaily : styles.missionWeekly,
          ]}
        >
          <View style={styles.missionTop}>
            <Text style={[styles.missionTitle, { flex: 1 }]}>{mission.title}</Text>
            <View style={[styles.rewardBadge, isDaily ? styles.rewardBadgeDaily : styles.rewardBadgeWeekly]}>
              <Text style={styles.rewardText}>{mission.reward}</Text>
            </View>
          </View>

          <Text style={styles.missionDesc}>{mission.description}</Text>

          <View style={styles.progressHeaderRow}>
            <Text style={styles.progressLabel}>{progress.current}/{progress.target} {mission.progressLabel}</Text>
            <Text style={[styles.progressPercent, progress.completed ? styles.progressDone : null]}>
              {progress.completed ? (claimed ? "Claimed" : "Ready") : `${safePercent}%`}
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${safePercent}%`, backgroundColor: progressColor }]} />
          </View>

          <View style={styles.progressFooterRow}>
            <Text style={styles.progressHint}>
              {progress.completed
                ? claimed
                  ? `Reward added to profile`
                  : `Tap claim to add +${mission.rewardXP} EcoXP to your profile`
                : `Keep reporting to fill the bar`}
            </Text>

            {progress.completed && !claimed ? (
              <TouchableOpacity
                style={[styles.claimButton, claimingMissionId === mission.id && styles.claimButtonDisabled]}
                onPress={async () => {
                  if (claimingMissionId === mission.id) return;

                  setClaimingMissionId(mission.id);
                  try {
                    await claimMissionReward(category, mission.id);
                    await awardMissionXp(mission.rewardXP, statsUserKey);
                    // Force-refresh leaderboard immediately so updated score is reflected
                    await Promise.all([loadMissions(), loadMissionStats(), forceRefreshLeaderboard()]);
                  } catch (error) {
                    console.error("Error claiming mission reward:", error);
                  } finally {
                    setClaimingMissionId(null);
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.claimButtonText}>
                  {claimingMissionId === mission.id ? "Claiming..." : `Claim +${mission.rewardXP} EcoXP`}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      );
    },
    [claimingMissionId, forceRefreshLeaderboard, isClaimed, loadMissionStats, loadMissions, missionProgressContext, statsUserKey]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Missions & Leaderboards</Text>
        <Text style={styles.subtitle}>One mission from each is shown.</Text>
        {loadingMissionStats ? <Text style={styles.syncText}>Syncing your mission progress...</Text> : null}

        {/* Daily Missions Card */}
        <View style={[styles.card, { borderColor: "#d1fae5" }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <MaterialCommunityIcons name="target" size={20} color="#10b981" />
              <Text style={styles.cardTitle}>Daily missions</Text>
            </View>
            <TouchableOpacity 
              style={styles.showMore}
              onPress={() => setShowDailyModal(true)}
            >
              <Text style={styles.showMoreText}>Show more</Text>
            </TouchableOpacity>
          </View>
          {loadingMissions ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#10b981" />
              <Text style={styles.loadingText}>Loading missions...</Text>
            </View>
          ) : dailyMissions.length > 0 ? (
            renderMissionCard(dailyMissions[0], "daily")
          ) : (
            <Text style={styles.noMissionsText}>No daily missions available.</Text>
          )}
        </View>

        {/* Weekly Missions Card */}
        <View style={[styles.card, { borderColor: "#e9d5ff" }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="trophy" size={20} color="#c084fc" />
              <Text style={styles.cardTitle}>Weekly missions</Text>
            </View>
            <TouchableOpacity 
              style={[styles.showMore, { backgroundColor: "#faf5ff" }]}
              onPress={() => setShowWeeklyModal(true)}
            >
              <Text style={[styles.showMoreText, { color: "#9333ea" }]}>Show more</Text>
            </TouchableOpacity>
          </View>
          {loadingMissions ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#c084fc" />
              <Text style={styles.loadingText}>Loading missions...</Text>
            </View>
          ) : weeklyMissions.length > 0 ? (
            renderMissionCard(weeklyMissions[0], "weekly")
          ) : (
            <Text style={styles.noMissionsText}>No weekly missions available.</Text>
          )}
        </View>

        {/* Leaderboard */}
        <View style={[styles.card, { borderColor: "#fde68a" }]}>
          <View style={styles.cardTitleRow}>
            <MaterialCommunityIcons name="crown" size={22} color="#fbbf24" />
            <Text style={styles.cardTitle}>Leaderboards</Text>
          </View>
          <Text style={[styles.missionTitle, { color: "#059669", marginTop: 12, marginBottom: 8 }]}>Daily Top 3</Text>
          {loadingLeaderboard ? (
            <View style={styles.leaderboardStateRow}>
              <ActivityIndicator size="small" color="#059669" />
              <Text style={styles.leaderboardStateText}>Loading leaderboard...</Text>
            </View>
          ) : leaderboardError ? (
            <View style={styles.leaderboardStateRow}>
              <Text style={[styles.leaderboardStateText, { color: "#b91c1c" }]}>{leaderboardError}</Text>
            </View>
          ) : leaderboard.length === 0 ? (
            <View style={styles.leaderboardStateRow}>
              <Text style={styles.leaderboardStateText}>No player scores yet. Add reports to appear here.</Text>
            </View>
          ) : (
            leaderboard.map((e) => {
              const s = rankStyle(e.rank);
              return (
                <View key={`${e.rank}-${e.name}`} style={[styles.leaderRow, { backgroundColor: s.bg, borderColor: s.border }]}>
                  <Text style={styles.rankNum}>#{e.rank}</Text>
                  <Text style={styles.rankName}>{e.name}</Text>
                  <Text style={styles.rankScore}>{e.score.toLocaleString()}</Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Daily Missions Modal */}
      <Modal
        visible={showDailyModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowDailyModal(false)}
      >
        <SafeAreaView style={styles.safe} edges={["top"]}>
              <View style={[styles.modalHeader, { paddingTop: Math.max(12, insets.top) }]}>
            <TouchableOpacity onPress={() => setShowDailyModal(false)}>
              <Ionicons name="chevron-back" size={28} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>All Daily Missions</Text>
            <View style={{ width: 28 }} />
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {dailyMissions.map((mission) => (
              renderMissionCard(mission, "daily", true)
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Weekly Missions Modal */}
      <Modal
        visible={showWeeklyModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowWeeklyModal(false)}
      >
        <SafeAreaView style={styles.safe} edges={["top"]}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(12, insets.top) }]}>
            <TouchableOpacity onPress={() => setShowWeeklyModal(false)}>
              <Ionicons name="chevron-back" size={28} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>All Weekly Missions</Text>
            <View style={{ width: 28 }} />
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {weeklyMissions.map((mission) => (
              renderMissionCard(mission, "weekly", true)
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  missionItem: { backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: "#a7f3d0", borderRadius: 12, padding: 14, marginBottom: 12 },
  missionCompact: { marginBottom: 10 },
  missionDaily: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" },
  missionWeekly: { backgroundColor: "#faf5ff", borderColor: "#e9d5ff" },
  missionTop: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  missionTitle: { fontWeight: "600", color: "#1e293b", fontSize: 14 },
  rewardBadge: { backgroundColor: "#10b981", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 },
  rewardBadgeDaily: { backgroundColor: "#10b981" },
  rewardBadgeWeekly: { backgroundColor: "#c084fc" },
  rewardText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  missionDesc: { color: "#475569", fontSize: 12, lineHeight: 18 },
  syncText: { color: "#0f766e", fontSize: 12, marginBottom: 10 },
  progressHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, marginBottom: 6 },
  progressLabel: { color: "#0f172a", fontSize: 12, fontWeight: "600" },
  progressPercent: { color: "#475569", fontSize: 12, fontWeight: "700" },
  progressDone: { color: "#059669" },
  progressTrack: { height: 9, borderRadius: 999, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2e8f0", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  progressFooterRow: { marginTop: 10, gap: 8 },
  progressHint: { color: "#64748b", fontSize: 12, lineHeight: 18 },
  claimButton: { alignSelf: "flex-start", backgroundColor: "#0f766e", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  claimButtonDisabled: { opacity: 0.65 },
  claimButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  loadingContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 },
  loadingText: { color: "#64748b", fontSize: 13 },
  noMissionsText: { color: "#64748b", fontSize: 13, textAlign: "center", paddingVertical: 16 },
  leaderboardStateRow: { paddingVertical: 12, alignItems: "center", justifyContent: "center", gap: 8 },
  leaderboardStateText: { color: "#64748b", fontSize: 13, textAlign: "center" },
  leaderRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  rankNum: { fontWeight: "700", fontSize: 16, color: "#475569", width: 36 },
  rankName: { flex: 1, fontWeight: "600", color: "#1e293b", fontSize: 14 },
  rankScore: { fontWeight: "700", color: "#059669", fontSize: 14 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1e293b" },
  modalContent: { padding: 20, paddingBottom: 40 },
});
