import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Info } from "lucide-react";
import { Breadcrumbs } from "@/components/knowledge-hub/Breadcrumbs";
import { HubIcon } from "@/components/knowledge-hub/icons";
import { SectionCard } from "@/components/knowledge-hub/SectionCard";
import { SaveResourceButton } from "@/components/knowledge-hub/saved/SaveResourceButton";
import { getSavedResourceCatalogEntry } from "@/features/saved-resources/catalog";
import {
  getHubSection,
  hubAnchor,
  hubSectionHref,
  HUB_SECTION_MAP,
  type HubSection,
} from "@/lib/knowledge-hub";
import { getRequestLocale } from "@/features/i18n/server";
import { translatorFor } from "@/features/i18n/messages";

/**
 * One renderer for every Knowledge Hub destination. Each route supplies its own
 * slug, so the pages stay distinct URLs without duplicating layout or content.
 */
export async function HubSectionView({ slug }: { slug: string }) {
  const section = getHubSection(slug);
  if (!section) notFound();
  const locale = await getRequestLocale();
  const t = translatorFor(locale);

  const related = section.related
    .map((relatedSlug) => HUB_SECTION_MAP.get(relatedSlug))
    .filter((value): value is HubSection => Boolean(value));

  const hasDirectory = Boolean(section.groups?.length);

  return (
    <div className="space-y-8">
      <div>
        <Breadcrumbs
          items={[{ label: t("nav.knowledgeHub"), href: "/knowledge-hub" }, { label: section.title }]}
        />

        <header>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] border border-[var(--accent)]/20 bg-[var(--accent-muted)] text-[var(--accent)]">
              <HubIcon name={section.icon} size={18} />
            </span>
            <div className="min-w-0">
              <p className="vx-label">{section.eyebrow}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {section.title}
                </h1>
                {getSavedResourceCatalogEntry(hubSectionHref(section.slug)) && (
                  <SaveResourceButton resourceKey={hubSectionHref(section.slug)} />
                )}
              </div>
            </div>
          </div>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
            {section.summary}
          </p>

          <div className="mt-3 max-w-2xl space-y-2">
            {section.intro.map((paragraph) => (
              <p key={paragraph} className="text-xs leading-relaxed text-[var(--text-muted)]">
                {paragraph}
              </p>
            ))}
          </div>
        </header>
      </div>

      {section.cta && (
        <div className="vx-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="vx-label">{t("kh.nextStep")}</p>
            <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-[var(--text-secondary)]">
              {section.cta.hint}
            </p>
          </div>
          <Link
            href={section.cta.href}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--accent-fill)] px-3 py-1.5 text-[11px] font-medium text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-fill-hover)]"
          >
            {section.cta.label}
            <ArrowRight size={11} aria-hidden="true" />
          </Link>
        </div>
      )}

      {section.topics.length > 0 && (
        <section aria-labelledby="topics-heading" className="space-y-3">
          <div>
            <p className="vx-label">{t("kh.path")}</p>
            <h2 id="topics-heading" className="mt-1 text-lg font-semibold tracking-tight">
              {t("kh.topicCount", { count: section.topics.length })}
            </h2>
          </div>

          <ol className="grid gap-3 sm:grid-cols-2">
            {section.topics.map((topic, index) => {
              const topicHref = `${hubSectionHref(section.slug)}#${hubAnchor(topic.title)}`;
              return (
                <li
                  key={topic.title}
                  id={hubAnchor(topic.title)}
                  className="vx-card scroll-mt-24 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="vx-mono text-[10px] text-[var(--text-muted)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {getSavedResourceCatalogEntry(topicHref) && (
                      <SaveResourceButton resourceKey={topicHref} />
                    )}
                  </div>
                  <h3 className="mt-1 text-sm font-semibold tracking-tight">{topic.title}</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
                    {topic.description}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {hasDirectory && section.groups && (
        <section aria-labelledby="directory-heading" className="space-y-3">
          <div>
            <p className="vx-label">{t("kh.directory")}</p>
            <h2 id="directory-heading" className="mt-1 text-lg font-semibold tracking-tight">
              {t("kh.browseArea")}
            </h2>
          </div>

          <div className="space-y-3">
            {section.groups.map((group) => (
              <article
                key={group.title}
                id={hubAnchor(group.title)}
                className="vx-card scroll-mt-24 p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-semibold tracking-tight">{group.title}</h3>
                    {getSavedResourceCatalogEntry(
                      `${hubSectionHref(section.slug)}#${hubAnchor(group.title)}`
                    ) && (
                      <SaveResourceButton
                        resourceKey={`${hubSectionHref(section.slug)}#${hubAnchor(group.title)}`}
                      />
                    )}
                  </div>
                  <span className="vx-label">
                    {t("kh.entryCount", {
                      count: group.items.length,
                      unit: t(
                        group.items.length === 1
                          ? "kh.entryUnitOne"
                          : "kh.entryUnitMany"
                      ),
                    })}
                  </span>
                </div>

                {group.description && (
                  <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    {group.description}
                  </p>
                )}

                <ul className="mt-3 divide-y divide-[var(--divider)]">
                  {group.items.map((item) => (
                    <li
                      key={item.title}
                      className="flex flex-wrap items-start justify-between gap-2 py-2 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 max-w-2xl">
                        <p className="text-xs font-medium text-[var(--text)]">{item.title}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
                          {item.description}
                        </p>
                      </div>
                      {item.meta && (
                        <span className="shrink-0 rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[9px] text-[var(--text-muted)]">
                          {item.meta}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}

      {section.notes && section.notes.length > 0 && (
        <div className="vx-inset flex gap-2.5 p-3.5">
          <Info size={14} className="mt-0.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          <div className="space-y-1.5">
            {section.notes.map((note) => (
              <p key={note} className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                {note}
              </p>
            ))}
          </div>
        </div>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="space-y-3">
          <div>
            <p className="vx-label">{t("kh.crossLinks")}</p>
            <h2 id="related-heading" className="mt-1 text-lg font-semibold tracking-tight">
              {t("kh.related")}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((relatedSection) => (
              <SectionCard key={relatedSection.slug} section={relatedSection} locale={locale} />
            ))}
          </div>
        </section>
      )}

      <div className="border-t border-[var(--border)] pt-4">
        <Link
          href="/knowledge-hub"
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          {t("kh.back")}
          <ArrowRight size={11} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
