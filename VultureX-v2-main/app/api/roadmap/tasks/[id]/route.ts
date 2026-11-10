import { NextResponse } from "next/server";
import {
  deleteCustomTask,
  normalizeUpdateTaskInput,
  RoadmapValidationError,
  updateTask,
} from "@/features/roadmap";
import { revalidateRoadmap } from "@/features/roadmap/revalidate";
import { roadmapRequestContext } from "@/features/roadmap/request";
import { isUuid } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await roadmapRequestContext();
  if ("error" in context) return context.error;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
  }

  try {
    const result = await deleteCustomTask(context.userId, id);
    if (result === "not_found") {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    if (result === "template") {
      return NextResponse.json(
        { error: "Suggested stage tasks cannot be deleted; mark one skipped instead." },
        { status: 409 }
      );
    }
    revalidateRoadmap();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete roadmap task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await roadmapRequestContext();
  if ("error" in context) return context.error;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const input = normalizeUpdateTaskInput(body);
    const task = await updateTask(context.userId, id, input);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    revalidateRoadmap();
    return NextResponse.json({ task });
  } catch (error) {
    if (error instanceof RoadmapValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to update roadmap task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}
