import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { pitchDeckEvents, pitchDeckFiles, pitchDeckRequests } from "@/db/schema";
import { getActor, loadRequestForActor, STATUS_LABELS } from "@/features/pitch-deck";
import { StatusBadge } from "@/components/pitch-deck/StatusBadge";
import { StartRequestButton } from "../start-request-button";
import { Download, FileText, History } from "@/components/pitch-deck/icons";

export default async function PitchDeckRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const { id } = await params;

  const found = await loadRequestForActor(id, actor);
  if (!found || actor.role !== "startup") notFound();
  const { request, startup } = found;

  const files = await db
    .select()
    .from(pitchDeckFiles)
    .where(eq(pitchDeckFiles.requestId, request.id));
  const published = files.find((f) => f.isPublished && f.kind === "deck");

  const events = await db
    .select()
    .from(pitchDeckEvents)
    .where(eq(pitchDeckEvents.requestId, request.id))
    .orderBy(desc(pitchDeckEvents.createdAt));

  // Version history: the request this one revises, plus later revisions of it.
  const versionIds = [request.previousRequestId, request.id].filter(Boolean) as string[];
  const chain = await db
    .select()
    .from(pitchDeckRequests)
    .where(inArray(pitchDeckRequests.id, versionIds));

  const siblings = await db
    .select()
    .from(pitchDeckRequests)
    .where(eq(pitchDeckRequests.previousRequestId, request.id))
    .orderBy(desc(pitchDeckRequests.version));

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-[10px] text-[var(--text-muted)] mb-1">
            <Link href="/pitch-decks" className="hover:text-[var(--text-secondary)]">
              My Pitch Decks
            </Link>{" "}
            / {request.title}
          </p>
          <h1 className="text-xl font-semibold">{request.title}</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {startup.name} · {STATUS_LABELS[request.status]}
          </p>
        </div>
        <StatusBadge
          status={request.status}
          changedSinceApproval={request.summaryChangedSinceApproval}
        />
      </div>

      {request.status === "rejected" && (
        <div className="mb-5 rounded-xl border border-[var(--red)]/30 bg-[var(--red-muted)] p-4">
          <h2 className="text-xs font-semibold text-[var(--red)]">Changes required</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--red)]">
            {request.adminNote ?? "The VultureX team asked for changes before this deck can be prepared."}
          </p>
        </div>
      )}

      {/* Next action */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 mb-5">
        <h2 className="text-xs font-medium text-[var(--text-muted)] mb-3">Next action</h2>
        {request.status === "incomplete" && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-secondary)]">
              Finish the three-batch questionnaire. Your answers are saved as you go.
            </p>
            <Link
              href={`/pitch-decks/${request.id}/questionnaire`}
              className="px-4 py-2 text-xs font-medium bg-[var(--accent-fill)] text-[var(--accent-foreground)] rounded-md hover:bg-[var(--accent-hover)] transition-colors"
            >
              Resume batch {request.currentBatch}
            </Link>
          </div>
        )}
        {request.status === "pending_approval" && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-secondary)]">
              Review the combined summary and approve it so our team can start.
            </p>
            <Link
              href={`/pitch-decks/${request.id}/summary`}
              className="px-4 py-2 text-xs font-medium bg-[var(--accent-fill)] text-[var(--accent-foreground)] rounded-md hover:bg-[var(--accent-hover)] transition-colors"
            >
              Review &amp; approve
            </Link>
          </div>
        )}
        {(request.status === "approved" || request.status === "in_progress") && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-secondary)]">
              Your startup information has been submitted successfully. Our team is preparing your
              pitch deck — please check your dashboard again within 24–48 hours.
            </p>
            <Link
              href={`/pitch-decks/${request.id}/summary`}
              className="px-4 py-2 text-xs border border-[var(--border)] rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              View approved summary
            </Link>
          </div>
        )}
        {request.status === "completed" && published && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-secondary)]">
              Your pitch deck is ready. {published.fileName} · published{" "}
              {request.publishedAt ? new Date(request.publishedAt).toLocaleDateString() : ""}.
            </p>
            <div className="flex items-center gap-2">
              <a
                href={`/api/files/${published.id}?download=1`}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[var(--accent-fill)] text-[var(--accent-foreground)] rounded-md hover:bg-[var(--accent-hover)] transition-colors"
              >
                <Download size={12} /> Download pitch deck
              </a>
            </div>
          </div>
        )}
        {request.status === "rejected" && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-secondary)]">
              Update the summary to address the feedback, then resubmit it for review.
            </p>
            <Link
              href={`/pitch-decks/${request.id}/summary`}
              className="px-4 py-2 text-xs font-medium bg-[var(--accent-fill)] text-[var(--accent-foreground)] rounded-md hover:bg-[var(--accent-hover)] transition-colors"
            >
              Reopen for corrections
            </Link>
          </div>
        )}
        {request.status === "completed" && !published && (
          <p className="text-xs text-[var(--amber)]">
            Published file missing — contact the Vulture X team.
          </p>
        )}
      </div>

      {/* Post-publication workflow */}
      {request.status === "completed" && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 mb-5">
          <h2 className="text-xs font-medium text-[var(--text-muted)] mb-1">
            Make your deck stronger
          </h2>
          <p className="text-[11px] text-[var(--text-muted)] mb-4">
            Improve the deck you already have, or start a brand-new pitch deck request. The published
            version is always kept.
          </p>
          <div className="flex flex-wrap gap-2">
            <StartRequestButton
              kind="revision"
              previousRequestId={request.id}
              label="Improve the Existing Pitch Deck"
            />
            <StartRequestButton kind="new" label="Create a New Pitch Deck" variant="secondary" />
          </div>
        </div>
      )}

      {/* Approved summary access + original answers */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 mb-5">
        <h2 className="text-xs font-medium text-[var(--text-muted)] mb-3">Records</h2>
        <ul className="space-y-2 text-xs">
          <li className="flex items-center justify-between">
            <span className="text-[var(--text-secondary)]">Summary</span>
            {request.summary ? (
              <Link
                href={`/pitch-decks/${request.id}/summary`}
                className="text-[var(--accent)] hover:underline text-[11px]"
              >
                {request.approvedSummary ? "View approved summary" : "Open editable summary"}
              </Link>
            ) : (
              <span className="text-[var(--text-muted)] text-[11px]">
                Generated after you submit batch 3
              </span>
            )}
          </li>
          <li className="flex items-center justify-between">
            <span className="text-[var(--text-secondary)]">Questionnaire answers</span>
            <Link
              href={`/pitch-decks/${request.id}/questionnaire`}
              className="text-[var(--accent)] hover:underline text-[11px]"
            >
              {request.status === "incomplete" ? "Continue questionnaire" : "View answers"}
            </Link>
          </li>
          {files
            .filter((f) => f.kind === "product_screenshot")
            .map((f) => (
              <li key={f.id} className="flex items-center justify-between">
                <span className="text-[var(--text-secondary)]">Product screenshot</span>
                <a
                  href={`/api/files/${f.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--accent)] hover:underline text-[11px]"
                >
                  Open private file
                </a>
              </li>
            ))}
        </ul>
      </div>

      {/* Revision history */}
      {(chain.length > 1 || siblings.length > 0) && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 mb-5">
          <h2 className="text-xs font-medium text-[var(--text-muted)] mb-3 flex items-center gap-2">
            <History size={12} /> Version history
          </h2>
          <ul className="space-y-2">
            {[...chain.filter((c) => c.id !== request.id), ...siblings].map((other) => (
              <li key={other.id} className="flex items-center justify-between text-[11px]">
                <span className="text-[var(--text-secondary)]">
                  v{other.version} — {other.title}
                </span>
                <Link href={`/pitch-decks/${other.id}`} className="text-[var(--accent)] hover:underline">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Activity */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h2 className="text-xs font-medium text-[var(--text-muted)] mb-3">Activity</h2>
        <ol className="space-y-3">
          {events.map((event) => (
            <li key={event.id} className="flex gap-3">
              <FileText size={12} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {event.message ?? event.type}
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {event.actorRole ?? "system"} ·{" "}
                  {event.createdAt ? new Date(event.createdAt).toLocaleString() : ""}
                </p>
              </div>
            </li>
          ))}
          {events.length === 0 && (
            <li className="text-[11px] text-[var(--text-muted)]">No activity yet.</li>
          )}
        </ol>
      </div>
    </div>
  );
}
