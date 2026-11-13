import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Clock,
  Info,
  Leaf,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { Logo } from "@/components/shared/Logo";
import { translatorFor, type Locale, type MessageKey } from "@/features/i18n/messages";

export type FounderAction = {
  title: string;
  description: string;
  why: string;
  priority: "High" | "Medium";
  time: string;
  category: string;
  href: string;
  cta: string;
};

export type FounderMetric = {
  label: string;
  value: string | number;
  hint?: string;
};

export type LearningItem = {
  title: string;
  category: string;
  href: string;
  /** Only present when a real learning record stores a percentage. */
  percent?: number;
};

export type OpportunityItem = {
  id: string;
  title: string;
  status: string;
  deadline: Date | null;
};

const DEADLINE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDeadline(value: Date | null): string | null {
  if (!value) return null;
  return DEADLINE_FORMAT.format(value);
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

export function FounderTopBar({
  stage,
  initial,
  profileHref,
  locale = "en",
}: {
  stage: string | null;
  initial: string;
  profileHref: string;
  locale?: Locale;
}) {
  const t = translatorFor(locale);
  return (
    <div className="mb-5 flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
      <div className="flex items-center gap-2">
        <Logo size={16} textClassName="text-xs" />
        <span className="h-3 w-px bg-[var(--border)]" aria-hidden="true" />
        <span className="vx-label">{t("foryou.eyebrow")}</span>
      </div>

      <div className="flex items-center gap-2">
        {stage && (
          <span className="hidden rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] sm:inline">
            {stage}
          </span>
        )}
        <NotificationBell />
        <Link
          href={profileHref}
          aria-label={t("foryou.profileAria")}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--accent)]/30 bg-[var(--accent-muted)] text-[10px] font-semibold text-[var(--accent)]"
        >
          {initial}
        </Link>
      </div>
    </div>
  );
}

