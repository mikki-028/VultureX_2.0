import Link from "next/link";
import { ArrowRight, Bookmark, CalendarClock } from "lucide-react";
import type { ReminderSummary } from "@/features/reminders/types";
import { translatorFor, type Locale } from "@/features/i18n/messages";

export function WorkspaceTools({
  savedCount,
  reminders,
  locale = "en",
}: {
  savedCount: number;
  reminders: ReminderSummary;
  locale?: Locale;
}) {
  const t = translatorFor(locale);
  const due = reminders.overdue + reminders.dueToday;

  return (
    <section aria-labelledby="workspace-tools-heading" className="vx-card p-5">
      <p className="vx-label">{t("foryou.workspace")}</p>
      <h2 id="workspace-tools-heading" className="mt-1 text-sm font-semibold tracking-tight">
        {t("foryou.savedAndReminders")}
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
        {t("foryou.savedAndRemindersBody")}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Link
          href="/knowledge-hub/for-you/saved"
          className="vx-inset group flex items-start justify-between gap-3 p-3 transition-colors hover:border-[var(--border-hover)]"
        >
          <div className="flex items-start gap-2.5">
            <Bookmark size={14} className="mt-0.5 text-[var(--accent)]" aria-hidden="true" />
            <div>
              <p className="text-[11px] font-medium">{t("foryou.savedResources")}</p>
              <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                {savedCount === 0
                  ? t("foryou.noSaved")
                  : t(savedCount === 1 ? "foryou.savedCountOne" : "foryou.savedCountMany", {
                      count: savedCount,
                    })}
              </p>
            </div>
          </div>
          <ArrowRight
            size={11}
            className="mt-1 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--accent)]"
            aria-hidden="true"
          />
        </Link>

        <Link
          href="/knowledge-hub/for-you/reminders"
          className="vx-inset group flex items-start justify-between gap-3 p-3 transition-colors hover:border-[var(--border-hover)]"
        >
          <div className="flex items-start gap-2.5">
            <CalendarClock size={14} className="mt-0.5 text-[var(--accent)]" aria-hidden="true" />
            <div>
              <p className="text-[11px] font-medium">{t("foryou.reminders")}</p>
              <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                {reminders.total === 0
                  ? t("foryou.noReminders")
                  : due > 0
                    ? t("foryou.overdueDue", {
                        overdue: reminders.overdue,
                        today: reminders.dueToday,
                      })
                    : t("foryou.upcomingCompleted", {
                        upcoming: reminders.upcoming,
                        completed: reminders.completed,
                      })}
              </p>
            </div>
          </div>
          <ArrowRight
            size={11}
            className="mt-1 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--accent)]"
            aria-hidden="true"
          />
        </Link>
      </div>
    </section>
  );
}
