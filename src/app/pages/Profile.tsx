import { useState } from "react";
import { User, Camera, Zap, Target, Flame, Sprout, Trash2, Sparkles } from "lucide-react";

export function Profile() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  if (!isLoggedIn) {
    return (
      <div className="p-6 max-w-md mx-auto flex items-center justify-center min-h-[calc(100vh-200px)] relative">
        {/* Decorative circles */}
        <div className="absolute -top-10 -left-10 size-44 bg-emerald-200/50 rounded-full blur-[65px] pointer-events-none"></div>
        <div className="absolute top-20 right-10 size-40 bg-emerald-300/50 rounded-full blur-[60px] pointer-events-none"></div>
        <div className="absolute bottom-40 left-5 size-36 bg-blue-200/50 rounded-full blur-[55px] pointer-events-none"></div>
        <div className="absolute bottom-10 right-5 size-32 bg-teal-200/40 rounded-full blur-[50px] pointer-events-none"></div>
        
        <div className="w-full bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm relative z-10">
          <h2 className="text-2xl font-bold mb-4 text-slate-800">Login</h2>
          <p className="text-sm text-slate-500 mb-4">
            Backend is not connected yet. This is local mock auth.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-600 font-medium block mb-2">EMAIL</label>
              <input
                type="email"
                placeholder="name@example.com"
                className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            
            <div>
              <label className="text-sm text-slate-600 font-medium block mb-2">PASSWORD</label>
              <input
                type="password"
                placeholder="Enter password"
                className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            
            <button
              onClick={() => setIsLoggedIn(true)}
              className="w-full bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold py-3 rounded-xl shadow-md transition-all hover:scale-[1.02]"
            >
              Login
            </button>
            
            <button
              onClick={() => setIsLoggedIn(true)}
              className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 py-3 rounded-xl transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto relative">
      {/* Decorative circles */}
      <div className="absolute -top-5 -left-10 size-44 bg-emerald-200/50 rounded-full blur-[65px] pointer-events-none"></div>
      <div className="absolute top-10 left-10 size-36 bg-emerald-300/50 rounded-full blur-[60px] pointer-events-none"></div>
      <div className="absolute top-60 right-10 size-32 bg-purple-200/50 rounded-full blur-[55px] pointer-events-none"></div>
      <div className="absolute top-96 left-5 size-28 bg-pink-200/40 rounded-full blur-[45px] pointer-events-none"></div>
      <div className="absolute bottom-20 left-20 size-40 bg-blue-200/50 rounded-full blur-[60px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-5 size-36 bg-teal-200/40 rounded-full blur-[50px] pointer-events-none"></div>
      
      {/* Profile Header */}
      <div className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm mb-4 relative z-10">
        <div className="flex items-center gap-4 mb-6">
          <div className="size-16 bg-gradient-to-br from-emerald-300 to-emerald-400 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-sm">
            G
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-500 mb-1">USERNAME</p>
            <input
              type="text"
              defaultValue="Guest"
              className="text-xl font-semibold bg-transparent border-none focus:outline-none focus:ring-0 w-full text-slate-800"
            />
          </div>
        </div>

        {/* EcoXP Progress */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-5">
          <h3 className="text-lg font-bold mb-1 text-slate-800">Total EcoXP</h3>
          <div className="text-4xl font-bold mb-2 text-emerald-600">
            98,500
          </div>
          <p className="text-sm text-slate-600 mb-3">
            Level 7 • 110,000 needed for next level
          </p>
          <div className="relative h-3 bg-emerald-100 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-300 to-pink-300 rounded-full shadow-sm"
              style={{ width: "90%" }}
            ></div>
          </div>
          <p className="text-xs text-slate-500 mt-2">90% to level 8</p>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm mb-4">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
          <Zap className="size-5 text-amber-400" />
          Stats
        </h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Camera className="size-4 text-blue-500" />
              <span className="text-xs text-blue-600 font-medium">PHOTOS</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">128</div>
            <div className="text-xs text-slate-500">Photos uploaded</div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="size-4 text-purple-500" />
              <span className="text-xs text-purple-600 font-medium">RATE</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">3.4</div>
            <div className="text-xs text-slate-500">Daily rate</div>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="size-4 text-emerald-500" />
              <span className="text-xs text-emerald-600 font-medium">MISSIONS</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">42</div>
            <div className="text-xs text-slate-500">Missions</div>
          </div>
          
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="size-4 text-orange-500" />
              <span className="text-xs text-orange-600 font-medium">STREAK</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">7</div>
            <div className="text-xs text-slate-500">Streak</div>
          </div>
        </div>
      </div>

      {/* Badges */}
      <div className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
          <Target className="size-5 text-amber-400" />
          Badges
        </h3>
        
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4 flex flex-col items-center text-center">
            <div className="size-12 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-full flex items-center justify-center mb-2 shadow-sm">
              <Trash2 className="size-6 text-white" />
            </div>
            <span className="text-xs font-semibold text-slate-700">Recycler</span>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-4 flex flex-col items-center text-center">
            <div className="size-12 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center mb-2 shadow-sm">
              <Sprout className="size-6 text-white" />
            </div>
            <span className="text-xs font-semibold text-slate-700">Sprout</span>
          </div>
          
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-4 flex flex-col items-center text-center">
            <div className="size-12 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center mb-2 shadow-sm">
              <Sparkles className="size-6 text-white" />
            </div>
            <span className="text-xs font-semibold text-slate-700">Sweeper</span>
          </div>
        </div>
      </div>
    </div>
  );
}