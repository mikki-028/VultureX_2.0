import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/features/auth";
import { db } from "@/db";
import { startupImpactClaims, impactVerificationEvents, startups, notifications } from "@/db/schema";

const ACTIONS = ["verified", "rejected", "changes_requested"] as const;
type ReviewAction = (typeof ACTIONS)[number];

/**
 * Admin review of an SDG impact claim.
 *
 * Authorization is resolved from the session on the server. A startup or
 * investor can never call this route successfully, and the client cannot set
 * its own status through the profile API.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: { action?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const action = ACTIONS.includes(body.action as ReviewAction)
    ? (body.action as ReviewAction)
    : null;
  if (!action) {
    return NextResponse.json({ error: "Unknown review action" }, { status: 400 });
  }

  const note =
    typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";

  // A rejection or a request for more information must tell the founder why.
  if (action !== "verified" && note.length < 3) {
    return NextResponse.json(
      { error: "Add a short note explaining the decision." },
      { status: 400 }
    );
  }

  try {
    const [claim] = await db
      .select()
      .from(startupImpactClaims)
      .where(eq(startupImpactClaims.id, id))
      .limit(1);

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(startupImpactClaims)
      .set({
        status: action,
        reviewNote: note || null,
        reviewedAt: new Date(),
        reviewedByUserId: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(startupImpactClaims.id, claim.id))
      .returning();

    await db.insert(impactVerificationEvents).values({
      startupId: claim.startupId,
      claimId: claim.id,
      action,
      actorUserId: session.user.id,
      actorRole: "admin",
      note: note || null,
    });

    revalidatePath("/admin/impact");
    revalidatePath("/settings");

    try {
      const [startup] = await db
        .select({ userId: startups.userId })
        .from(startups)
        .where(eq(startups.id, claim.startupId))
        .limit(1);
      if (startup?.userId) {
        await db.insert(notifications).values({
          recipientUserId: startup.userId,
          actorUserId: session.user.id,
          type: "impact_review",
          body: `Your SDG impact claim was ${action.replace(/_/g, " ")}.${note ? ` Note: ${note}` : ""}`,
        });
      }
    } catch (error) {
      console.error("Failed to notify founder about impact review:", error);
    }

    return NextResponse.json({ claim: updated });
  } catch (error) {
    console.error("Failed to review impact claim:", error);
    return NextResponse.json(
      { error: "Failed to update the impact claim" },
      { status: 500 }
    );
  }
}
