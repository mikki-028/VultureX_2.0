import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications, users, type NotificationType } from "@/db/schema";

/**
 * Pitch deck notifications are in-app only. They are best-effort: a notification
 * failure must never roll back a request, upload or publication that succeeded.
 */
async function insertNotification(input: {
  recipientUserId: string;
  actorUserId: string | null;
  type: NotificationType;
  body: string;
}) {
  try {
    await db.insert(notifications).values(input);
  } catch (error) {
    console.error("Failed to create pitch deck notification:", error);
  }
}

export async function notifyPitchDeckAdmins(input: {
  actorUserId: string;
  body: string;
}) {
  try {
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"));
    for (const admin of admins) {
      await insertNotification({
        recipientUserId: admin.id,
        actorUserId: input.actorUserId,
        type: "pitch_deck_submitted",
        body: input.body,
      });
    }
  } catch (error) {
    console.error("Failed to notify admins about a pitch deck:", error);
  }
}

export async function notifyPitchDeckFounder(input: {
  recipientUserId: string;
  actorUserId: string;
  body: string;
  type?: NotificationType;
}) {
  await insertNotification({
    recipientUserId: input.recipientUserId,
    actorUserId: input.actorUserId,
    type: input.type ?? "pitch_deck_status",
    body: input.body,
  });
}