export function WelcomeCard({
  name,
  stage,
  tagline,
  sector,
  signedIn,
  profileHref,
  objective,
  language,
  editProfileHref,
  locale = "en",
}: {
  name: string | null;
  stage: string | null;
  tagline: string | null;
  sector: string | null;
  signedIn: boolean;
  profileHref: string | null;
  objective?: string | null;
  language?: string | null;
  editProfileHref?: string | null;
  locale?: Locale;
}) {
  const t = translatorFor(locale);
  return (
    <section className="vx-card relative overflow-hidden p-5">
      <div
        className="vx-decorative pointer-events-none absolute -right-14 -top-20 h-44 w-44 rounded-full bg-[var(--accent-muted)]"
        aria-hidden="true"
      />
      <div className="relative">
        <p className="vx-label">{t(signedIn ? "foryou.welcomeBack" : "foryou.workspace")}</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
          {signedIn && name ? t("foryou.welcomeName", { name }) : t("foryou.workspaceTitle")}
        </h1>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-[var(--text-secondary)]">
          {tagline ||
            t(signedIn ? "foryou.emptyTagline" : "foryou.emptySignedOut")}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {stage && (
            <span className="rounded border border-[var(--accent)]/25 bg-[var(--accent-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
              {stage}
            </span>
          )}
          {sector && (
            <span className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
              {sector}
            </span>
          )}
          {objective && (
            <span className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
              {objective}
            </span>
          )}
          {language && language !== "English" && (
            <span className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
              {language}
            </span>
          )}
          {profileHref && (
            <Link
              href={profileHref}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)]"
            >
              {t("foryou.viewProfile")}
              <ArrowUpRight size={11} aria-hidden="true" />
            </Link>
          )}
          {editProfileHref && (
            <Link
              href={editProfileHref}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
            >
              {t(objective ? "foryou.editProfile" : "foryou.setupProfile")}
              <ArrowRight size={11} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

export function FounderProgress({ stage, locale = "en" }: { stage: string | null; locale?: Locale }) {
  const t = translatorFor(locale);
  return (
    <section
      aria-label={t("foryou.progressAria")}
      className="vx-card flex flex-wrap items-center justify-between gap-3 px-4 py-3"
    >
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
        <span className="text-xs font-medium">{stage ?? t("foryou.stageNotSet")}</span>
        <span className="vx-label">{t("foryou.founderStage")}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="vx-label">{t("foryou.sprint")}</span>
        <span className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
          {t("foryou.notConnected")}
        </span>
      </div>
    </section>
  );
}

export function NextActions({ actions, locale = "en" }: { actions: FounderAction[]; locale?: Locale }) {
  const t = translatorFor(locale);
  return (
    <section aria-labelledby="next-actions-heading" className="vx-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="vx-label">{t("foryou.focus")}</p>
          <h2 id="next-actions-heading" className="mt-1 text-lg font-semibold tracking-tight">
            {t("foryou.nextThree")}
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {t("foryou.nextSubtitle")}
          </p>
        </div>
        <span className="rounded border border-[var(--accent)]/25 bg-[var(--accent-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
          {t("foryou.pending", { count: actions.length })}
        </span>
      </div>

      {actions.length === 0 ? (
        <div className="vx-inset mt-4 p-5 text-center">
          <p className="text-sm font-medium">{t("foryou.actionsEmptyTitle")}</p>
          <p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-[var(--text-muted)]">
            {t("foryou.actionsEmptyBody")}
          </p>
          <Link
            href="/knowledge-hub/start-business"
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)]"
          >
            {t("foryou.workGuide")}
            <ArrowRight size={11} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ol className="mt-4 space-y-3">
          {actions.map((action, index) => (
            <li key={action.title}>
              <article className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="vx-mono mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[var(--border)] bg-[var(--bg-card)] text-[10px] text-[var(--text-muted)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold tracking-tight">{action.title}</h3>
                      <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-[var(--text-secondary)]">
                        {action.description}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium ${
                      action.priority === "High"
                        ? "border-[var(--accent)]/25 bg-[var(--accent-muted)] text-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                    }`}
                  >
                    {t(
                      action.priority === "High"
                        ? "foryou.highImpact"
                        : "foryou.mediumImpact"
                    )}
                  </span>
                </div>

                <div className="vx-inset mt-3 p-2.5">
                  <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-[var(--text-muted)]">
                    <Sparkles size={10} className="text-[var(--accent)]" aria-hidden="true" />
                    {t("foryou.whyRecommended")}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    {action.why}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-[var(--text-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={10} aria-hidden="true" />
                      {action.time}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Target size={10} aria-hidden="true" />
                      {action.category}
                    </span>
                  </div>
                  <Link
                    href={action.href}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-fill)] px-3 py-1.5 text-[11px] font-medium text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-fill-hover)]"
                  >
                    {action.cta}
                    <ArrowRight size={11} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function LearningPanel({
  items,
  locale = "en",
}: {
  items: LearningItem[];
  locale?: Locale;
}) {
  const t = translatorFor(locale);
  return (
    <section aria-labelledby="learning-heading" className="vx-card p-5">
      <p className="vx-label">{t("foryou.learning")}</p>
      <h2 id="learning-heading" className="mt-1 text-lg font-semibold tracking-tight">
        {t("foryou.continueLearning")}
      </h2>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{t("foryou.pickUp")}</p>

      {items.length === 0 ? (
        <div className="vx-inset mt-3 p-4">
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-[var(--accent)]" aria-hidden="true" />
            <p className="text-xs font-medium">{t("foryou.noLearning")}</p>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
            {t("foryou.noLearningBody")}
          </p>
          <Link
            href="/knowledge-hub/start-business"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)]"
          >
            {t("foryou.startJourney")}
            <ArrowRight size={11} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.title} className="vx-inset p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="vx-label">{item.category}</p>
                  <p className="mt-1 text-xs font-medium">{item.title}</p>
                </div>
                {typeof item.percent === "number" && (
                  <span className="vx-mono text-[10px] text-[var(--text-muted)]">
                    {item.percent}%
                  </span>
                )}
              </div>
              {typeof item.percent === "number" && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent-fill)]"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              )}
              <Link
                href={item.href}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)]"
              >
                {t("foryou.continueAction")}
                <ArrowRight size={10} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MetricsPanel({
  metrics,
  locale = "en",
}: {
  metrics: FounderMetric[];
  locale?: Locale;
}) {
  const t = translatorFor(locale);
  return (
    <section aria-labelledby="metrics-heading" className="vx-card p-5">
      <p className="vx-label">{t("foryou.relevantNumbers")}</p>
      <h2 id="metrics-heading" className="mt-1 text-lg font-semibold tracking-tight">
        {t("foryou.founderMetrics")}
      </h2>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        {t("foryou.metricsSubtitle")}
      </p>

      {metrics.length === 0 ? (
        <div className="vx-inset mt-3 p-4">
          <p className="text-xs font-medium">{t("foryou.noMetrics")}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
            {t("foryou.noMetricsBody")}
          </p>
        </div>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {metrics.map((metric) => (
            <li key={metric.label} className="vx-inset p-2.5">
              <p className="vx-mono text-lg font-semibold tabular-nums">{metric.value}</p>
              <p className="mt-0.5 text-[10px] leading-tight text-[var(--text-secondary)]">
                {metric.label}
              </p>
              {metric.hint && (
                <p className="mt-0.5 text-[9px] leading-tight text-[var(--text-muted)]">
                  {metric.hint}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function OpportunitiesPanel({
  items,
  locale = "en",
}: {
  items: OpportunityItem[];
  locale?: Locale;
}) {
  const t = translatorFor(locale);
  return (
    <section aria-labelledby="opportunities-heading" className="vx-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="vx-label">{t("foryou.livePrograms")}</p>
          <h2 id="opportunities-heading" className="mt-1 text-lg font-semibold tracking-tight">
            {t("foryou.opportunities")}
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {t("foryou.opportunitiesSubtitle")}
          </p>
        </div>
        <Link
          href="/competitions"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)]"
        >
          {t("foryou.browseAll")}
          <ArrowRight size={11} aria-hidden="true" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="vx-inset mt-3 p-4">
          <p className="text-xs font-medium">{t("foryou.noOpportunities")}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
            {t("foryou.noOpportunitiesBody")}
          </p>
          <Link
            href="/competitions"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)]"
          >
            {t("foryou.openCompetitions")}
            <ArrowRight size={11} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => {
            const deadline = formatDeadline(item.deadline);
            return (
              <li
                key={item.id}
                className="vx-inset flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded border border-[var(--accent)]/25 bg-[var(--accent-muted)] px-1.5 py-0.5 text-[9px] font-medium capitalize text-[var(--accent)]">
                      {statusLabel(item.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium">{item.title}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                    {deadline
                      ? t("foryou.deadline", { date: deadline })
                      : t("foryou.deadlineNotPublished")}
                  </p>
                </div>
                <Link
                  href={`/competitions/${item.id}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text)]"
                >
                  {t("foryou.viewDetails")}
                  <ArrowUpRight size={10} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const COMMUNITY_LINKS: { label: MessageKey; href: string }[] = [
  { label: "foryou.founderDiscussions", href: "/knowledge-hub/community" },
  { label: "foryou.peerGroups", href: "/knowledge-hub/community#peer-groups" },
  { label: "foryou.expertResources", href: "/knowledge-hub/community#expert-access" },
  { label: "foryou.workshops", href: "/knowledge-hub/community#workshops" },
];

export function CommunityPanel({ locale = "en" }: { locale?: Locale }) {
  const t = translatorFor(locale);
  return (
    <section aria-labelledby="community-heading" className="vx-card p-5">
      <div className="flex items-center gap-2">
        <Users size={14} className="text-[var(--accent)]" aria-hidden="true" />
        <p className="vx-label">{t("foryou.community")}</p>
      </div>
      <h2 id="community-heading" className="mt-2 text-sm font-semibold tracking-tight">
        {t("foryou.communityTitle")}
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
        {t("foryou.communityBody")}
      </p>

      <ul className="mt-3 space-y-1">
        {COMMUNITY_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex items-center justify-between gap-2 rounded px-1 py-1 text-[11px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
            >
              {t(link.label)}
              <ArrowRight size={10} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/explore"
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text)]"
      >
        {t("foryou.browseFounders")}
        <ArrowRight size={11} aria-hidden="true" />
      </Link>
    </section>
  );
}

export function AlertPanel({ locale = "en" }: { locale?: Locale }) {
  const t = translatorFor(locale);
  return (
    <section aria-labelledby="alert-heading" className="vx-card p-5">
      <div className="flex items-center gap-2">
        <ShieldAlert size={14} className="text-[var(--accent)]" aria-hidden="true" />
        <p className="vx-label">{t("foryou.securityNotice")}</p>
      </div>
      <h2 id="alert-heading" className="mt-2 text-sm font-semibold tracking-tight">
        {t("foryou.stayAlert")}
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
        {t("foryou.securityBody")}
      </p>
      <Link
        href="/knowledge-hub/scam-watch"
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text)]"
      >
        {t("foryou.safetyTips")}
        <ArrowRight size={11} aria-hidden="true" />
      </Link>
    </section>
  );
}

export function ImpactPanel({
  goals,
  locale = "en",
}: {
  goals: string[];
  locale?: Locale;
}) {
  const t = translatorFor(locale);
  return (
    <section aria-labelledby="impact-heading" className="vx-card p-5">
      <div className="flex items-center gap-2">
        <Leaf size={14} className="text-[var(--accent)]" aria-hidden="true" />
        <p className="vx-label">{t("section.impact")}</p>
      </div>
      <h2 id="impact-heading" className="mt-2 text-sm font-semibold tracking-tight">
        {t("foryou.impactTitle")}
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
        {t("foryou.impactBody")}
      </p>

      {goals.length > 0 && (
        <div className="mt-3">
          <p className="vx-label">{t("foryou.sdgAlignment")}</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {goals.map((goal) => (
              <li
                key={goal}
                className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]"
              >
                {goal}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href="/knowledge-hub/impact"
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text)]"
      >
        {t("foryou.exploreImpact")}
        <ArrowRight size={11} aria-hidden="true" />
      </Link>
    </section>
  );
}

export function AccountPanel({
  title,
  description,
  primary,
  secondary,
}: {
  title: string;
  description: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <section className="vx-card p-5">
      <div className="flex items-start gap-2.5">
        <Info size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-[var(--text-muted)]">
            {description}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={primary.href}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-fill)] px-3 py-1.5 text-[11px] font-medium text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-fill-hover)]"
            >
              {primary.label}
              <ArrowRight size={11} aria-hidden="true" />
            </Link>
            {secondary && (
              <Link
                href={secondary.href}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text)]"
              >
                {secondary.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
