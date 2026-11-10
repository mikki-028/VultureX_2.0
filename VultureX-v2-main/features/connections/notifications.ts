import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  connectionRequests,
  notifications,
  users,
  type NotificationType,
} from "@/db/schema";
import { isUuid } from "@/lib/utils";
import { ConnectionError } from "./errors";
import { getProfiles, type ProfileSummary } from "./profiles";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  body: string | null;
  createdAt: string;
  readAt: string | null;
  actor: ProfileSummary | null;
  requestId: string | null;
  requestStatus: string | null;
  conversationId: string | null;
  competitionId: string | null;
  applicationId: string | null;
  reminderId: string | null;
  href: string;
};

function hrefFor(
  type: NotificationType,
  conversationId: string | null,
  competitionId: string | null,
  role: string
): string {
  if (type === "message" || type === "request_accepted") {
    return conversationId ? `/messages?c=${conversationId}` : "/messages";
  }
  if (type === "reminder_due") return "/knowledge-hub/for-you/reminders";
  if (type === "business_match") return "/discover";
  if (type.startsWith("pitch_deck"))
    return role === "admin" ? "/admin/pitch-decks" : "/pitch-decks";
  if (type === "impact_submitted") return "/admin/impact";
  if (type === "impact_review") return "/knowledge-hub/impact";
  if (type.startsWith("competition")) {
    if (!competitionId) return "/competitions";
    if (type === "competition_application_status")
      return "/competitions/applications";
    if (type === "competition_winner_proposed")
      return `/admin/competitions/${competitionId}`;
    if (type === "competition_review")
      return role === "admin"
        ? `/admin/competitions/${competitionId}`
        : `/competitions/manage/${competitionId}`;
    if (type === "competition_application")
      return `/competitions/manage/${competitionId}`;
    if (type === "competition_winner_announced" && role === "investor")
      return `/competitions/manage/${competitionId}`;
    return `/competitions/${competitionId}`;
  }
  return "/interests";
}

export async function getNotifications(userId: string) {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      body: notifications.body,
      createdAt: notifications.createdAt,
      readAt: notifications.readAt,
      actorUserId: notifications.actorUserId,
      requestId: notifications.requestId,
      conversationId: notifications.conversationId,
      competitionId: notifications.competitionId,
      applicationId: notifications.applicationId,
      reminderId: notifications.reminderId,
      requestStatus: connectionRequests.status,
      recipientRole: users.role,
    })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.recipientUserId))
    .leftJoin(
      connectionRequests,
      eq(connectionRequests.id, notifications.requestId)
    )
    .where(eq(notifications.recipientUserId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(30);

  const profiles = await getProfiles(
    rows.map((row) => row.actorUserId).filter((id): id is string => !!id)
  );

  const items: NotificationItem[] = rows.map((row) => ({
    id: row.id,
    type: row.type,
    body: row.body,
    createdAt: (row.createdAt ?? new Date()).toISOString(),
    readAt: row.readAt ? row.readAt.toISOString() : null,
    actor: row.actorUserId ? profiles.get(row.actorUserId) ?? null : null,
    requestId: row.requestId,
    requestStatus: row.requestStatus,
    conversationId: row.conversationId,
    competitionId: row.competitionId,
    applicationId: row.applicationId,
    reminderId: row.reminderId,
    href: hrefFor(
      row.type,
      row.conversationId,
      row.competitionId,
      row.recipientRole
    ),
  }));

  const unreadCount = items.filter((item) => !item.readAt).length;
  return { notifications: items, unreadCount };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  if (!isUuid(notificationId)) {
    throw new ConnectionError("Notification not found.", 404, "NOTIFICATION_NOT_FOUND");
  }

  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.recipientUserId, userId)
      )
    )
    .returning({ id: notifications.id });

  if (!updated) {
    throw new ConnectionError("Notification not found.", 404, "NOTIFICATION_NOT_FOUND");
  }

  return { ok: true };
}

export async function markAllNotificationsRead(userId: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.recipientUserId, userId),
        isNull(notifications.readAt)
      )
    );
  return { ok: true };
}

export async function getNotificationUnreadCount(userId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, userId),
        isNull(notifications.readAt)
      )
    );
  return Number(row?.count ?? 0);
}
