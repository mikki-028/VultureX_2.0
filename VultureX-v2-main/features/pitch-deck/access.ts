/**
 * Role-based access control for the pitch deck workflow.
 *
 * Every server component and API route goes through these helpers — never
 * frontend state, URLs or profile fields.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { startups, pitchDeckRequests, pitchDeckFiles, type PitchDeckStatus } from "@/db/schema";
import { auth } from "@/features/auth";
import { isUuid } from "@/lib/utils";

export type Role = "startup" | "investor" | "admin";

export type Actor = {
  userId: string;
  role: Role;
  email: string | null;
};

export async function getActor(): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const role = (session.user as { role?: string }).role as Role | undefined;
  if (!role) return null;
  return { userId: session.user.id, role, email: session.user.email ?? null };
}

export async function requireAdmin(): Promise<Actor | null> {
  const actor = await getActor();
  if (!actor || actor.role !== "admin") return null;
  return actor;
}

export type StartupContext = {
  actor: Actor;
  startup: typeof startups.$inferSelect;
};

export async function requireStartup(): Promise<StartupContext | null> {
  const actor = await getActor();
  if (!actor || actor.role !== "startup") return null;
  const [startup] = await db
    .select()
    .from(startups)
    .where(eq(startups.userId, actor.userId))
    .limit(1);
  if (!startup) return null;
  return { actor, startup };
}

export type RequestRecord = typeof pitchDeckRequests.$inferSelect;

/**
 * Loads a request and asserts the actor may see it.
 *  - startups: only their own requests (the startupId must belong to them)
 *  - admins: any request
 * Returns null when the actor must not see it (callers respond 403/404).
 */
export async function loadRequestForActor(
  requestId: string,
  actor: Actor,
): Promise<{ request: RequestRecord; startup: typeof startups.$inferSelect } | null> {
  // A malformed id can never match a row; bail out before Postgres rejects it.
  if (!isUuid(requestId)) return null;

  const [request] = await db
    .select()
    .from(pitchDeckRequests)
    .where(eq(pitchDeckRequests.id, requestId))
    .limit(1);
  if (!request) return null;

  const [startup] = await db
    .select()
    .from(startups)
    .where(eq(startups.id, request.startupId))
    .limit(1);
  if (!startup) return null;

  if (actor.role === "admin") return { request, startup };

  // Startup ownership: the request's user AND startup must match the actor.
  if (
    actor.role === "startup" &&
    request.userId === actor.userId &&
    startup.userId === actor.userId
  ) {
    return { request, startup };
  }

  return null;
}

/**
 * A deck is readable by its owning startup after publication, and by any
 * authenticated investor once published (the deck is the investor-facing
 * artefact). Screenshots stay private to the owner and admins.
 */
export function canReadFile(
  file: typeof pitchDeckFiles.$inferSelect,
  actor: Actor,
  ownerUserId: string,
): boolean {
  if (actor.role === "admin") return true;
  if (file.kind === "deck" && file.isPublished && actor.role === "investor") {
    return true;
  }
  if (actor.userId !== ownerUserId) return false;
  if (file.kind === "product_screenshot") return true;
  return file.isPublished;
}

export const STATUS_LABELS: Record<PitchDeckStatus, string> = {
  incomplete: "Questionnaire incomplete",
  pending_approval: "Awaiting your approval",
  approved: "Approved — queued for our team",
  in_progress: "Pitch Deck In Progress",
  rejected: "Changes required",
  completed: "Completed",
};
