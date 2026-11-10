import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { founderProfiles } from "@/db/schema";
import { auth } from "@/features/auth";
import { isLocale, type Locale } from "./messages";

export const LANGUAGE_COOKIE = "vx_language";

/**
 * Resolves the interface locale for the current request. A signed-in founder's
 * saved preference wins, then the short-lived cookie written by the switcher,
 * then English. React `cache` keeps this to one lookup per request.
 */
export const getRequestLocale = cache(async (): Promise<Locale> => {
  const session = await auth();
  const userId = session?.user?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (userId && role === "startup") {
    try {
      const [profile] = await db
        .select({ preferredLanguage: founderProfiles.preferredLanguage })
        .from(founderProfiles)
        .where(eq(founderProfiles.userId, userId))
        .limit(1);
      if (isLocale(profile?.preferredLanguage)) return profile.preferredLanguage;
    } catch (error) {
      // A locale lookup must never take the page down; fall through to English.
      console.error("Failed to resolve founder language:", error);
    }
  }

  const jar = await cookies();
  const stored = jar.get(LANGUAGE_COOKIE)?.value;
  return isLocale(stored) ? stored : "en";
});
