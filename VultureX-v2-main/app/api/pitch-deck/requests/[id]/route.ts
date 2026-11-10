import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pitchDeckEvents, pitchDeckFiles, pitchDeckRequests } from "@/db/schema";
import {
  allBatchesComplete,
  getActor,
  loadRequestForActor,
  sanitizeAnswers,
  validateBatch,
  buildDeckSummary,
  type BatchNumber,
  type DeckSummary,
} from "@/features/pitch-deck";
import { notifyPitchDeckAdmins } from "@/features/pitch-deck/notify";

type Body = {
  action?: "save_batch" | "submit" | "save_summary" | "approve" | "revise";
  batch?: number;
  answers?: Record<string, unknown>;
  summary?: DeckSummary;
  note?: string;
};

/**
 * GET   — request detail (owner startup or admin)
 * PATCH — autosave batches, submit, save summary, approve, revise
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const found = await loadRequestForActor(id, actor);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ request: found.request, startup: found.startup });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const found = await loadRequestForActor(id, actor);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { request: record, startup } = found;
  const isOwner = actor.role === "startup" && record.userId === actor.userId;

  // Only the owning startup may modify its own request through this route.
  if (!isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const action = body.action;

  // ---------------------------------------------------------------- save batch
  if (action === "save_batch") {
    const batch = (Number(body.batch) || 1) as BatchNumber;
    if (![1, 2, 3].includes(batch)) {
      return NextResponse.json({ error: "Invalid batch" }, { status: 400 });
    }

    const answers = { ...(record.answers as Record<string, unknown>), ...sanitizeAnswers(body.answers) };
    const errors = validateBatch(batch, answers);

    const [updated] = await db
      .update(pitchDeckRequests)
      .set({ answers, currentBatch: batch, updatedAt: new Date() })
      .where(eq(pitchDeckRequests.id, record.id))
      .returning();

    return NextResponse.json({ request: updated, errors, savedAt: new Date().toISOString() });
  }

  // ------------------------------------------------------------------- submit
  if (action === "submit") {
    const answers = { ...(record.answers as Record<string, unknown>), ...sanitizeAnswers(body.answers) };
    const batchErrors = {
      1: validateBatch(1, answers),
      2: validateBatch(2, answers),
      3: validateBatch(3, answers),
    };

    if (!allBatchesComplete(answers)) {
      return NextResponse.json(
        {
          error: "Some required answers are still missing.",
          batchErrors,
        },
        { status: 400 },
      );
    }

    const [screenshot] = await db
      .select({ id: pitchDeckFiles.id })
      .from(pitchDeckFiles)
      .where(eq(pitchDeckFiles.requestId, record.id))
      .limit(1);

    const summary = buildDeckSummary({
      startup,
      answers,
      screenshotFileId: screenshot?.id ?? null,
      previousSummary: (record.summary as DeckSummary | null) ?? null,
    });

    const [updated] = await db
      .update(pitchDeckRequests)
      .set({
        answers,
        summary,
        status: record.status === "incomplete" ? "pending_approval" : record.status,
        submittedAt: record.submittedAt ?? new Date(),
        currentBatch: 3,
        updatedAt: new Date(),
      })
      .where(eq(pitchDeckRequests.id, record.id))
      .returning();

    await db.insert(pitchDeckEvents).values({
      requestId: record.id,
      actorId: actor.userId,
      actorRole: "startup",
      type: "submitted",
      message: "Questionnaire submitted — summary ready for review",
    });

    await notifyPitchDeckAdmins({
      actorUserId: actor.userId,
      body: `${startup.name} submitted "${record.title}" for pitch deck review.`,
    });

    return NextResponse.json({ request: updated });
  }

  // -------------------------------------------------------------- save summary
  if (action === "save_summary") {
    if (!body.summary) {
      return NextResponse.json({ error: "Missing summary" }, { status: 400 });
    }
    const wasApproved = record.status !== "incomplete" && record.status !== "pending_approval";

    const [updated] = await db
      .update(pitchDeckRequests)
      .set({
        summary: body.summary,
        summaryChangedSinceApproval: wasApproved ? true : record.summaryChangedSinceApproval,
        status: wasApproved ? "pending_approval" : record.status,
        updatedAt: new Date(),
      })
      .where(eq(pitchDeckRequests.id, record.id))
      .returning();

    await db.insert(pitchDeckEvents).values({
      requestId: record.id,
      actorId: actor.userId,
      actorRole: "startup",
      type: "summary_edited",
      message: wasApproved ? "Summary edited after approval" : "Summary updated",
    });

    return NextResponse.json({ request: updated, savedAt: new Date().toISOString() });
  }

  // ------------------------------------------------------------------ approve
  if (action === "approve") {
    // The client always sends its current (possibly edited) summary with the
    // approval, so unsaved changes can never be approved by accident.
    const summary = body.summary ?? (record.summary as DeckSummary | null);
    if (!summary || !Array.isArray(summary.sections)) {
      return NextResponse.json({ error: "Nothing to approve yet." }, { status: 400 });
    }

    if (record.status === "approved" || record.status === "in_progress" || record.status === "completed") {
      return NextResponse.json({ request: record, alreadyApproved: true });
    }

    const now = new Date();
    const [updated] = await db
      .update(pitchDeckRequests)
      .set({
        summary,
        approvedSummary: summary,
        status: "approved",
        approvedAt: now,
        summaryChangedSinceApproval: false,
        updatedAt: now,
      })
      .where(eq(pitchDeckRequests.id, record.id))
      .returning();

    await db.insert(pitchDeckEvents).values({
      requestId: record.id,
      actorId: actor.userId,
      actorRole: "startup",
      type: "approved",
      message: `Summary approved by ${actor.email ?? "founder"}`,
    });

    await notifyPitchDeckAdmins({
      actorUserId: actor.userId,
      body: `${startup.name} approved the summary for "${record.title}". The deck can now be prepared.`,
    });

    return NextResponse.json({ request: updated });
  }

  // ------------------------------------------------------------------- revise
  if (action === "revise") {
    if (record.status === "completed") {
      return NextResponse.json(
        { error: "Use “Improve this deck” to start a revision of a published deck." },
        { status: 409 },
      );
    }
    const now = new Date();
    const [updated] = await db
      .update(pitchDeckRequests)
      .set({
        status: "pending_approval",
        summaryChangedSinceApproval: true,
        revisionRequestedAt: now,
        updatedAt: now,
      })
      .where(eq(pitchDeckRequests.id, record.id))
      .returning();

    await db.insert(pitchDeckEvents).values({
      requestId: record.id,
      actorId: actor.userId,
      actorRole: "startup",
      type: "revision_requested",
      message: body.note?.trim() || "Founder reopened the summary for corrections",
    });

    return NextResponse.json({ request: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
