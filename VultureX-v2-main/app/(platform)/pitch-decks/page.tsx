import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { pitchDeckFiles, pitchDeckRequests } from "@/db/schema";
import { getActor, STATUS_LABELS, questionnaireProgress, type Answers } from "@/features/pitch-deck";
import { PageHeader, Section, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/pitch-deck/StatusBadge";
import { StartRequestButton } from "./start-request-button";
// Icons are passed as props to Client Components → use the client boundary.
import { Presentation, Download } from "@/components/pitch-deck/icons";
import { requireStartup } from "@/features/pitch-deck";

export const metadata = { title: "My Pitch Decks" };

export default async function PitchDecksPage() {
  const actor = await getActor();
  if (!actor) redirect("/login?callbackUrl=/pitch-decks");
  if (actor.role !== "startup") redirect(actor.role === "admin" ? "/admin" : "/dashboard");

  const ctx = await requireStartup();
  if (!ctx) {
    return (
      <div>
        <PageHeader title="My Pitch Decks" />
        <EmptyState
          icon={Presentation}
          title="No profile yet"
          description="Complete your startup profile first — we reuse it for every pitch deck request."
          action={{ label: "Create profile", href: "/onboarding/startup" }}
        />
      </div>
    );
  }

  const requests = await db
    .select()
    .from(pitchDeckRequests)
    .where(eq(pitchDeckRequests.startupId, ctx.startup.id))
    .orderBy(desc(pitchDeckRequests.createdAt));

  const requestIds = requests.map((r) => r.id);
  const publishedFiles = requestIds.length
    ? await db
        .select()
        .from(pitchDeckFiles)
        .where(inArray(pitchDeckFiles.requestId, requestIds))
    : [];

  const publishedByRequest = new Map(
    publishedFiles.filter((f) => f.isPublished).map((f) => [f.requestId, f]),
  );

  return (
    <div>
      <PageHeader
        title="My Pitch Decks"
        subtitle={`${requests.length} request${requests.length === 1 ? "" : "s"}`}
        action={
          <StartRequestButton label="Create Your Pitch Deck" />
        }
      />

      {requests.length === 0 ? (
        <EmptyState
          icon={Presentation}
          title="No pitch deck requests yet"
          description="Answer 12 questions across 3 short batches. We combine your answers with your profile, you approve the summary, and our team prepares the deck."
        />
      ) : (
        <Section delay={0.05}>
          <div className="space-y-3">
            {requests.map((request) => {
              const answers = (request.answers ?? {}) as Answers;
              const progress = questionnaireProgress(answers);
              const deck = publishedByRequest.get(request.id);
              return (
                <div
                  key={request.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-medium truncate">{request.title}</h2>
                        <StatusBadge
                          status={request.status}
                          changedSinceApproval={request.summaryChangedSinceApproval}
                        />
                        {request.kind === "revision" && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] border border-[var(--border)] text-[var(--text-muted)]">
                            Revision v{request.version}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                        {request.submittedAt && (
                          <span>Submitted {new Date(request.submittedAt).toLocaleDateString()}</span>
                        )}
                        {request.approvedAt && (
                          <span>Approved {new Date(request.approvedAt).toLocaleDateString()}</span>
                        )}
                        {request.publishedAt && (
                          <span>Published {new Date(request.publishedAt).toLocaleDateString()}</span>
                        )}
                        <span>{STATUS_LABELS[request.status]}</span>
                      </p>
                      {request.adminNote && (
                        <p className="text-[10px] text-[var(--text-secondary)] mt-2 px-2 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
                          Vulture X team: {request.adminNote}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {request.status === "incomplete" && (
                        <Link
                          href={`/pitch-decks/${request.id}/questionnaire`}
                          className="px-3 py-1.5 text-[11px] font-medium bg-[var(--accent-fill)] text-[var(--accent-foreground)] rounded-md hover:bg-[var(--accent-hover)] transition-colors"
                        >
                          {progress > 0 ? `Resume batch ${request.currentBatch}` : "Start questionnaire"}
                        </Link>
                      )}
                      {request.status === "pending_approval" && (
                        <Link
                          href={`/pitch-decks/${request.id}/summary`}
                          className="px-3 py-1.5 text-[11px] font-medium bg-[var(--accent-fill)] text-[var(--accent-foreground)] rounded-md hover:bg-[var(--accent-hover)] transition-colors"
                        >
                          Review &amp; approve summary
                        </Link>
                      )}
                      {request.status === "rejected" && (
                        <Link
                          href={`/pitch-decks/${request.id}`}
                          className="px-3 py-1.5 text-[11px] font-medium border border-[var(--red)]/40 text-[var(--red)] rounded-md hover:bg-[var(--red-muted)] transition-colors"
                        >
                          Review required changes
                        </Link>
                      )}
                      {(request.status === "approved" || request.status === "in_progress") && (
                        <Link
                          href={`/pitch-decks/${request.id}/summary`}
                          className="px-3 py-1.5 text-[11px] border border-[var(--border)] rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors"
                        >
                          View approved summary
                        </Link>
                      )}
                      {deck && (
                        <>
                          <a
                            href={`/api/files/${deck.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 text-[11px] border border-[var(--border)] rounded-md text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-colors"
                          >
                            View deck
                          </a>
                          <a
                            href={`/api/files/${deck.id}?download=1`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border border-[var(--accent)]/40 text-[var(--accent)] rounded-md hover:bg-[var(--accent-muted)] transition-colors"
                          >
                            <Download size={11} /> Download
                          </a>
                        </>
                      )}
                      <Link
                        href={`/pitch-decks/${request.id}`}
                        className="px-3 py-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                      >
                        Details
                      </Link>
                    </div>
                  </div>

                  {request.status === "incomplete" && (
                    <div className="mt-4">
                      <div className="h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--accent-fill)]"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                        {progress}% complete · currently on batch {request.currentBatch} of 3
                      </p>
                    </div>
                  )}

                  {request.status === "completed" && deck && (
                    <div className="mt-4 pt-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Published {request.publishedAt ? new Date(request.publishedAt).toLocaleDateString() : ""} ·{" "}
                        {deck.fileName}
                      </p>
                      <div className="flex items-center gap-2">
                        <StartRequestButton
                          kind="revision"
                          previousRequestId={request.id}
                          label="Improve the Existing Pitch Deck"
                          variant="secondary"
                          size="sm"
                        />
                        <StartRequestButton
                          kind="new"
                          label="Create a New Pitch Deck"
                          variant="secondary"
                          size="sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
