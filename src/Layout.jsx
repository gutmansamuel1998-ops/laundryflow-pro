import React, { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import FeedbackModal from "@/components/FeedbackModal";
import SessionReminderEngine from "@/components/notifications/SessionReminderEngine";
import NativeNotificationSync from "@/components/notifications/NativeNotificationSync";
import { createPageUrl } from "@/utils";
import { applyPrefsToDocument, hasSavedPrefs, seedPrefsFromUser } from "@/lib/sessionPrefs";
import { Home, Play, Settings } from "lucide-react";

// V1 navigation: three destinations only. The previous seven-item menu is preserved in
// src/legacy/LayoutLegacy.jsx, and every earlier page still works at its own URL.
const navItems = [
  { page: "Home", label: "Home", icon: Home },
  { page: "Session", label: "Laundry Session", icon: Play },
  { page: "SettingsCare", label: "Settings & Care", icon: Settings },
];

export default function Layout({ children, currentPageName }) {
  const navRef = useRef(null);

  // Keep keyboard focus out from behind the fixed bottom navigation (WCAG 2.2 SC 2.4.11).
  // The nav's real height changes with text size, so measure it and publish it as a CSS
  // variable; index.css uses it as the document's scroll-padding-bottom.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const root = document.documentElement;
    const publish = () => root.style.setProperty("--bottom-nav-h", `${Math.ceil(nav.getBoundingClientRect().height)}px`);
    publish();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(publish);
    observer.observe(nav);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--bottom-nav-h");
    };
  }, []);

  useEffect(() => {
    // Accessibility preferences apply instantly from this device. On a brand-new device,
    // adopt the values already saved on the account (text size, contrast, font, motion).
    applyPrefsToDocument();
    if (!hasSavedPrefs()) {
      base44.auth.me().then(seedPrefsFromUser).catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Skip navigation link — WCAG 2.4.1 */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <SessionReminderEngine currentPageName={currentPageName} />
      <NativeNotificationSync />
      <main id="main-content">{children}</main>

      <FeedbackModal />
      <nav ref={navRef} aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 bg-background border-t-2 border-border z-50 safe-area-pb">
        {/* P8.7: labels may wrap onto a second line at large text, and the bar grows with them (Layout publishes its measured
            height). Columns are equal when there is room, but never narrower than their longest word (min-w-min), so a
            label is never clipped or overlapped. Padding is small and in rem so all three whole labels, including
            "Settings & Care", fit side by side on a 320 px screen at 200% text without shrinking the text. If a screen is
            ever too narrow for that, flex-wrap moves an item to a second row instead of overflowing. */}
        <ul className="max-w-lg mx-auto flex flex-wrap items-stretch justify-around px-0.5 py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPageName === item.page;
            return (
              <li key={item.page} className="min-w-min flex-1">
                <Link
                  to={createPageUrl(item.page)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex flex-col items-center justify-center gap-1 min-h-[60px] rounded-xl px-0.5 py-2 text-center ${
                    isActive ? "bg-secondary font-bold text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-6 h-6" aria-hidden="true" strokeWidth={isActive ? 2.5 : 1.75} />
                  <span className="min-w-0 break-words text-xs leading-tight">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
