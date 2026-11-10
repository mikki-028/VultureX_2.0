/**
 * Roadmap persistence. Every query is scoped by the authenticated account and
 * startup ownership; no route accepts an owner id from the client.
 */

import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  roadmapMilestones,
  roadmapTasks,
  startups,
  ROADMAP_MILESTONE_STATUSES,
  ROADMAP_TASK_PRIORITIES,
  ROADMAP_TASK_STATUSES,
  type RoadmapMilestoneStatus,
  type RoadmapTaskPriority,
  type RoadmapTaskStatus,
} from "@/db/schema";
import {
  buildRoadmapRecommendations,
  computeRoadmapProgress,
  getStageTemplate,
  normalizeRoadmapStage,
  roadmapStageLabel,
} from "./stages";
import type {
  RoadmapMilestoneView,
  RoadmapOverview,
  RoadmapStageView,
  RoadmapTaskView,
} from "./types";

export class RoadmapValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoadmapValidationError";
  }
}

export type CreateTaskInput = {
  title: string;
  description: string | null;
  category: string;
  priority: RoadmapTaskPriority;
  dueDate: Date | null;
};

export type UpdateTaskInput = {
  status?: RoadmapTaskStatus;
  dueDate?: Date | null;
};

export type CreateMilestoneInput = {
  title: string;
  description: string | null;
  targetDate: Date | null;
};

export type UpdateMilestoneInput = {
  status?: RoadmapMilestoneStatus;
  targetDate?: Date | null;
};

function toTaskView(row: typeof roadmapTasks.$inferSelect): RoadmapTaskView {
  return {
    id: row.id,
    taskKey: row.taskKey,
    stage: row.stage,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    source: row.source,
    sortOrder: row.sortOrder,
  };
}

function toMilestoneView(
  row: typeof roadmapMilestones.$inferSelect
): RoadmapMilestoneView {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    targetDate: row.targetDate ? row.targetDate.toISOString() : null,
    achievedAt: row.achievedAt ? row.achievedAt.toISOString() : null,
  };
}

export async function getOwnedStartup(userId: string) {
  const [startup] = await db
    .select()
    .from(startups)
    .where(eq(startups.userId, userId))
    .limit(1);
  return startup ?? null;
}

export async function loadRoadmap(
  userId: string,
  startupId: string,
  stage: string
): Promise<RoadmapOverview> {
  const [taskRows, milestoneRows] = await Promise.all([
    db
      .select()
      .from(roadmapTasks)
      .where(and(eq(roadmapTasks.userId, userId), eq(roadmapTasks.startupId, startupId)))
      .orderBy(asc(roadmapTasks.sortOrder), asc(roadmapTasks.createdAt)),
    db
      .select()
      .from(roadmapMilestones)
      .where(
        and(eq(roadmapMilestones.userId, userId), eq(roadmapMilestones.startupId, startupId))
      )
      .orderBy(asc(roadmapMilestones.createdAt)),
  ]);

  const stageView: RoadmapStageView = {
    key: normalizeRoadmapStage(stage),
    label: roadmapStageLabel(stage),
    raw: stage,
  };

  return {
    stage: stageView,
    tasks: taskRows.map(toTaskView),
    milestones: milestoneRows.map(toMilestoneView),
    progress: computeRoadmapProgress(taskRows, milestoneRows),
    recommendations: buildRoadmapRecommendations({
      stage,
      tasks: taskRows,
      milestones: milestoneRows,
    }),
  };
}

/**
 * Adds the stage checklist for the startup's *current* saved stage. Existing
 * keys are left untouched, so changing stage later adds new suggestions without
 * resetting any completed task.
 */
export async function addStageTasks(
  userId: string,
  startup: { id: string; stage: string }
): Promise<{ inserted: number; stage: string; label: string }> {
  const stage = normalizeRoadmapStage(startup.stage);
  const template = getStageTemplate(startup.stage);

  const existing = await db
    .select({ taskKey: roadmapTasks.taskKey })
    .from(roadmapTasks)
    .where(and(eq(roadmapTasks.userId, userId), eq(roadmapTasks.startupId, startup.id)));
  const existingKeys = new Set(existing.map((row) => row.taskKey));

  const rows = template
    .filter((task) => !existingKeys.has(task.taskKey))
    .map((task) => ({
      userId,
      startupId: startup.id,
      taskKey: task.taskKey,
      stage,
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      status: "not_started" as const,
      sortOrder: task.sortOrder,
      source: "template" as const,
    }));

  if (rows.length === 0) {
    return { inserted: 0, stage, label: roadmapStageLabel(startup.stage) };
  }

  const inserted = await db
    .insert(roadmapTasks)
    .values(rows)
    .onConflictDoNothing({ target: [roadmapTasks.startupId, roadmapTasks.taskKey] })
    .returning({ id: roadmapTasks.id });

  return {
    inserted: inserted.length,
    stage,
    label: roadmapStageLabel(startup.stage),
  };
}

