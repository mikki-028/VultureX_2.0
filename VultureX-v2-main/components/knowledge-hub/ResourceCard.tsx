import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HubIcon } from "./icons";
import { SaveResourceButton } from "./saved/SaveResourceButton";
import type { HubIconKey } from "@/lib/knowledge-hub";

export function ResourceCard({
  title,
  description,
  category,
  href,
  icon,
  resourceKey,
  readLabel = "Read topic",
}: {
  title: string;
  description: string;
  category: string;
  href: string;
  icon: HubIconKey;
  resourceKey?: string;
  readLabel?: string;
}) {
  return (
    <article className="group vx-card vx-card-interactive flex h-full flex-col justify-between gap-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <Link href={href} className="vx-label text-[var(--accent)]">
          {category}
        </Link>
        <div className="flex items-center gap-1.5">
          <HubIcon name={icon} size={14} className="text-[var(--text-muted)]" />
          <SaveResourceButton resourceKey={resourceKey ?? href} />
        </div>
      </div>
      <Link href={href} className="block">
        <h3 className="text-sm font-semibold tracking-tight text-[var(--text)]">{title}</h3>
        <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
          {description}
        </p>
      </Link>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)]"
      >
        {readLabel}
        <ArrowRight
          size={11}
          className="transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </article>
  );
}
