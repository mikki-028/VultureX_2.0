import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { ResourceCard } from "@/components/knowledge-hub/ResourceCard";
import { SectionCard } from "@/components/knowledge-hub/SectionCard";
import {
  FEATURED_RESOURCES,
  HUB_DESTINATIONS,
  HUB_SECTIONS,
  QUICK_ACCESS,
  START_HERE,
} from "@/lib/knowledge-hub";
import { getRequestLocale } from "@/features/i18n/server";
import { translatorFor, type MessageKey } from "@/features/i18n/messages";

const QUICK_ACCESS_KEYS: Record<string, MessageKey> = {
  "/knowledge-hub/start-business": "kh.quick.startupGuides",
  "/knowledge-hub/industry-guides": "kh.quick.industryPlaybooks",
  "/knowledge-hub/funding": "kh.quick.fundingResources",
  "/knowledge-hub/tools-templates": "kh.quick.businessTools",
  "/knowledge-hub/startup-ideas": "kh.quick.startupIdeas",
  "/knowledge-hub/impact": "kh.quick.impactResources",
  "/knowledge-hub/scam-watch": "kh.quick.scamAwareness",
  "/knowledge-hub/community": "kh.quick.expertAccess",
  "/knowledge-hub/collaboration": "kh.quick.collaboration",
};

const START_HERE_KEYS: Record<
  string,
  { title: MessageKey; reason: MessageKey }
> = {
  "/knowledge-hub/start-business": {
    title: "kh.start.mapStage",
    reason: "kh.start.mapStageReason",
  },
  "/knowledge-hub/funding": {
    title: "kh.start.checkMoney",
    reason: "kh.start.checkMoneyReason",
  },
  "/knowledge-hub/collaboration": {
    title: "kh.start.findPartner",
    reason: "kh.start.findPartnerReason",
  },
};

const SECTION_KEYS: Record<string, MessageKey> = {
  "start-business": "section.start-business",
  "industry-guides": "section.industry-guides",
  funding: "section.funding",
  "marketing-sales": "section.marketing-sales",
  "tools-templates": "section.tools-templates",
  "startup-ideas": "section.startup-ideas",
  impact: "section.impact",
  "scam-watch": "section.scam-watch",
  community: "section.community",
  collaboration: "section.collaboration",
  search: "section.search",
};

export const metadata: Metadata = {
  title: "Knowledge Hub",
  description:
    "Learn the fundamentals, explore industries, plan funding, find tools and connect with founders building alongside you.",
};

export default async function KnowledgeHubPage() {
  const locale = await getRequestLocale();
  const t = translatorFor(locale);

  return (
    <div className="space-y-10">
      <header>
        <p className="vx-label">{t("kh.eyebrow")}</p>
        <h1 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("kh.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
          {t("kh.subtitle")}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href="/knowledge-hub/for-you"
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-fill)] px-3.5 py-2 text-xs font-medium text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-fill-hover)]"
          >
            {t("kh.openForYou")}
            <ArrowRight size={12} aria-hidden="true" />
          </Link>
          <Link
            href="#explore"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text)]"
          >
            {t("kh.exploreAll", { count: HUB_DESTINATIONS.length })}
          </Link>
        </div>
      </header>

      <section aria-labelledby="featured-heading">
        <div className="mb-3">
          <p className="vx-label">{t("kh.featured")}</p>
          <h2 id="featured-heading" className="mt-1 text-lg font-semibold tracking-tight">
            {t("kh.featuredTitle")}
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {t("kh.featuredSubtitle")}
          </p>
        </div>

        {FEATURED_RESOURCES.length === 0 ? (
          <div className="vx-card p-6 text-center">
            <p className="text-sm font-medium">{t("kh.noFeaturedTitle")}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {t("kh.noFeaturedBody")}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURED_RESOURCES.map((resource) => (
              <ResourceCard key={resource.title} {...resource} readLabel={t("kh.readTopic")} />
            ))}
          </div>
        )}
      </section>

      <section id="explore" aria-labelledby="explore-heading" className="scroll-mt-20">
        <div className="mb-3">
          <p className="vx-label">{t("kh.directory")}</p>
          <h2 id="explore-heading" className="mt-1 text-lg font-semibold tracking-tight">
            {t("kh.directoryTitle")}
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {t("kh.directorySubtitle")}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HUB_DESTINATIONS.map((section) => {
            const key = SECTION_KEYS[section.slug];
            return (
              <SectionCard
                key={section.slug}
                section={key ? { ...section, title: t(key) } : section}
                locale={locale}
              />
            );
          })}
        </div>
      </section>

      <section aria-labelledby="quick-access-heading">
        <div className="mb-3">
          <p className="vx-label">{t("kh.shortcuts")}</p>
          <h2 id="quick-access-heading" className="mt-1 text-lg font-semibold tracking-tight">
            {t("kh.quickAccess")}
          </h2>
        </div>
        <ul className="flex flex-wrap gap-2">
          {QUICK_ACCESS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text)]"
              >
                {QUICK_ACCESS_KEYS[item.href]
                  ? t(QUICK_ACCESS_KEYS[item.href])
                  : item.label}
                <ArrowRight size={10} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="start-here-heading">
        <div className="mb-3">
          <p className="vx-label">{t("kh.newHere")}</p>
          <h2 id="start-here-heading" className="mt-1 text-lg font-semibold tracking-tight">
            {t("kh.startHere")}
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {t("kh.startSubtitle")}
          </p>
        </div>
        <ol className="vx-card divide-y divide-[var(--divider)]">
          {START_HERE.map((item, index) => {
            const keys = START_HERE_KEYS[item.href];
            return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex items-start gap-3 p-4 transition-colors hover:bg-[var(--bg-card-hover)]"
              >
                <span className="vx-mono mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[var(--border)] text-[10px] text-[var(--text-muted)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[var(--text)] transition-colors group-hover:text-[var(--accent)]">
                    {keys ? t(keys.title) : item.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--text-muted)]">
                    {keys ? t(keys.reason) : item.reason}
                  </span>
                </span>
                <ArrowRight
                  size={12}
                  className="mt-1 shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </li>
            );
          })}
        </ol>
      </section>

      <div className="vx-inset flex gap-2.5 p-3.5">
        <Info size={14} className="mt-0.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
        <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
          {t("kh.disclaimer")}{" "}
          <span className="vx-mono">
            {t("kh.destinations", { count: HUB_SECTIONS.length })}
          </span>
        </p>
      </div>
    </div>
  );
}
