import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pitchDeckEvents, pitchDeckRequests, type PitchDeckStatus } from "@/db/schema";
import { requireAdmin } from "@/features/pitch-deck";
import { notifyPitchDeckFounder } from "@/features/pitch-deck/notify";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

const ADMIN_SETTABLE: PitchDeckStatus[] = ["approved", "in_progress"];

/**
 * POST — admin marks an approved request as in progress (or back to approved)
 * and can leave an internal note that the founder sees on their dashboard.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    status?: PitchDeckStatus;
    note?: string;
  };

  const [record] = await db
    .select()
    .from(pitchDeckRequests)
    .where(eq(pitchDeckRequests.id, id))
    .limit(1);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (record.status === "rejected" && body.status) {
    return NextResponse.json(
      { error: "This request was rejected. The founder must reopen it before its status changes." },
      { status: 409 },
    );
  }

  const patch: Partial<typeof pitchDeckRequests.$inferInsert> = { updatedAt: new Date() };

  if (body.status) {
    if (!ADMIN_SETTABLE.includes(body.status)) {
      return NextResponse.json({ error: "Unsupported status change." }, { status: 400 });
    }
    if (!record.approvedSummary) {
      return NextResponse.json(
        { error: "The founder has not approved a summary for this request yet." },
        { status: 409 },
      );
    }
    patch.status = body.status;
  }

  if (typeof body.note === "string") {
    patch.adminNote = body.note.trim().slice(0, 500) || null;
  }

  const [updated] = await db
    .update(pitchDeckRequests)
    .set(patch)
    .where(eq(pitchDeckRequests.id, record.id))
    .returning();

  await db.insert(pitchDeckEvents).values({
    requestId: record.id,
    actorId: admin.userId,
    actorRole: "admin",
    type: "admin_update",
    message: body.note?.trim()
      ? `Admin: ${body.note.trim().slice(0, 200)}`
      : `Status set to ${updated.status}`,
  });

  await notifyPitchDeckFounder({
    recipientUserId: record.userId,
    actorUserId: admin.userId,
    body: body.note?.trim()
      ? `Your pitch deck request was updated: ${body.note.trim().slice(0, 200)}`
      : `Your pitch deck request is now ${updated.status.replace(/_/g, " ")}.`,
  });

  return NextResponse.json({ request: updated });
}
