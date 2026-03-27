import { Camera, CheckCircle } from "lucide-react";

export function Report() {
  return (
    <div className="p-6 max-w-2xl mx-auto relative">
      {/* Decorative circles */}
      <div className="absolute -top-5 -left-10 size-44 bg-emerald-200/50 rounded-full blur-[65px] pointer-events-none"></div>
      <div className="absolute top-5 left-5 size-36 bg-green-200/50 rounded-full blur-[60px] pointer-events-none"></div>
      <div className="absolute top-40 right-5 size-32 bg-teal-200/40 rounded-full blur-[50px] pointer-events-none"></div>
      <div className="absolute bottom-20 right-5 size-40 bg-emerald-300/50 rounded-full blur-[55px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-10 size-28 bg-cyan-200/40 rounded-full blur-[45px] pointer-events-none"></div>
      
      <h1 className="text-3xl font-bold mb-3 text-slate-800 relative z-10">
        Report Trash
      </h1>
      <p className="text-slate-600 mb-6 relative z-10">
        Snap a photo of litter to earn EcoXP. (Camera temporarily disabled.)
      </p>

      <button className="w-full bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold py-4 px-6 rounded-2xl shadow-md hover:shadow-lg transition-all hover:scale-[1.02] mb-6 flex items-center justify-center gap-2">
        <Camera className="size-5" />
        Open Camera
      </button>

      <div className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
          <CheckCircle className="size-5 text-emerald-500" />
          Tips for better reports
        </h2>
        
        <ul className="space-y-3 text-slate-600">
          <li className="flex items-start gap-3">
            <div className="size-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0"></div>
            <span>Make sure the trash is clearly visible</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="size-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0"></div>
            <span>Include a bit of the surrounding context</span>
          </li>
          <li className="flex items-start gap-3">
            <div className="size-2 rounded-full bg-emerald-400 mt-2 flex-shrink-0"></div>
            <span>Avoid motion blur</span>
          </li>
        </ul>
      </div>
    </div>
  );
}