import { Flame, CheckCircle, Trash2, Target, Trophy } from "lucide-react";

export function Home() {
  return (
    <div className="p-6 max-w-2xl mx-auto relative">
      {/* Decorative circles */}
      <div className="absolute -top-10 -right-10 size-48 bg-emerald-200/50 rounded-full blur-[60px] pointer-events-none"></div>
      <div className="absolute top-5 right-20 size-32 bg-emerald-300/40 rounded-full blur-[50px] pointer-events-none"></div>
      <div className="absolute top-60 -left-5 size-40 bg-blue-200/50 rounded-full blur-[55px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 size-36 bg-teal-200/40 rounded-full blur-[50px] pointer-events-none"></div>
      
      <div className="mb-6 relative z-10">
        <p className="text-sm text-emerald-600 font-medium mb-2">HOME</p>
        <h1 className="text-4xl font-bold mb-3 text-slate-800">
          Your impact, today.
        </h1>
        <p className="text-slate-600">
          Quick snapshot of your eco progress. Report trash, complete missions, and climb the ranks.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-orange-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-gradient-to-br from-orange-300 to-orange-400 rounded-lg shadow-sm">
              <Flame className="size-5 text-white" />
            </div>
            <span className="text-sm text-orange-600 font-medium">STREAK</span>
          </div>
          <div className="text-3xl font-bold mb-1 text-slate-800">7 days</div>
          <div className="text-sm text-slate-500">Keep it going</div>
        </div>

        <div className="bg-white border border-blue-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-gradient-to-br from-blue-300 to-blue-400 rounded-lg shadow-sm">
              <CheckCircle className="size-5 text-white" />
            </div>
            <span className="text-sm text-blue-600 font-medium">CLEANUPS</span>
          </div>
          <div className="text-3xl font-bold mb-1 text-slate-800">50</div>
          <div className="text-sm text-slate-500">Verified missions</div>
        </div>
      </div>

      <div className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-800">
          <Target className="size-5 text-emerald-500" />
          Suggested next actions
        </h2>
        
        <div className="space-y-3">
          <button className="w-full bg-gradient-to-br from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 border border-emerald-200 rounded-xl p-4 text-left transition-all shadow-sm hover:shadow-md group">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-lg group-hover:scale-110 transition-transform shadow-sm">
                <Trash2 className="size-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-semibold mb-1 text-slate-800">Report nearby trash</div>
                <div className="text-sm text-slate-600">Fastest way to gain EcoXP</div>
              </div>
            </div>
          </button>

          <button className="w-full bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 border border-purple-200 rounded-xl p-4 text-left transition-all shadow-sm hover:shadow-md group">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-300 to-purple-400 rounded-lg group-hover:scale-110 transition-transform shadow-sm">
                <Trophy className="size-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-semibold mb-1 text-slate-800">Complete a mission</div>
                <div className="text-sm text-slate-600">Bonus points + leaderboard boosts</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}