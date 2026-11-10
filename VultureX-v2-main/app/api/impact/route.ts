import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/features/auth";
import { db } from "@/db";
import {
  startups,
  startupImpactClaims,
  impactVerificationEvents,
  notifications,
  users,
} from "@/db/schema";
import { normalizeSdgPrimary, sanitizeSdgIds } from "@/features/sdg/taxonomy";
import {
  computeClaimSignature,
  normalizeImpactDescription,
} from "@/features/sdg/verification";
import { MIN_IMPACT_DESCRIPTION_LENGTH } from "@/features/sdg/status";

/**
 * Startup-side impact verification.
 *
 * A founder can only submit or withdraw the claim for the startup profile they
 * own (resolved from the session, never from the payload). Admins are the only
 * role that can change the review status.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "startup") {
    return NextResponse.json(
      { error: "Only startup accounts can submit impact claims" },
      { status: 403 }
    );
  }

  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const action = body.action === "withdraw" ? "withdraw" : "submit";

  try {
    const [startup] = await db
      .select()
      .from(startups)
      .where(eq(startups.userId, session.user.id))
      .limit(1);

    if (!startup) {
      return NextResponse.json(
        { error: "Create your startup profile first" },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(startupImpactClaims)
      .where(eq(startupImpactClaims.startupId, startup.id))
      .limit(1);

    if (action === "withdraw") {
      if (!existing || existing.status !== "pending") {
        return NextResponse.json(
          { error: "Only a pending claim can be withdrawn" },
          { status: 400 }
        );
      }
      await db
        .delete(startupImpactClaims)
        .where(eq(startupImpactClaims.id, existing.id));
      await db.insert(impactVerificationEvents).values({
        startupId: startup.id,
        claimId: existing.id,
        action: "withdrawn",
        actorUserId: session.user.id,
        actorRole: "startup",
      });
      return NextResponse.json({ status: "not_submitted" });
    }

    const sdgGoals = sanitizeSdgIds(startup.sdgGoals ?? []);
    const sdgPrimary = normalizeSdgPrimary(sdgGoals, startup.sdgPrimary);
    const impactDescription = normalizeImpactDescription(startup.impactDescription);

    if (sdgGoals.length === 0) {
      return NextResponse.json(
        { error: "Select at least one SDG before requesting verification." },
        { status: 400 }
      );
    }
    if (impactDescription.length < MIN_IMPACT_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        {
          error: `Add an impact description of at least ${MIN_IMPACT_DESCRIPTION_LENGTH} characters before requesting verification.`,
        },
        { status: 400 }
      );
    }

    const claimSignature = computeClaimSignature({
      sdgGoals,
      sdgPrimary,
      impactDescription,
    });

    // Re-submitting an unchanged pending claim is a no-op so retries and
    // double clicks never create duplicate review items or events.
    if (
      existing &&
      existing.status === "pending" &&
      existing.claimSignature === claimSignature
    ) {
      return NextResponse.json({ claim: existing, status: "pending" });
    }

    const [claim] = await db
      .insert(startupImpactClaims)
      .values({
        startupId: startup.id,
        status: "pending",
        impactDescription,
        sdgGoals,
        sdgPrimary,
        claimSignature,
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: startupImpactClaims.startupId,
        set: {
          status: "pending",
          impactDescription,
          sdgGoals,
          sdgPrimary,
          claimSignature,
          reviewNote: null,
          reviewedAt: null,
          reviewedByUserId: null,
          submittedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();

    await db.insert(impactVerificationEvents).values({
      startupId: startup.id,
      claimId: claim.id,
      action: "submitted",
      actorUserId: session.user.id,
      actorRole: "startup",
      note:
        existing?.status === "verified"
          ? "Claim resubmitted after the profile changed."
          : null,
    });

    try {
      const admins = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "admin"));
      for (const admin of admins) {
        await db.insert(notifications).values({
          recipientUserId: admin.id,
          actorUserId: session.user.id,
          type: "impact_submitted",
          body: `${startup.name} submitted an SDG impact claim for review.`,
        });
      }
    } catch (error) {
      console.error("Failed to notify admins about impact claim:", error);
    }

    return NextResponse.json({ claim, status: claim.status });
  } catch (error) {
    console.error("Failed to submit impact claim:", error);
    return NextResponse.json(
      { error: "Failed to submit impact claim" },
      { status: 500 }
    );
  }
}
