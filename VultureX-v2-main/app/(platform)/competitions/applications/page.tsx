import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Award } from "lucide-react";
// Icons passed as props to client components must cross a client boundary.
import { Trophy } from "@/components/competitions/icons";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { StatusChip } from "@/components/competitions/StatusChip";
import { getCompetitionActor, getStartupApplications } from "@/features/competitions";
import { APPLICATION_STATUS_LABELS } from "@/features/competitions/types";
import { formatDate } from "@/features/competitions/format";

export const metadata = { title: "My competition applications" };

export default async function CompetitionApplicationsPage() {
  const actor = await getCompetitionActor();
  if (!actor) redirect("/login?callbackUrl=/competitions/applications");
  if (actor.role !== "startup") redirect("/competitions");

  const applications = await getStartupApplications(actor);

  return (
    <div>
      <Link
        href="/competitions"
        className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] mb-4 transition-colors"
      >
        <ArrowLeft size={11} /> Competitions
      </Link>

      <PageHeader
        title="My applications"
        subtitle={`${applications.length} application${
          applications.length === 1 ? "" : "s"
        } submitted with your VultureX startup profile`}
      />

      {applications.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No competition applications yet"
          description="Browse open competitions and apply using your existing startup profile — no separate application form or upload required."
          action={{ label: "Browse competitions", href: "/competitions" }}
        />
      ) : (
        <div className="space-y-3">
          {applications.map((application) => {
            const deadline = application.competition.deadline;
            return (
              <div
                key={application.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/competitions/${application.competition.id}`}
                        className="text-sm font-medium hover:text-[var(--accent)] transition-colors"
                      >
                        {application.competition.title}
                      </Link>
                      <Badge
                        variant={
                          application.status === "accepted"
                            ? "green"
                            : application.status === "rejected" ||
                                application.status === "withdrawn"
                              ? "default"
                              : "accent"
                        }
                      >
                        {APPLICATION_STATUS_LABELS[application.status] ??
                          application.status}
                      </Badge>
                      <StatusChip status={application.competition.status} />
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                      Hosted by {application.competition.host}
                      {application.competition.category
                        ? ` · ${application.competition.category}`
                        : ""}
                      {deadline ? ` · deadline ${formatDate(deadline)}` : ""}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                      Submitted {formatDate(application.submittedAt)}
                      {application.decidedAt
                        ? ` · decision ${formatDate(application.decidedAt)}`
                        : ""}
                    </p>
                  </div>

                  {application.result && (
                    <div className="rounded-lg border border-[var(--green)]/30 bg-[var(--green-muted)] px-3 py-2">
                      <p className="text-[11px] font-medium text-[var(--green)] flex items-center gap-1.5">
                        <Award size={11} /> Placed #
                        {application.result.placement}
                        {application.result.awardLabel
                          ? ` · ${application.result.awardLabel}`
                          : ""}
                      </p>
                    </div>
                  )}
                </div>

                {application.coverNote && (
                  <p className="text-[11px] text-[var(--text-secondary)] mt-3 italic">
                    &ldquo;{application.coverNote}&rdquo;
                  </p>
                )}

                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--border)]">
                  <Link
                    href={`/competitions/${application.competition.id}`}
                    className="px-3 py-1.5 text-[11px] border border-[var(--border)] rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors"
                  >
                    View competition
                  </Link>
                  <Link
                    href="/settings"
                    className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                  >
                    Update profile
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
