"use client";

import Link from "next/link";
import { ArrowRight, Bookmark, Sparkles, X } from "lucide-react";
import { InterestPlusButton } from "@/components/connections/InterestPlusButton";
import {
  MATCH_RELATIONSHIP_LABELS,
  MATCH_STRENGTH_LABELS,
  type MatchRelationshipType,
} from "@/features/matchmaking/types";
import type { RecommendationItem } from "@/features/matchmaking/service";

const STRENGTH_STYLES: Record<string, string> = {
  high: "bg-[var(--green-muted)] text-[var(--green)] border-[var(--green)]/25",
  good: "bg-[var(--accent-muted)] text-[var(--accent)] border-[var(--accent)]/25",
  possible:
    "bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border)]",
};

function relationshipLabel(value: string): string {
  return (
    MATCH_RELATIONSHIP_LABELS[value as MatchRelationshipType] ??
    "Business relevance"
  );
}

type Props = {
  item: RecommendationItem;
  variant?: "compact" | "full";
  mode?: "default" | "dismissed";
  busy?: boolean;
  onDismiss?: (item: RecommendationItem) => void;
  onRestore?: (item: RecommendationItem) => void;
  onToggleSave?: (item: RecommendationItem) => void;
};

export function RecommendationCard({
  item,
  variant = "full",
  mode = "default",
  busy = false,
  onDismiss,
  onRestore,
  onToggleSave,
}: Props) {
  const { startup, reasons, interest } = item;
  const primary = reasons[0] ?? null;
  const extra = variant === "full" ? reasons.slice(1, 3) : [];
  const saved = !!item.savedAt;
  const meta = [startup.sector, startup.stage, startup.location]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 flex flex-col gap-3 hover:border-[var(--border-hover)] transition-colors h-full">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-semibold text-[var(--text-muted)] overflow-hidden shrink-0">
          {startup.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={startup.logoUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          ) : (
            startup.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={startup.href}
              className="text-sm font-medium truncate hover:text-[var(--accent)] transition-colors"
            >
              {startup.name}
            </Link>
            <span
              className={`px-1.5 py-0.5 rounded border text-[9px] font-medium ${
                STRENGTH_STYLES[item.strength] ?? STRENGTH_STYLES.possible
              }`}
            >
              {MATCH_STRENGTH_LABELS[item.strength]}
            </span>
          </div>
          {meta && <p className="text-[10px] text-[var(--text-muted)] truncate">{meta}</p>}
        </div>
        {mode === "default" && onDismiss ? (
          <button
            type="button"
            onClick={() => onDismiss(item)}
            disabled={busy}
            aria-label={`Dismiss ${startup.name}`}
            title="Dismiss recommendation"
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-elevated)] transition-colors disabled:opacity-40"
          >
            <X size={13} />
          </button>
        ) : null}
      </div>

      {startup.description && (
        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">
          {startup.description}
        </p>
      )}

      {primary && (
        <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)]/60 px-2.5 py-2">
          <p className="flex items-center gap-1.5 text-[9px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
            <Sparkles size={9} className="text-[var(--accent)]" />
            Why this is recommended
            <span className="normal-case tracking-normal font-normal">
              · {relationshipLabel(item.relationshipType)}
            </span>
          </p>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mt-1">
            {primary.detail}
          </p>
          {extra.map((reason) => (
            <p
              key={`${reason.dimension}-${reason.detail}`}
              className="text-[10px] text-[var(--text-muted)] leading-relaxed mt-1"
            >
              {reason.detail}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap mt-auto pt-1">
        <Link
          href={startup.href}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[var(--border)] text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--border-hover)] transition-colors"
        >
          View profile <ArrowRight size={10} />
        </Link>

        {startup.userId && mode === "default" && (
          <InterestPlusButton
            targetUserId={startup.userId}
            targetName={startup.name}
            initialState={interest}
            authenticated
            compact
          />
        )}

        {mode === "dismissed" ? (
          onRestore && (
            <button
              type="button"
              onClick={() => onRestore(item)}
              disabled={busy}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[var(--border)] text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors disabled:opacity-40"
            >
              Restore
            </button>
          )
        ) : (
          onToggleSave && (
            <button
              type="button"
              onClick={() => onToggleSave(item)}
              disabled={busy}
              aria-pressed={saved}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-[10px] font-medium transition-colors disabled:opacity-40 ${
                saved
                  ? "border-[var(--accent)]/25 bg-[var(--accent-muted)] text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border-hover)]"
              }`}
            >
              <Bookmark size={10} className={saved ? "fill-current" : undefined} />
              {saved ? "Saved" : "Save"}
            </button>
          )
        )}
      </div>
    </article>
  );
}
