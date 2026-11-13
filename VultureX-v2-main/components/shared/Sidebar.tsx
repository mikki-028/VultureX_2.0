"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Search, FileText,
  BarChart3, Bookmark, Settings, LogOut, Heart, Presentation,
  MessageSquare, Users, Trophy, Compass, ShieldCheck, BookOpen, Sparkles, Home, UserRound, ListChecks, CalendarClock,
} from "lucide-react";
import type { MessageKey } from "@/features/i18n/messages";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";
import { useUnreadBadges } from "./use-unread-badges";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LiteModeToggle } from "./LiteModeToggle";
import { useLanguage } from "./LanguageProvider";

type Role = "startup" | "investor" | "admin";

const navItems: {
  key: MessageKey;
  href: string;
  icon: typeof LayoutDashboard;
  roles?: Role[];
  badge?: "messages" | "requests";
}[] = [
  { key: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["startup", "investor"] },
  { key: "nav.forYou", href: "/knowledge-hub/for-you", icon: Sparkles, roles: ["startup"] },
  { key: "nav.founderProfile", href: "/knowledge-hub/for-you/profile", icon: UserRound, roles: ["startup"] },
  { key: "nav.roadmap", href: "/knowledge-hub/roadmap", icon: ListChecks, roles: ["startup"] },
  { key: "nav.savedResources", href: "/knowledge-hub/for-you/saved", icon: Bookmark, roles: ["startup"] },
  { key: "nav.reminders", href: "/knowledge-hub/for-you/reminders", icon: CalendarClock, roles: ["startup"] },
  { key: "nav.knowledgeHub", href: "/knowledge-hub", icon: BookOpen },
  { key: "nav.discover", href: "/discover", icon: Compass, roles: ["startup"] },
  { key: "nav.pitchDecks", href: "/admin/pitch-decks", icon: Presentation, roles: ["admin"] },
  { key: "nav.impactReview", href: "/admin/impact", icon: ShieldCheck, roles: ["admin"] },
  { key: "nav.explore", href: "/explore", icon: Search },
  { key: "nav.competitions", href: "/competitions", icon: Trophy },
  { key: "nav.investors", href: "/investors", icon: Users },
  { key: "nav.rankings", href: "/rankings", icon: BarChart3 },
  { key: "nav.interests", href: "/interests", icon: Heart, badge: "requests" },
  { key: "nav.messages", href: "/messages", icon: MessageSquare, badge: "messages" },
  { key: "nav.myDecks", href: "/pitch-decks", icon: Presentation, roles: ["startup"] },
  { key: "nav.myDecks", href: "/deck", icon: FileText, roles: ["startup"] },
  { key: "nav.savedInvestor", href: "/saved", icon: Bookmark, roles: ["investor"] },
  { key: "nav.settings", href: "/settings", icon: Settings },
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const badges = useUnreadBadges(role !== "admin");
  const { t } = useLanguage();
  const items = navItems.filter((i) => !i.roles || i.roles.includes(role));

  return (
    <aside aria-label={t("nav.label")} className="hidden md:flex flex-col w-48 border-r border-[var(--border)] shrink-0 md:sticky md:top-0 md:h-screen md:overflow-hidden">
      <div className="px-3 h-12 flex items-center justify-between border-b border-[var(--border)]">
        <Link
          href={role === "admin" ? "/admin" : "/dashboard"}
          className="flex min-w-0 items-center"
          aria-label="VultureX"
        >
          <Logo size={20} textClassName="text-[13px]" priority />
        </Link>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <NotificationBell />
        </div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const count =
            item.badge === "messages"
              ? badges.messages
              : item.badge === "requests"
                ? badges.pendingRequests
                : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
                active
                  ? "text-[var(--text)] bg-[var(--bg-elevated)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <item.icon size={14} />
              <span className="flex-1 truncate">{t(item.key)}</span>
              {count > 0 && (
                <span
                  className="min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--accent-fill)] text-[var(--accent-foreground)] text-[9px] font-bold flex items-center justify-center tabular-nums"
                  aria-label={`${count} unread`}
                >
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="px-2 py-3 border-t border-[var(--border)] space-y-0.5">
        {role === "startup" && <LanguageSwitcher />}
        <LiteModeToggle />
        <Link
          href="/"
          className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-md transition-colors"
        >
          <Home size={14} />
          {t("nav.home")}
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-md transition-colors w-full"
        >
          <LogOut size={14} />
          {t("nav.signOut")}
        </button>
      </div>
    </aside>
  );
}
