"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import {
  Bookmark,
  BookOpen,
  CalendarClock,
  Compass,
  Heart,
  Home,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageSquare,
  Presentation,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { MessageKey } from "@/features/i18n/messages";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { useUnreadBadges } from "./use-unread-badges";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LiteModeToggle } from "./LiteModeToggle";
import { Logo } from "./Logo";
import { useLanguage } from "./LanguageProvider";

type Role = "startup" | "investor" | "admin";

export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const badges = useUnreadBadges(role !== "admin");
  const { t } = useLanguage();

  const items = (
    role === "admin"
      ? [
          { key: "nav.pitchDecks", href: "/admin/pitch-decks", icon: Presentation },
          { key: "nav.impactReview", href: "/admin/impact", icon: ShieldCheck },
          { key: "nav.competitions", href: "/admin/competitions", icon: Trophy },
          { key: "nav.explore", href: "/explore", icon: Search },
          { key: "nav.knowledgeHub", href: "/knowledge-hub", icon: BookOpen },
          { key: "nav.settings", href: "/settings", icon: Settings },
        ]
      : [
          { key: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
          ...(role === "startup"
            ? [
                { key: "nav.forYou", href: "/knowledge-hub/for-you", icon: Sparkles },
                {
                  key: "nav.founderProfile",
                  href: "/knowledge-hub/for-you/profile",
                  icon: UserRound,
                },
                { key: "nav.roadmap", href: "/knowledge-hub/roadmap", icon: ListChecks },
                {
                  key: "nav.savedResources",
                  href: "/knowledge-hub/for-you/saved",
                  icon: Bookmark,
                },
                {
                  key: "nav.reminders",
                  href: "/knowledge-hub/for-you/reminders",
                  icon: CalendarClock,
                },
                { key: "nav.discover", href: "/discover", icon: Compass },
              ]
            : []),
          { key: "nav.explore", href: "/explore", icon: Search },
          { key: "nav.knowledgeHub", href: "/knowledge-hub", icon: BookOpen },
          { key: "nav.competitions", href: "/competitions", icon: Trophy },
          { key: "nav.investors", href: "/investors", icon: Users },
          { key: "nav.interests", href: "/interests", icon: Heart, count: badges.pendingRequests },
          { key: "nav.messages", href: "/messages", icon: MessageSquare, count: badges.messages },
          { key: "nav.settings", href: "/settings", icon: Settings },
        ]
  ) as { key: MessageKey; href: string; icon: typeof Heart; count?: number }[];

  return (
    <header className="md:hidden sticky top-0 z-50 bg-[var(--bg)]/95 backdrop-blur border-b border-[var(--border)]">
      <div className="h-12 px-4 flex items-center justify-between">
        <Link
          href={role === "admin" ? "/admin" : "/dashboard"}
          className="flex min-w-0 items-center"
          aria-label="VultureX"
          onClick={() => setOpen(false)}
        >
          <Logo size={20} textClassName="text-[13px]" priority />
        </Link>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <NotificationBell />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={t("nav.toggle")}
            aria-expanded={open}
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="px-2 pb-3 pt-1 border-t border-[var(--border)] space-y-0.5 max-h-[calc(100vh-3rem)] overflow-y-auto">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 px-3 py-2 text-xs rounded-md transition-colors ${
                  active
                    ? "text-[var(--text)] bg-[var(--bg-elevated)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                <item.icon size={14} />
                <span className="flex-1">{t(item.key)}</span>
                {!!item.count && item.count > 0 && (
                  <span className="min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--accent-fill)] text-[var(--accent-foreground)] text-[9px] font-bold flex items-center justify-center tabular-nums">
                    {item.count > 9 ? "9+" : item.count}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="mt-1 pt-2 border-t border-[var(--border)] space-y-0.5">
            {role === "startup" && <LanguageSwitcher />}
            <LiteModeToggle />
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-md transition-colors"
            >
              <Home size={14} />
              {t("nav.home")}
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] rounded-md transition-colors"
            >
              <LogOut size={14} />
              {t("nav.signOut")}
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
