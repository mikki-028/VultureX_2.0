import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/features/auth";
import { db } from "@/db";
import { investors } from "@/db/schema";
import { sanitizeSdgIds } from "@/features/sdg/taxonomy";

// Creates or updates the investor profile for the authenticated user
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();

    // Required by the schema, and an empty value would otherwise let a partial
    // payload wipe the rest of an investor's saved profile.
    if (
      typeof data?.fullName !== "string" ||
      !data.fullName.trim() ||
      typeof data?.investorType !== "string" ||
      !data.investorType.trim()
    ) {
      return NextResponse.json(
        { error: "fullName and investorType are required" },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(investors)
      .where(eq(investors.userId, session.user.id))
      .limit(1);

    const investorData = {
      userId: session.user.id,
      fullName: data.fullName,
      investorType: data.investorType,
      firmName: data.firmName || null,
      location: data.location || null,
      checkSizeMin: data.checkSizeMin || 0,
      checkSizeMax: data.checkSizeMax || 0,
      stageFocus: data.stageFocus || [],
      sectorFocus: data.sectorFocus || [],
      // Only rewrite when the payload carries the field so older forms and
      // partial clients cannot wipe an investor's saved interests.
      sdgPreferences:
        "sdgPreferences" in data
          ? sanitizeSdgIds(data.sdgPreferences)
          : (existing?.sdgPreferences ?? []),
      investmentThesis: data.investmentThesis || null,
      linkedin: data.linkedin || null,
    };

    if (existing) {
      const [updated] = await db
        .update(investors)
        .set(investorData)
        .where(eq(investors.id, existing.id))
        .returning();
      return NextResponse.json(updated);
    }

    const [created] = await db
      .insert(investors)
      .values(investorData)
      .returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to save investor profile:", error);
    return NextResponse.json(
      { error: "Failed to save investor profile" },
      { status: 500 }
    );
  }
}
