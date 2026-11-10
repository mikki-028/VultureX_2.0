import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { pitchDeckEvents, pitchDeckRequests } from "@/db/schema";
import { requireAdmin } from "@/features/pitch-deck";
import { notifyPitchDeckFounder } from "@/features/pitch-deck/notify";
import { isUuid } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * POST — an admin rejects an active request with a mandatory, founder-visible
 * reason. The immutable event row records who rejected it and when. A rejected
 * request cannot be uploaded or published until the founder reopens it.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 5 || reason.length > 500) {
    return NextResponse.json(
      { error: "Provide a rejection reason between 5 and 500 characters." },
      { status: 400 }
    );
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [record] = await tx
        .select()
        .from(pitchDeckRequests)
        .where(eq(pitchDeckRequests.id, id))
        .for("update")
        .limit(1);

      if (!record) return { status: 404 as const, error: "Not found" };
      if (record.status === "rejected") {
        return {
          status: 409 as const,
          error: "This request has already been rejected. The founder must reopen it first.",
        };
      }
      if (record.status === "completed") {
        return {
          status: 409 as const,
          error: "Published decks cannot be rejected. Use the revision workflow instead.",
        };
      }
      if (record.status === "incomplete") {
        return {
          status: 409 as const,
          error: "Only submitted requests can be rejected.",
        };
      }

      const [updated] = await tx
        .update(pitchDeckRequests)
        .set({ status: "rejected", adminNote: reason, updatedAt: new Date() })
        .where(
          and(
            eq(pitchDeckRequests.id, record.id),
            ne(pitchDeckRequests.status, "rejected"),
            ne(pitchDeckRequests.status, "completed")
          )
        )
        .returning();

      if (!updated) {
        return {
          status: 409 as const,
          error: "This request changed while you were rejecting it. Reload and try again.",
        };
      }

      await tx.insert(pitchDeckEvents).values({
        requestId: record.id,
        actorId: admin.userId,
        actorRole: "admin",
        type: "rejected",
        message: `Rejected by ${admin.email ?? "admin"}: ${reason}`,
      });

      return { status: 200 as const, request: updated };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await notifyPitchDeckFounder({
      recipientUserId: result.request.userId,
      actorUserId: admin.userId,
      type: "pitch_deck_status",
      body: `Your pitch deck request "${result.request.title}" needs changes: ${reason}`,
    });

    return NextResponse.json({ request: result.request });
  } catch (error) {
    console.error("Failed to reject pitch deck request:", error);
    return NextResponse.json({ error: "Failed to reject request" }, { status: 500 });
  }
}
