import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, Play, Layers, BookOpen, Sparkles, Settings, Package } from "lucide-react";

const navItems = [
  { page: "Home", label: "Home", icon: Home },
  { page: "LaundryMode", label: "Laundry", icon: Play },
  { page: "Loads", label: "Loads", icon: Layers },
  { page: "Supplies", label: "Supplies", icon: Package },
  { page: "Assistant", label: "Assistant", icon: Sparkles },
  { page: "Settings", label: "Settings", icon: Settings },
];

export default function Layout({ children, currentPageName }) {
  // Hide nav during onboarding-like flows or laundry mode
  const hideNav = false;

  return (
    <div className="min-h-screen bg-background">
      <main>{children}</main>

      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-border/50 z-50 safe-area-pb">
          <div className="max-w-lg mx-auto flex items-center justify-around py-2 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all ${
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.5} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}