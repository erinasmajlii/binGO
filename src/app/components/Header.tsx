import { Settings, Wifi, Battery } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-emerald-100 px-4 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-700">00:46</span>
        <div className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
          <Wifi className="size-3" />
          <span>ANRI - I Ca...</span>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <button className="p-2 hover:bg-emerald-50 rounded-lg transition-colors">
          <Settings className="size-5 text-slate-600" />
        </button>
        <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full">
          <span className="text-sm font-semibold text-emerald-700">9,435</span>
        </div>
        <div className="bg-gradient-to-br from-emerald-400 to-emerald-500 px-3 py-1.5 rounded-full shadow-sm">
          <span className="text-sm font-bold text-white">Lv 7</span>
        </div>
        <div className="size-8 bg-gradient-to-br from-emerald-300 to-emerald-400 rounded-full flex items-center justify-center font-bold text-white shadow-sm">
          K
        </div>
      </div>
    </header>
  );
}