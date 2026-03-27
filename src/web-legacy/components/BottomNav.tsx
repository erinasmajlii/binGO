import { Home, Map, Camera, Trophy, User } from "lucide-react";
import { Link, useLocation } from "react-router";

export function BottomNav() {
  const location = useLocation();
  
  const navItems = [
    { path: "/", icon: Home, label: "Home" },
    { path: "/map", icon: Map, label: "Map" },
    { path: "/report", icon: Camera, label: "Report" },
    { path: "/missions", icon: Trophy, label: "Missions" },
    { path: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-emerald-100 shadow-lg">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className="flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all"
            >
              <div className={`p-2 rounded-xl transition-all ${
                isActive 
                  ? "bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-md" 
                  : "text-slate-400 hover:text-emerald-600"
              }`}>
                <Icon className="size-5" />
              </div>
              <span className={`text-xs ${isActive ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}