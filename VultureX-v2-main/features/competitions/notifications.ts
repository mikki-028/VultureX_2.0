import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  investors,
  notifications,
  startups,
  startupImpactClaims,
  users,
  type CompetitionEligibility,
  type NotificationType,
} from "@/db/schema";
import { effectiveImpactStatus } from "@/features/sdg/verification";
import type { CompetitionActor } from "./access";
import { evaluateEligibility } from "./eligibility";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type NotificationInput = {
  recipientUserId: string;
  actorUserId: string | null;
  type: NotificationType;
  body: string;
  competitionId?: string | null;
  applicationId?: string | null;
};

async function insertOne(tx: Tx, input: NotificationInput) {
  await tx.insert(notifications).values(input).onConflictDoNothing();
}

/** Eligible startup accounts only, used for publication fan-out. */
export async function notifyStartupsOfPublication(
  tx: Tx,
  competition: {
    id: string;
    title: string;
    sector: string | null;
    deadline: Date | null;
    prize: string | null;
    eligibility: CompetitionEligibility | null;
  },
  hostLabel: string,
  prizeLabelText: string | null
): Promise<number> {
  const recipients = await tx
    .select({ startup: startups })
    .from(startups)
    .innerJoin(users, eq(users.id, startups.userId))
    .where(eq(users.role, "startup"));

  const startupIds = recipients.map((entry) => entry.startup.id);
  const claims = startupIds.length
    ? await tx
        .select()
        .from(startupImpactClaims)
        .where(inArray(startupImpactClaims.startupId, startupIds))
    : [];
  const claimByStartup = new Map(claims.map((claim) => [claim.startupId, claim]));

  const eligibleRecipients = recipients.filter(({ startup }) => {
    const claim = claimByStartup.get(startup.id) ?? null;
    const result = evaluateEligibility(startup, competition.eligibility, {
      status: effectiveImpactStatus(startup, claim),
    });
    return result.status === "eligible" || result.status === "open";
  });

  const closing = competition.deadline
    ? `closes ${competition.deadline.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`
    : "applications open";
  const details = [
    competition.sector,
    closing,
    prizeLabelText || competition.prize,
  ]
    .filter(Boolean)
    .join(" · ");

  const body = `${hostLabel} published "${competition.title}". ${details}`;

  for (const recipient of eligibleRecipients) {
    if (!recipient.startup.userId) continue;
    await insertOne(tx, {
      recipientUserId: recipient.startup.userId,
      actorUserId: null,
      type: "competition_published",
      body,
      competitionId: competition.id,
    });
  }

  return eligibleRecipients.length;
}

export async function notifyInvestor(
  tx: Tx,
  investorId: string | null,
  input: Omit<NotificationInput, "recipientUserId">
) {
  if (!investorId) return;
  const [row] = await tx
    .select({ userId: investors.userId })
    .from(investors)
    .where(eq(investors.id, investorId))
    .limit(1);
  if (!row?.userId) return;
  await insertOne(tx, { ...input, recipientUserId: row.userId });
}

export async function notifyStartup(
  tx: Tx,
  startupId: string,
  input: Omit<NotificationInput, "recipientUserId">
) {
  const [row] = await tx
    .select({ userId: startups.userId })
    .from(startups)
    .where(eq(startups.id, startupId))
    .limit(1);
  if (!row?.userId) return;
  await insertOne(tx, { ...input, recipientUserId: row.userId });
}

export async function notifyAdmins(
  tx: Tx,
  input: Omit<NotificationInput, "recipientUserId">
) {
  const admins = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"));
  for (const admin of admins) {
    await insertOne(tx, { ...input, recipientUserId: admin.id });
  }
}

/** Used by tests/tools: an actor's display name with a safe fallback. */
export function actorLabel(actor: CompetitionActor): string {
  return (
    actor.investor?.firmName ||
    actor.investor?.fullName ||
    actor.name ||
    actor.email ||
    "An investor"
  );
}
