import Link from "next/link";
import { redirect } from "next/navigation";
import { PlusCircle, Users } from "lucide-react";
// Icons passed as props to client components must cross a client boundary.
import { Trophy } from "@/components/competitions/icons";
import { EmptyState, PageHeader } from "@/components/ui";
import { StatusChip } from "@/components/competitions/StatusChip";
import { getCompetitionActor, getInvestorCompetitions } from "@/features/competitions";
import { formatDate } from "@/features/competitions/format";

export const metadata = { title: "My competitions" };

export default async function ManageCompetitionsPage() {
  const actor = await getCompetitionActor();
  if (!actor) redirect("/login?callbackUrl=/competitions/manage");
  if (actor.role !== "investor") redirect("/competitions");

  if (!actor.investorId) {
    return (
      <div>
        <PageHeader title="My competitions" />
        <EmptyState
          icon={Trophy}
          title="Complete your investor profile first"
          description="You need an investor profile before you can host a competition."
          action={{ label: "Set up investor profile", href: "/onboarding/investor" }}
        />
      </div>
    );
  }

  const rows = await getInvestorCompetitions(actor.investorId);

  return (
    <div>
      <PageHeader
        title="My competitions"
        subtitle={`${rows.length} proposal${rows.length === 1 ? "" : "s"}`}
        action={
          <Link
            href="/competitions/host"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[var(--accent-fill)] text-[var(--accent-foreground)] rounded-md hover:bg-[var(--accent-hover)] transition-colors"
          >
            <PlusCircle size={12} /> New proposal
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No competitions yet"
          description="Propose a challenge for startups. It stays private until the VultureX team approves it."
          action={{ label: "Propose a competition", href: "/competitions/host" }}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.competition.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/competitions/${row.competition.id}`}
                      className="text-sm font-medium hover:text-[var(--accent)] transition-colors"
                    >
                      {row.competition.title}
                    </Link>
                    <StatusChip status={row.competition.status} />
                    {row.competition.phase === "upcoming" && (
                      <span className="text-[10px] text-[var(--text-muted)]">
                        opens {formatDate(row.competition.opensAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1.5 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Users size={9} /> {row.applications} applications
                    </span>
                    <span>{row.pending} awaiting review</span>
                    <span>{row.shortlisted} shortlisted</span>
                    <span>{row.winners} winner(s) proposed</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {(row.competition.status === "draft" ||
                    row.competition.status === "changes_requested") && (
                    <Link
                      href={`/competitions/host/${row.competition.id}`}
                      className="px-3 py-1.5 text-[11px] border border-[var(--border)] rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors"
                    >
                      Edit
                    </Link>
                  )}
                  <Link
                    href={`/competitions/manage/${row.competition.id}`}
                    className="px-3 py-1.5 text-[11px] font-medium bg-[var(--bg-elevated)] rounded-md hover:bg-[var(--bg-card-hover)] transition-colors"
                  >
                    Manage
                  </Link>
                </div>
              </div>

              {row.competition.adminFeedback &&
                row.competition.status === "changes_requested" && (
                  <p className="text-[10px] text-[var(--amber)] mt-3 px-2 py-1.5 rounded bg-[var(--amber-muted)]">
                    Admin feedback: {row.competition.adminFeedback}
                  </p>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
