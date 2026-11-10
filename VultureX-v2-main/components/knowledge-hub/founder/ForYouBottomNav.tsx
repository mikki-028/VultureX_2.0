"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarClock, Home, LayoutGrid, User } from "lucide-react";
import type { MessageKey } from "@/features/i18n/messages";
import { useLanguage } from "@/components/shared/LanguageProvider";

const ITEMS: { key: MessageKey; href: string; icon: typeof Home }[] = [
  { key: "foryou.bottomHome", href: "/knowledge-hub/for-you", icon: Home },
  { key: "foryou.bottomLearn", href: "/knowledge-hub/start-business", icon: BookOpen },
  { key: "foryou.bottomOpportunities", href: "/knowledge-hub/funding", icon: CalendarClock },
  { key: "foryou.bottomHub", href: "/knowledge-hub", icon: LayoutGrid },
  { key: "foryou.bottomProfile", href: "/settings", icon: User },
];

/**
 * Founder Home bottom dock for small screens. It reuses existing routes; the
 * page reserves bottom padding so the dock never covers content.
 */
export function ForYouBottomNav() {
  const pathname = usePathname() ?? "";
  const { t } = useLanguage();

  return (
    <nav
      aria-label={t("foryou.quickNav")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors ${
                  active
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                <item.icon size={16} aria-hidden="true" />
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
