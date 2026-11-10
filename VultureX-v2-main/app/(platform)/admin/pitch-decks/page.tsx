import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, ne, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { pitchDeckRequests, startups, PITCH_DECK_STATUSES, type PitchDeckStatus } from "@/db/schema";
import { getActor } from "@/features/pitch-deck";
import { PageHeader } from "@/components/ui";
import { StatusBadge } from "@/components/pitch-deck/StatusBadge";

export const metadata = { title: "Pitch Deck Requests" };

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending_approval", label: "Unapproved" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In progress" },
  { value: "rejected", label: "Changes required" },
  { value: "completed", label: "Completed" },
  { value: "incomplete", label: "Incomplete" },
];

export default async function AdminPitchDecksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login?callbackUrl=/admin/pitch-decks");
  if (actor.role !== "admin") redirect("/dashboard");

  const { status: statusParam } = await searchParams;
  const filter = FILTERS.some((f) => f.value === statusParam) ? statusParam! : "all";

  const conditions: SQL[] = [];
  if (filter !== "all") {
    conditions.push(eq(pitchDeckRequests.status, filter as PitchDeckStatus));
  } else {
    // "All" excludes untouched drafts so the queue stays actionable.
    conditions.push(ne(pitchDeckRequests.status, "incomplete"));
  }

  const rows = await db
    .select({
      request: pitchDeckRequests,
      startupName: startups.name,
      startupSector: startups.sector,
      startupStage: startups.stage,
    })
    .from(pitchDeckRequests)
    .innerJoin(startups, eq(startups.id, pitchDeckRequests.startupId))
    .where(and(...conditions))
    .orderBy(desc(pitchDeckRequests.submittedAt), desc(pitchDeckRequests.createdAt));

  return (
    <div>
      <PageHeader
        title="Pitch Deck Requests"
        subtitle="Only founder-approved summaries can be turned into a published deck."
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/admin/pitch-decks" : `/admin/pitch-decks?status=${f.value}`}
            className={`px-3 py-1.5 text-[11px] rounded-md border transition-colors ${
              filter === f.value
                ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)] font-medium"
                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-hover)]"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] p-10 text-center">
          <p className="text-sm">No requests in this view.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Requests appear here once founders start the questionnaire.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="px-4 py-3 font-medium">Startup</th>
                <th className="px-4 py-3 font-medium">Request</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium">Approved</th>
                <th className="px-4 py-3 font-medium">Published</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ request, startupName, startupSector }) => (
                <tr
                  key={request.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{startupName}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{startupSector}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{request.title}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {request.kind === "revision" ? `Revision v${request.version}` : "New deck"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={request.status}
                      changedSinceApproval={request.summaryChangedSinceApproval}
                    />
                  </td>
                  <td className="px-4 py-3 text-[10px] text-[var(--text-muted)]">
                    {request.submittedAt ? new Date(request.submittedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-[10px] text-[var(--text-muted)]">
                    {request.approvedAt ? new Date(request.approvedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-[10px] text-[var(--text-muted)]">
                    {request.publishedAt ? new Date(request.publishedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/pitch-decks/${request.id}`}
                      className="text-[11px] text-[var(--accent)] hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-[var(--text-muted)] mt-4">
        Statuses: {PITCH_DECK_STATUSES.join(" · ")}
      </p>
    </div>
  );
}
