import type { PitchDeckStatus } from "@/db/schema";

const STYLES: Record<PitchDeckStatus, { label: string; className: string }> = {
  incomplete: {
    label: "Incomplete",
    className: "bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border)]",
  },
  pending_approval: {
    label: "Awaiting approval",
    className: "bg-[var(--amber-muted)] text-[var(--amber)] border-[var(--amber)]/30",
  },
  approved: {
    label: "Approved",
    className: "bg-[var(--accent-muted)] text-[var(--accent)] border-[var(--accent)]/30",
  },
  in_progress: {
    label: "Pitch Deck In Progress",
    className: "bg-[var(--accent-muted)] text-[var(--accent)] border-[var(--accent)]/30",
  },
  rejected: {
    label: "Changes required",
    className: "bg-[var(--red-muted)] text-[var(--red)] border-[var(--red)]/30",
  },
  completed: {
    label: "Completed",
    className: "bg-[var(--green-muted)] text-[var(--green)] border-[var(--green)]/30",
  },
};

export function StatusBadge({
  status,
  changedSinceApproval,
}: {
  status: PitchDeckStatus;
  changedSinceApproval?: boolean;
}) {
  const style = STYLES[status] ?? STYLES.incomplete;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${style.className}`}
      >
        {style.label}
      </span>
      {changedSinceApproval && (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium border bg-[var(--red-muted)] text-[var(--red)] border-[var(--red)]/30">
          Changed since approval
        </span>
      )}
    </span>
  );
}
