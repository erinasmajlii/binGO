import { Target, Trophy, Crown, Medal, Award } from "lucide-react";

export function Missions() {
  const dailyMissions = [
    {
      title: "Spot & report 1 trash pile",
      description: "Capture one clear photo of litter in your area.",
      reward: "+120 EcoXP",
    },
  ];

  const weeklyMissions = [
    {
      title: "5 verified cleanups",
      description: "Complete five verified cleanup missions this week.",
      reward: "+1,200 EcoXP",
    },
  ];

  const leaderboardDaily = [
    { rank: 1, name: "Aylin", score: 1420 },
    { rank: 2, name: "Mert", score: 1280 },
    { rank: 3, name: "Kenan", score: 1190 },
  ];

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

      {/* Daily Missions */}
      <div className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
            <Target className="size-5 text-emerald-500" />
            Daily missions
          </h2>
          <button className="text-sm px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors">
            Show more
          </button>
        </div>
        
        {dailyMissions.map((mission, index) => (
          <div key={index} className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="font-semibold flex-1 text-slate-800">{mission.title}</h3>
              <span className="bg-gradient-to-r from-emerald-400 to-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                {mission.reward}
              </span>
            </div>
            <p className="text-sm text-slate-600">{mission.description}</p>
          </div>
        ))}
      </div>

      {/* Weekly Missions */}
      <div className="bg-white border border-purple-100 rounded-2xl p-6 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
            <Trophy className="size-5 text-purple-400" />
            Weekly missions
          </h2>
          <button className="text-sm px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg transition-colors">
            Show more
          </button>
        </div>
        
        {weeklyMissions.map((mission, index) => (
          <div key={index} className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="font-semibold flex-1 text-slate-800">{mission.title}</h3>
              <span className="bg-gradient-to-r from-purple-300 to-purple-400 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                {mission.reward}
              </span>
            </div>
            <p className="text-sm text-slate-600">{mission.description}</p>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="bg-white border border-amber-100 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-1 flex items-center gap-2 text-slate-800">
          <Crown className="size-6 text-amber-400" />
          Leaderboards
        </h2>
        
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-3 text-emerald-600">Daily</h3>
          <div className="space-y-2">
            {leaderboardDaily.map((entry) => (
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
        </div>
      </div>
    </div>
  );
}