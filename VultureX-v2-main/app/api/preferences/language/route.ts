import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { founderProfiles } from "@/db/schema";
import { auth } from "@/features/auth";
import { isLocale, type Locale } from "@/features/i18n/messages";
import { LANGUAGE_COOKIE } from "@/features/i18n/server";

/**
 * Saves only the interface language. This is intentionally separate from the
 * full founder profile form so the global quick switcher cannot overwrite
 * preferences it does not own.
 */
export async function PATCH(request: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (role !== "startup") {
    return NextResponse.json(
      { error: "Language personalization is available to founder accounts." },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    preferredLanguage?: unknown;
  };
  if (!isLocale(body.preferredLanguage)) {
    return NextResponse.json(
      { error: "Choose English, Hindi or Punjabi." },
      { status: 400 }
    );
  }

  const preferredLanguage: Locale = body.preferredLanguage;
  await db
    .insert(founderProfiles)
    .values({ userId: session.user.id, preferredLanguage })
    .onConflictDoUpdate({
      target: founderProfiles.userId,
      set: { preferredLanguage, updatedAt: new Date() },
    });

  revalidatePath("/knowledge-hub", "layout");
  revalidatePath("/knowledge-hub/for-you");
  revalidatePath("/knowledge-hub/for-you/profile");
  revalidatePath("/discover");
  revalidatePath("/dashboard");

  const response = NextResponse.json({ preferredLanguage });
  response.cookies.set(LANGUAGE_COOKIE, preferredLanguage, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
