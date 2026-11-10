import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { HubIcon } from "./icons";
import { hubSectionHref, type HubSection } from "@/lib/knowledge-hub";
import { translatorFor, type Locale } from "@/features/i18n/messages";

export function SectionCard({ section, headingLevel = 3, locale = "en" }: { section: HubSection; headingLevel?: 3 | 4; locale?: Locale }) {
  const t = translatorFor(locale);
  const entryCount =
    section.topics.length ||
    (section.groups?.reduce((total, group) => total + group.items.length, 0) ?? 0);

  const meta =
    section.slug === "for-you"
      ? t("kh.personalWorkspace")
      : entryCount > 0
        ? t(section.groups?.length ? "kh.entries" : "kh.topics", { count: entryCount })
        : section.eyebrow;

  const Heading = headingLevel === 3 ? "h3" : "h4";

  return (
    <Link
      href={hubSectionHref(section.slug)}
      className="group vx-card vx-card-interactive flex h-full flex-col gap-3 p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] border border-[var(--accent)]/20 bg-[var(--accent-muted)] text-[var(--accent)]">
          <HubIcon name={section.icon} size={16} />
        </span>
        <ArrowUpRight
          size={14}
          className="mt-0.5 text-[var(--text-muted)] transition-colors group-hover:text-[var(--accent)]"
          aria-hidden="true"
        />
      </div>
      <div className="flex-1">
        <Heading className="text-sm font-semibold tracking-tight text-[var(--text)]">
          {section.title}
        </Heading>
        <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-[var(--text-muted)]">
          {section.summary}
        </p>
      </div>
      <span className="vx-label">{meta}</span>
    </Link>
  );
}