export async function createCustomTask(
  userId: string,
  startup: { id: string; stage: string },
  input: CreateTaskInput
): Promise<RoadmapTaskView> {
  const [maxRow] = await db
    .select({ value: sql<number>`coalesce(max(${roadmapTasks.sortOrder}), 0)` })
    .from(roadmapTasks)
    .where(and(eq(roadmapTasks.userId, userId), eq(roadmapTasks.startupId, startup.id)));

  const [row] = await db
    .insert(roadmapTasks)
    .values({
      userId,
      startupId: startup.id,
      taskKey: `custom-${randomUUID()}`,
      stage: normalizeRoadmapStage(startup.stage),
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      status: "not_started",
      dueDate: input.dueDate,
      sortOrder: Number(maxRow?.value ?? 0) + 10,
      source: "custom",
    })
    .returning();

  return toTaskView(row);
}

export async function updateTask(
  userId: string,
  taskId: string,
  input: UpdateTaskInput
): Promise<RoadmapTaskView | null> {
  const [existing] = await db
    .select()
    .from(roadmapTasks)
    .where(and(eq(roadmapTasks.id, taskId), eq(roadmapTasks.userId, userId)))
    .limit(1);
  if (!existing) return null;

  const [startup] = await db
    .select({ id: startups.id })
    .from(startups)
    .where(and(eq(startups.id, existing.startupId), eq(startups.userId, userId)))
    .limit(1);
  if (!startup) return null;

  const updates: Partial<typeof roadmapTasks.$inferInsert> = { updatedAt: new Date() };
  if (input.status !== undefined) {
    updates.status = input.status;
    updates.completedAt = input.status === "completed" ? new Date() : null;
  }
  if (input.dueDate !== undefined) {
    updates.dueDate = input.dueDate;
  }

  const [row] = await db
    .update(roadmapTasks)
    .set(updates)
    .where(and(eq(roadmapTasks.id, taskId), eq(roadmapTasks.userId, userId)))
    .returning();

  return row ? toTaskView(row) : null;
}

/** Deletes a task only when it is a custom task owned by the caller. */
export async function deleteCustomTask(
  userId: string,
  taskId: string
): Promise<"deleted" | "not_found" | "template"> {
  const [existing] = await db
    .select({ source: roadmapTasks.source })
    .from(roadmapTasks)
    .where(and(eq(roadmapTasks.id, taskId), eq(roadmapTasks.userId, userId)))
    .limit(1);

  if (!existing) return "not_found";
  if (existing.source !== "custom") return "template";

  const deleted = await db
    .delete(roadmapTasks)
    .where(
      and(
        eq(roadmapTasks.id, taskId),
        eq(roadmapTasks.userId, userId),
        eq(roadmapTasks.source, "custom")
      )
    )
    .returning({ id: roadmapTasks.id });

  return deleted.length > 0 ? "deleted" : "not_found";
}

export async function createMilestone(
  userId: string,
  startupId: string,
  input: CreateMilestoneInput
): Promise<RoadmapMilestoneView> {
  const [row] = await db
    .insert(roadmapMilestones)
    .values({
      userId,
      startupId,
      title: input.title,
      description: input.description,
      targetDate: input.targetDate,
      status: "planned",
    })
    .returning();

  return toMilestoneView(row);
}

