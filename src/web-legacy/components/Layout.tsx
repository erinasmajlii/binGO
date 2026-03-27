import { Outlet } from "react-router";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";

export function Layout() {
  return (
    <div className="size-full bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 text-slate-800 flex flex-col relative overflow-hidden">
      {/* Decorative Background Blotches */}
      <div className="absolute top-10 right-20 size-64 bg-emerald-200/50 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute top-40 left-10 size-48 bg-blue-200/50 rounded-full blur-[80px] pointer-events-none"></div>
      <div className="absolute bottom-20 right-40 size-56 bg-teal-200/50 rounded-full blur-[90px] pointer-events-none"></div>
      <div className="absolute bottom-40 left-20 size-40 bg-green-200/50 rounded-full blur-[70px] pointer-events-none"></div>
      <div className="absolute top-1/2 right-10 size-32 bg-emerald-300/40 rounded-full blur-[60px] pointer-events-none"></div>
      
      <Header />
      <main className="flex-1 overflow-y-auto pb-20 relative z-10">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}