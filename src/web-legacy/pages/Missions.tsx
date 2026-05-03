import { useState, useEffect, useCallback, useMemo } from "react";
import { Target, Trophy, Crown, ChevronDown, ChevronUp, Loader } from "lucide-react";
import { getGlobalLeaderboard, LeaderboardEntry, getCaptureStats, awardMissionXp } from "../../lib/trashStats";
import { getSupabaseConfigIssue, checkSupabaseReachable, supabase } from "../../lib/supabase";
import {
  getDailyMissionState,
  getWeeklyMissionState,
  Mission,
  MissionCategory,
  getMissionProgress,
  claimMissionReward,
} from "../../lib/missions";

export function Missions() {
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
  
  const [showAllDaily, setShowAllDaily] = useState(false);
  const [showAllWeekly, setShowAllWeekly] = useState(false);
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
    return lastLeaderboardRefresh === 0 || timeSinceLastRefresh >= 86400000;
  }, [lastLeaderboardRefresh]);

  const loadLeaderboard = useCallback(async () => {
    if (!shouldRefreshLeaderboard()) {
      return;
    }

    setLoadingLeaderboard(true);
    setLeaderboardError(null);
    const configIssue = getSupabaseConfigIssue();
    if (configIssue) {
      setLeaderboard([]);
      setLeaderboardError(configIssue);
      setLoadingLeaderboard(false);
      return;
    }

    try {
      const reach = await checkSupabaseReachable(3000);
      if (reach) {
        setLeaderboardError(reach);
        setLoadingLeaderboard(false);
        return;
      }
    } catch {
      // ignore
    }
    try {
      const rows = await getGlobalLeaderboard(3);
      setLeaderboard(rows);
      setLastLeaderboardRefresh(Date.now());
    } catch (error) {
      console.error("Error loading leaderboard:", error);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, [shouldRefreshLeaderboard]);

  useEffect(() => {
    loadMissions();
    loadMissionStats();
    loadLeaderboard();
  }, [loadMissions, loadMissionStats, loadLeaderboard]);

  useEffect(() => {
    const dailyRefreshInterval = setInterval(() => {
      setLastLeaderboardRefresh(0);
    }, 86400000);

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

  const renderMissionCard = useCallback((mission: Mission, category: MissionCategory, isMissionItem: boolean = false) => {
    const isDaily = category === "daily";
    const progress = getMissionProgress(mission, missionProgressContext);
    const claimed = isClaimed(category, mission.id);
    const progressColor = isDaily ? "#10b981" : "#8b5cf6";
    const safePercent = Number.isFinite(progress.percent) ? progress.percent : 0;

    return (
      <div
        key={mission.id}
        className={`${
          isMissionItem
            ? "bg-gradient-to-br border rounded-xl p-4"
            : "bg-gradient-to-br border rounded-xl p-4 mb-3"
        } ${
          isDaily
            ? "from-emerald-50 to-emerald-100 border-emerald-200"
            : "from-purple-50 to-purple-100 border-purple-200"
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-semibold flex-1 text-slate-800">{mission.title}</h3>
          <span
            className={`text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm ${
              isDaily
                ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                : "bg-gradient-to-r from-purple-300 to-purple-400"
            }`}
          >
            {mission.reward}
          </span>
        </div>
        <p className="text-sm text-slate-600">{mission.description}</p>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-slate-700">
          <span>{progress.current}/{progress.target} {mission.progressLabel}</span>
          <span className={progress.completed ? "text-emerald-600" : "text-slate-500"}>
            {progress.completed ? (claimed ? "Claimed" : "Ready") : `${safePercent}%`}
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-white border border-slate-200 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${safePercent}%`, backgroundColor: progressColor }} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-slate-500">
            {progress.completed
              ? claimed
                ? "Reward added to profile"
                : `Claim to add +${mission.rewardXP} EcoXP to your profile`
              : "Keep reporting to fill the bar"}
          </p>
          {progress.completed && !claimed ? (
            <button
              onClick={async () => {
                if (claimingMissionId === mission.id) return;

                setClaimingMissionId(mission.id);
                try {
                  await claimMissionReward(category, mission.id);
                  await awardMissionXp(mission.rewardXP, statsUserKey);
                  await Promise.all([loadMissions(), loadMissionStats()]);
                } catch (error) {
                  console.error("Error claiming mission reward:", error);
                } finally {
                  setClaimingMissionId(null);
                }
              }}
              disabled={claimingMissionId === mission.id}
              className="inline-flex items-center rounded-full bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-800 disabled:opacity-60"
            >
              {claimingMissionId === mission.id ? "Claiming..." : `Claim +${mission.rewardXP} EcoXP`}
            </button>
          ) : null}
        </div>
      </div>
    );
  }, [claimingMissionId, isClaimed, loadMissions, loadMissionStats, missionProgressContext, statsUserKey]);

  return (
    <div className="p-6 max-w-2xl mx-auto relative">
      {/* Decorative circles */}
      <div className="absolute -top-5 right-20 size-48 bg-purple-200/50 rounded-full blur-[70px] pointer-events-none"></div>
      <div className="absolute top-10 -left-10 size-40 bg-emerald-200/50 rounded-full blur-[60px] pointer-events-none"></div>
      <div className="absolute top-80 left-10 size-32 bg-emerald-300/50 rounded-full blur-[55px] pointer-events-none"></div>
      <div className="absolute top-96 right-5 size-36 bg-pink-200/40 rounded-full blur-[55px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 size-40 bg-amber-200/50 rounded-full blur-[60px] pointer-events-none"></div>
      <div className="absolute bottom-40 left-5 size-28 bg-blue-200/40 rounded-full blur-[45px] pointer-events-none"></div>
      
      <h1 className="text-3xl font-bold mb-3 text-slate-800 relative z-10">
        Missions & Leaderboards
      </h1>
      <p className="text-slate-600 mb-6 relative z-10">
        One mission from each is shown. Tap "Show more" to expand.
      </p>
      {loadingMissionStats ? <p className="text-teal-700 text-sm mb-4 relative z-10">Syncing your mission progress...</p> : null}

      {/* Daily Missions */}
      <div className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
            <Target className="size-5 text-emerald-500" />
            Daily missions
          </h2>
          <button
            onClick={() => setShowAllDaily(!showAllDaily)}
            className="text-sm px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors flex items-center gap-2"
          >
            {showAllDaily ? (
              <>
                Show less <ChevronUp className="size-4" />
              </>
            ) : (
              <>
                Show more <ChevronDown className="size-4" />
              </>
            )}
          </button>
        </div>

        {loadingMissions ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader className="size-5 text-emerald-500 animate-spin" />
            <span className="text-slate-600">Loading missions...</span>
          </div>
        ) : dailyMissions.length > 0 ? (
          <>
            {renderMissionCard(dailyMissions[0], "daily")}
            {showAllDaily && dailyMissions.length > 1 && (
              <div className="mt-3 space-y-3">
                {dailyMissions.slice(1).map((mission) => renderMissionCard(mission, "daily", true))}
              </div>
            )}
          </>
        ) : (
          <p className="text-slate-600 text-center py-4">No daily missions available.</p>
        )}
      </div>

      {/* Weekly Missions */}
      <div className="bg-white border border-purple-100 rounded-2xl p-6 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
            <Trophy className="size-5 text-purple-400" />
            Weekly missions
          </h2>
          <button
            onClick={() => setShowAllWeekly(!showAllWeekly)}
            className="text-sm px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg transition-colors flex items-center gap-2"
          >
            {showAllWeekly ? (
              <>
                Show less <ChevronUp className="size-4" />
              </>
            ) : (
              <>
                Show more <ChevronDown className="size-4" />
              </>
            )}
          </button>
        </div>

        {loadingMissions ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader className="size-5 text-purple-400 animate-spin" />
            <span className="text-slate-600">Loading missions...</span>
          </div>
        ) : weeklyMissions.length > 0 ? (
          <>
            {renderMissionCard(weeklyMissions[0], "weekly")}
            {showAllWeekly && weeklyMissions.length > 1 && (
              <div className="mt-3 space-y-3">
                {weeklyMissions.slice(1).map((mission) => renderMissionCard(mission, "weekly", true))}
              </div>
            )}
          </>
        ) : (
          <p className="text-slate-600 text-center py-4">No weekly missions available.</p>
        )}
      </div>

      {/* Leaderboard */}
      <div className="bg-white border border-amber-100 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-1 flex items-center gap-2 text-slate-800">
          <Crown className="size-6 text-amber-400" />
          Leaderboards
        </h2>

        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-3 text-emerald-600">Daily Top 3</h3>
          {loadingLeaderboard ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader className="size-5 text-emerald-500 animate-spin" />
              <span className="text-slate-600">Loading leaderboard...</span>
            </div>
          ) : leaderboardError ? (
            <div className="text-center py-4 text-red-600">{leaderboardError}</div>
          ) : leaderboard.length === 0 ? (
            <p className="text-slate-600 text-center py-4">No player scores yet. Add reports to appear here.</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry) => (
                <div
                  key={entry.rank}
                  className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                    entry.rank === 1
                      ? "bg-gradient-to-r from-amber-100 to-amber-50 border border-amber-200"
                      : entry.rank === 2
                      ? "bg-gradient-to-r from-slate-100 to-slate-50 border border-slate-200"
                      : entry.rank === 3
                      ? "bg-gradient-to-r from-orange-100 to-orange-50 border border-orange-200"
                      : "bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg w-8 text-slate-700">#{entry.rank}</span>
                    <span className="font-medium text-slate-800">{entry.name}</span>
                  </div>
                  <span className="font-bold text-emerald-600">{entry.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}