export async function updateMilestone(
  userId: string,
  milestoneId: string,
  input: UpdateMilestoneInput
): Promise<RoadmapMilestoneView | null> {
  const [existing] = await db
    .select()
    .from(roadmapMilestones)
    .where(and(eq(roadmapMilestones.id, milestoneId), eq(roadmapMilestones.userId, userId)))
    .limit(1);
  if (!existing) return null;

  const [startup] = await db
    .select({ id: startups.id })
    .from(startups)
    .where(and(eq(startups.id, existing.startupId), eq(startups.userId, userId)))
    .limit(1);
  if (!startup) return null;

  const updates: Partial<typeof roadmapMilestones.$inferInsert> = { updatedAt: new Date() };
  if (input.status !== undefined) {
    updates.status = input.status;
    updates.achievedAt = input.status === "achieved" ? new Date() : null;
  }
  if (input.targetDate !== undefined) {
    updates.targetDate = input.targetDate;
  }

  const [row] = await db
    .update(roadmapMilestones)
    .set(updates)
    .where(
      and(eq(roadmapMilestones.id, milestoneId), eq(roadmapMilestones.userId, userId))
    )
    .returning();

  return row ? toMilestoneView(row) : null;
}

function asRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RoadmapValidationError("A JSON object is required");
  }
  return body as Record<string, unknown>;
}

function normalizeText(value: unknown, max: number, required = false): string | null {
  if (value === null || value === undefined) {
    if (required) throw new RoadmapValidationError("This field is required");
    return null;
  }
  if (typeof value !== "string") {
    throw new RoadmapValidationError("Text fields must be strings");
  }
  const trimmed = value.trim();
  if (!trimmed) {
    if (required) throw new RoadmapValidationError("This field is required");
    return null;
  }
  if (trimmed.length > max) {
    throw new RoadmapValidationError(`Keep this field to ${max} characters or fewer`);
  }
  return trimmed;
}

/**
 * Accepts a date-only string (the value produced by <input type="date">).
 * The date is normalized to UTC noon so it cannot drift across timezones.
 */
export function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RoadmapValidationError("Dates must use YYYY-MM-DD");
  }
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RoadmapValidationError("That date does not exist");
  }
  return date;
}

function normalizeTaskStatus(value: unknown): RoadmapTaskStatus {
  if (typeof value !== "string" || !ROADMAP_TASK_STATUSES.includes(value as RoadmapTaskStatus)) {
    throw new RoadmapValidationError("Unsupported task status");
  }
  return value as RoadmapTaskStatus;
}

function normalizeMilestoneStatus(value: unknown): RoadmapMilestoneStatus {
  if (
    typeof value !== "string" ||
    !ROADMAP_MILESTONE_STATUSES.includes(value as RoadmapMilestoneStatus)
  ) {
    throw new RoadmapValidationError("Unsupported milestone status");
  }
  return value as RoadmapMilestoneStatus;
}

function normalizePriority(value: unknown): RoadmapTaskPriority {
  if (value === undefined || value === null || value === "") return "medium";
  if (
    typeof value !== "string" ||
    !ROADMAP_TASK_PRIORITIES.includes(value as RoadmapTaskPriority)
  ) {
    throw new RoadmapValidationError("Unsupported task priority");
  }
  return value as RoadmapTaskPriority;
}

export function normalizeCreateTaskInput(body: unknown): CreateTaskInput {
  const source = asRecord(body);
  return {
    title: normalizeText(source.title, 160, true) as string,
    description: normalizeText(source.description, 1000),
    category: normalizeText(source.category, 60) ?? "General",
    priority: normalizePriority(source.priority),
    dueDate: parseOptionalDate(source.dueDate) ?? null,
  };
}

export function normalizeUpdateTaskInput(body: unknown): UpdateTaskInput {
  const source = asRecord(body);
  const status = source.status === undefined ? undefined : normalizeTaskStatus(source.status);
  const dueDate = parseOptionalDate(source.dueDate);
  if (status === undefined && dueDate === undefined) {
    throw new RoadmapValidationError("Provide a status or due date");
  }
  return { status, dueDate };
}

export function normalizeCreateMilestoneInput(body: unknown): CreateMilestoneInput {
  const source = asRecord(body);
  return {
    title: normalizeText(source.title, 160, true) as string,
    description: normalizeText(source.description, 1000),
    targetDate: parseOptionalDate(source.targetDate) ?? null,
  };
}

export function normalizeUpdateMilestoneInput(body: unknown): UpdateMilestoneInput {
  const source = asRecord(body);
  const status =
    source.status === undefined ? undefined : normalizeMilestoneStatus(source.status);
  const targetDate = parseOptionalDate(source.targetDate);
  if (status === undefined && targetDate === undefined) {
    throw new RoadmapValidationError("Provide a status or target date");
  }
  return { status, targetDate };
}
