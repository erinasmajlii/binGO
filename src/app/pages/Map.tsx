import { MapPin, Navigation } from "lucide-react";

export function Map() {
  return (
    <div className="p-6 max-w-2xl mx-auto relative">
      {/* Decorative circles */}
      <div className="absolute -top-10 -left-10 size-44 bg-emerald-200/50 rounded-full blur-[60px] pointer-events-none"></div>
      <div className="absolute top-20 right-10 size-40 bg-teal-200/50 rounded-full blur-[60px] pointer-events-none"></div>
      <div className="absolute top-40 left-5 size-32 bg-blue-200/40 rounded-full blur-[50px] pointer-events-none"></div>
      <div className="absolute bottom-10 left-10 size-36 bg-emerald-300/50 rounded-full blur-[55px] pointer-events-none"></div>
      <div className="absolute bottom-20 right-20 size-28 bg-cyan-200/40 rounded-full blur-[45px] pointer-events-none"></div>
      
      <h1 className="text-3xl font-bold mb-3 text-slate-800 relative z-10">
        Map
      </h1>
      <p className="text-slate-600 mb-6 relative z-10">
        Open Google Maps to find litter hotspots and nearby drop-off points.
      </p>

      <button className="w-full bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-white font-semibold py-4 px-6 rounded-2xl shadow-md hover:shadow-lg transition-all hover:scale-[1.02] mb-6 flex items-center justify-center gap-2">
        <Navigation className="size-5" />
        Open Google Maps
      </button>

      <div className="bg-white border border-emerald-100 rounded-2xl p-8 shadow-sm min-h-[320px] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-blue-50"></div>
        <div className="relative text-center">
          <div className="inline-flex p-4 bg-gradient-to-br from-emerald-100 to-blue-100 rounded-full mb-4">
            <MapPin className="size-12 text-emerald-500" />
          </div>
          <p className="text-slate-500">
            In-app map preview will live here later.
          </p>
        </div>
      </div>
    </div>
  );
}