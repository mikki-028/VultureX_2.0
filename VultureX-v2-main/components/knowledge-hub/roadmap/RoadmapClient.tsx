"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Flag,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import type {
  RoadmapMilestoneView,
  RoadmapOverview,
  RoadmapTaskView,
} from "@/features/roadmap/types";
import type { ReminderView } from "@/features/reminders/types";

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const STATUS_LABELS: Record<RoadmapTaskView["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  skipped: "Skipped",
};

const PRIORITY_LABELS: Record<RoadmapTaskView["priority"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return DATE_FORMAT.format(new Date(value));
}

type Props = {
  overview: RoadmapOverview;
  missingTemplateCount: number;
  taskReminders: Record<string, ReminderView[]>;
};

export function RoadmapClient({
  overview,
  missingTemplateCount,
  taskReminders,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    category: "",
    priority: "medium",
    dueDate: "",
  });
  const [milestoneForm, setMilestoneForm] = useState({ title: "", targetDate: "" });

  async function mutate(
    key: string,
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown
  ): Promise<boolean> {
    setBusy(key);
    setError("");
    setNotice("");

    try {
      const response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "That change could not be saved.");
        return false;
      }

      router.refresh();
      return true;
    } catch {
      setError("Network error. Nothing was saved; check your connection and try again.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function buildRoadmap() {
    const ok = await mutate("build", "/api/roadmap", "POST");
    if (ok) {
      setNotice("Suggested tasks added. Every task starts as not started.");
    }
  }

  async function changeTaskStatus(task: RoadmapTaskView, status: RoadmapTaskView["status"]) {
    await mutate(`task:${task.id}`, `/api/roadmap/tasks/${task.id}`, "PATCH", { status });
  }

  async function saveTaskDate(task: RoadmapTaskView, value: string) {
    await mutate(`task-date:${task.id}`, `/api/roadmap/tasks/${task.id}`, "PATCH", {
      dueDate: value || null,
    });
  }

  async function deleteTask(task: RoadmapTaskView) {
    if (task.source !== "custom") return;
    if (!window.confirm(`Delete “${task.title}”? This cannot be undone.`)) return;
    const ok = await mutate(`delete-task:${task.id}`, `/api/roadmap/tasks/${task.id}`, "DELETE");
    if (ok) setNotice("Custom task deleted.");
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskForm.title.trim()) {
      setError("Give the task a title first.");
      return;
    }

    const ok = await mutate("create-task", "/api/roadmap/tasks", "POST", {
      title: taskForm.title,
      description: taskForm.description || null,
      category: taskForm.category || "General",
      priority: taskForm.priority,
      dueDate: taskForm.dueDate || null,
    });

    if (ok) {
      setTaskForm({ title: "", description: "", category: "", priority: "medium", dueDate: "" });
      setShowTaskForm(false);
      setNotice("Task added to your roadmap.");
    }
  }

  async function changeMilestoneStatus(
    milestone: RoadmapMilestoneView,
    status: RoadmapMilestoneView["status"]
  ) {
    await mutate(`milestone:${milestone.id}`, `/api/roadmap/milestones/${milestone.id}`, "PATCH", {
      status,
    });
  }

  async function submitMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!milestoneForm.title.trim()) {
      setError("Give the milestone a title first.");
      return;
    }

    const ok = await mutate("create-milestone", "/api/roadmap/milestones", "POST", {
      title: milestoneForm.title,
      targetDate: milestoneForm.targetDate || null,
    });

    if (ok) {
      setMilestoneForm({ title: "", targetDate: "" });
      setShowMilestoneForm(false);
      setNotice("Milestone added. It starts as planned.");
    }
  }

  const { progress, stage } = overview;
  const isBusy = Boolean(busy);

  return (
    <div className="space-y-4">
      <section className="vx-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="vx-label">Founder roadmap</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {stage.label} roadmap
            </h1>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[var(--text-secondary)]">
              Built from the stage saved on your startup profile ({stage.raw ?? "not set"}). These
              are suggested tasks until you start them; progress counts only the statuses you
              record.
            </p>
          </div>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)]"
          >
            Change stage in settings
            <ArrowRight size={11} aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded border border-[var(--accent)]/25 bg-[var(--accent-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
            {stage.label}
          </span>
          <span className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
            {progress.tasksTotal} active {progress.tasksTotal === 1 ? "task" : "tasks"}
          </span>
          <span className="rounded border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
            {progress.milestonesTotal} {progress.milestonesTotal === 1 ? "milestone" : "milestones"}
          </span>
        </div>
      </section>

      {(error || notice) && (
        <div
          role={error ? "alert" : "status"}
          className={`vx-card px-4 py-3 text-[11px] ${
            error ? "text-[var(--red)]" : "text-[var(--green)]"
          }`}
        >
          {error || notice}
        </div>
      )}

      {overview.tasks.length === 0 ? (
        <section className="vx-card p-5">
          <div className="flex items-start gap-2.5">
            <Flag size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                Build your {stage.label} roadmap
              </h2>
              <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-[var(--text-muted)]">
                This adds {missingTemplateCount} suggested {stage.label} tasks. Nothing is marked
                complete automatically, and you can skip any task that does not apply.
              </p>
              <button
                type="button"
                onClick={buildRoadmap}
                disabled={isBusy}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-fill)] px-3.5 py-2 text-[11px] font-medium text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-fill-hover)] disabled:opacity-50"
              >
                {busy === "build" ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Sparkles size={11} aria-hidden="true" />
                )}
                Build my roadmap
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section aria-labelledby="roadmap-progress-heading" className="vx-card p-5">
          <p className="vx-label">Progress</p>
          <h2 id="roadmap-progress-heading" className="mt-1 text-lg font-semibold tracking-tight">
            Real status, not estimates
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ProgressMeter
              label="Active tasks"
              completed={progress.tasksCompleted}
              total={progress.tasksTotal}
              percent={progress.taskPercent}
              hint={
                progress.tasksSkipped > 0
                  ? `${progress.tasksSkipped} skipped, excluded from the percentage`
                  : "Skipped tasks are excluded from the percentage"
              }
            />
            <ProgressMeter
              label="Milestones"
              completed={progress.milestonesAchieved}
              total={progress.milestonesTotal}
              percent={progress.milestonePercent}
              hint="Only milestones you mark achieved count"
            />
          </div>

          {missingTemplateCount > 0 && (
            <div className="vx-inset mt-4 flex flex-wrap items-center justify-between gap-2 p-3">
              <p className="text-[11px] text-[var(--text-muted)]">
                {missingTemplateCount} suggested {stage.label} tasks are not on your roadmap yet.
              </p>
              <button
                type="button"
                onClick={buildRoadmap}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[10px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text)] disabled:opacity-50"
              >
                {busy === "build" ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <Plus size={10} aria-hidden="true" />
                )}
                Add suggested tasks
              </button>
            </div>
          )}
        </section>
      )}

      {overview.recommendations.length > 0 && (
        <section aria-labelledby="roadmap-recommendations-heading" className="vx-card p-5">
          <p className="vx-label">Recommendations</p>
          <h2
            id="roadmap-recommendations-heading"
            className="mt-1 text-lg font-semibold tracking-tight"
          >
            What to look at next
          </h2>
          <ul className="mt-3 space-y-2">
            {overview.recommendations.map((recommendation) => (
              <li key={`${recommendation.kind}-${recommendation.title}`} className="vx-inset p-3">
                <p className="vx-label">
                  {recommendation.kind === "next_task"
                    ? "Next task"
                    : recommendation.kind === "milestone"
                      ? "Milestone"
                      : recommendation.kind === "stage_task"
                        ? "Stage checklist"
                        : "Get started"}
                </p>
                <p className="mt-1 text-xs font-medium">{recommendation.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  {recommendation.description}
                </p>
                <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--text-muted)]">
                  {recommendation.why}
                </p>
                <div className="mt-2">
                  {recommendation.kind === "next_task" && recommendation.taskId && (
                    <a
                      href={`#task-${recommendation.taskId}`}
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--accent)]"
                    >
                      Open task
                      <ArrowRight size={10} aria-hidden="true" />
                    </a>
                  )}
                  {(recommendation.kind === "build_roadmap" ||
                    recommendation.kind === "stage_task") &&
                    missingTemplateCount > 0 && (
                      <button
                        type="button"
                        onClick={buildRoadmap}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--accent)] disabled:opacity-50"
                      >
                        Add suggested tasks
                        <Plus size={10} aria-hidden="true" />
                      </button>
                    )}
                  {recommendation.kind === "milestone" && (
                    <a
                      href="#milestones"
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--accent)]"
                    >
                      Add a milestone
                      <ArrowRight size={10} aria-hidden="true" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="roadmap-tasks-heading" className="vx-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="vx-label">Tasks</p>
            <h2 id="roadmap-tasks-heading" className="mt-1 text-lg font-semibold tracking-tight">
              Your roadmap
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Only tasks you start are counted as open work.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowTaskForm((visible) => !visible)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text)]"
          >
            <Plus size={11} aria-hidden="true" />
            Add custom task
          </button>
        </div>

        {showTaskForm && (
          <form onSubmit={submitTask} className="vx-inset mt-3 space-y-2 p-3">
            <label className="block">
              <span className="vx-label">Task title</span>
              <input
                required
                maxLength={160}
                value={taskForm.title}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, title: event.target.value }))
                }
                className="mt-1 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-[11px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="vx-label">Description (optional)</span>
              <textarea
                maxLength={1000}
                rows={2}
                value={taskForm.description}
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, description: event.target.value }))
                }
                className="mt-1 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-[11px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="block">
                <span className="vx-label">Category</span>
                <input
                  maxLength={60}
                  placeholder="General"
                  value={taskForm.category}
                  onChange={(event) =>
                    setTaskForm((current) => ({ ...current, category: event.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-[11px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="vx-label">Priority</span>
                <select
                  value={taskForm.priority}
                  onChange={(event) =>
                    setTaskForm((current) => ({ ...current, priority: event.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-[11px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label className="block">
                <span className="vx-label">Due date</span>
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(event) =>
                    setTaskForm((current) => ({ ...current, dueDate: event.target.value }))
                  }
                  className="mt-1 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-[11px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-fill)] px-3 py-1.5 text-[11px] font-medium text-[var(--accent-foreground)] disabled:opacity-50"
            >
              {busy === "create-task" && <Loader2 size={11} className="animate-spin" />}
              Save task
            </button>
          </form>
        )}

        {overview.tasks.length === 0 ? (
          <div className="vx-inset mt-3 p-4">
            <p className="text-xs font-medium">No tasks yet</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
              Build the stage checklist above or add a custom task. No progress is assumed.
            </p>
          </div>
        ) : (
          <ol className="mt-3 space-y-2">
            {overview.tasks.map((task) => (
              <li key={task.id} id={`task-${task.id}`} className="vx-inset p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${
                          task.status === "completed"
                            ? "border-[var(--green)]/30 bg-[var(--green)]/10 text-[var(--green)]"
                            : task.status === "in_progress"
                              ? "border-[var(--accent)]/25 bg-[var(--accent-muted)] text-[var(--accent)]"
                              : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                        }`}
                      >
                        {STATUS_LABELS[task.status]}
                      </span>
                      <span className="text-[9px] text-[var(--text-muted)]">{task.category}</span>
                      <span className="text-[9px] text-[var(--text-muted)]">
                        {PRIORITY_LABELS[task.priority]} priority
                      </span>
                      {task.source === "custom" && (
                        <span className="text-[9px] text-[var(--text-muted)]">Custom</span>
                      )}
                    </div>
                    <h3
                      className={`mt-1.5 text-sm font-medium ${
                        task.status === "completed" ? "line-through opacity-70" : ""
                      }`}
                    >
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-[var(--text-secondary)]">
                        {task.description}
                      </p>
                    )}
                    <TaskReminderNote reminders={taskReminders[task.id]} />
                  </div>
                  <TaskDueDate
                    key={`${task.id}-${task.dueDate ?? "none"}`}
                    task={task}
                    busy={busy === `task-date:${task.id}`}
                    disabled={isBusy}
                    onSave={saveTaskDate}
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {task.status === "not_started" && (
                    <button
                      type="button"
                      onClick={() => changeTaskStatus(task, "in_progress")}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-fill)] px-2.5 py-1 text-[10px] font-medium text-[var(--accent-foreground)] disabled:opacity-50"
                    >
                      {busy === `task:${task.id}` ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Play size={10} aria-hidden="true" />
                      )}
                      Start
                    </button>
                  )}
                  {(task.status === "not_started" || task.status === "in_progress") && (
                    <button
                      type="button"
                      onClick={() => changeTaskStatus(task, "completed")}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--green)]/40 px-2.5 py-1 text-[10px] font-medium text-[var(--green)] disabled:opacity-50"
                    >
                      <Check size={10} aria-hidden="true" />
                      Complete
                    </button>
                  )}
                  {task.status === "completed" && (
                    <button
                      type="button"
                      onClick={() => changeTaskStatus(task, "in_progress")}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)] disabled:opacity-50"
                    >
                      <RotateCcw size={10} aria-hidden="true" />
                      Reopen
                    </button>
                  )}
                  {task.status === "skipped" ? (
                    <button
                      type="button"
                      onClick={() => changeTaskStatus(task, "not_started")}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)] disabled:opacity-50"
                    >
                      <RotateCcw size={10} aria-hidden="true" />
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => changeTaskStatus(task, "skipped")}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] disabled:opacity-50"
                    >
                      <SkipForward size={10} aria-hidden="true" />
                      Skip
                    </button>
                  )}
                  <Link
                    href={`/knowledge-hub/for-you/reminders?taskId=${task.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text)]"
                  >
                    <CalendarDays size={10} aria-hidden="true" />
                    Set reminder
                  </Link>
                  {task.source === "custom" && (
                    <button
                      type="button"
                      onClick={() => void deleteTask(task)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] text-[var(--red)] hover:bg-[var(--red-muted)] disabled:opacity-50"
                    >
                      {busy === `delete-task:${task.id}` ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Trash2 size={10} aria-hidden="true" />
                      )}
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section id="milestones" aria-labelledby="roadmap-milestones-heading" className="vx-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="vx-label">Milestones</p>
            <h2
              id="roadmap-milestones-heading"
              className="mt-1 text-lg font-semibold tracking-tight"
            >
              Outcomes you choose
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Milestones are separate from tasks and start as planned.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowMilestoneForm((visible) => !visible)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text)]"
          >
            <Target size={11} aria-hidden="true" />
            Add milestone
          </button>
        </div>

        {showMilestoneForm && (
          <form onSubmit={submitMilestone} className="vx-inset mt-3 space-y-2 p-3">
            <label className="block">
              <span className="vx-label">Milestone</span>
              <input
                required
                maxLength={160}
                value={milestoneForm.title}
                onChange={(event) =>
                  setMilestoneForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="e.g. First ten paying customers"
                className="mt-1 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-[11px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="vx-label">Target date (optional)</span>
              <input
                type="date"
                value={milestoneForm.targetDate}
                onChange={(event) =>
                  setMilestoneForm((current) => ({ ...current, targetDate: event.target.value }))
                }
                className="mt-1 w-full rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-[11px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none sm:max-w-xs"
              />
            </label>
            <button
              type="submit"
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-fill)] px-3 py-1.5 text-[11px] font-medium text-[var(--accent-foreground)] disabled:opacity-50"
            >
              {busy === "create-milestone" && <Loader2 size={11} className="animate-spin" />}
              Save milestone
            </button>
          </form>
        )}

        {overview.milestones.length === 0 ? (
          <div className="vx-inset mt-3 p-4">
            <p className="text-xs font-medium">No milestones yet</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
              Add a date-bound outcome you choose. VultureX does not create milestones for you.
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {overview.milestones.map((milestone) => {
              const target = formatDate(milestone.targetDate);
              return (
                <li key={milestone.id} className="vx-inset p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${
                          milestone.status === "achieved"
                            ? "border-[var(--green)]/30 bg-[var(--green)]/10 text-[var(--green)]"
                            : milestone.status === "in_progress"
                              ? "border-[var(--accent)]/25 bg-[var(--accent-muted)] text-[var(--accent)]"
                              : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                        }`}
                      >
                        {milestone.status === "in_progress"
                          ? "In progress"
                          : milestone.status === "achieved"
                            ? "Achieved"
                            : "Planned"}
                      </span>
                      <p className="mt-1.5 text-xs font-medium">{milestone.title}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                        {target ? `Target ${target} (UTC)` : "No target date"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {milestone.status === "planned" && (
                        <button
                          type="button"
                          onClick={() => changeMilestoneStatus(milestone, "in_progress")}
                          disabled={isBusy}
                          className="rounded-md border border-[var(--border)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)] disabled:opacity-50"
                        >
                          Start
                        </button>
                      )}
                      {milestone.status !== "achieved" && (
                        <button
                          type="button"
                          onClick={() => changeMilestoneStatus(milestone, "achieved")}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--green)]/40 px-2.5 py-1 text-[10px] font-medium text-[var(--green)] disabled:opacity-50"
                        >
                          <Check size={10} aria-hidden="true" />
                          Mark achieved
                        </button>
                      )}
                      {milestone.status === "achieved" && (
                        <button
                          type="button"
                          onClick={() => changeMilestoneStatus(milestone, "planned")}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)] disabled:opacity-50"
                        >
                          <RotateCcw size={10} aria-hidden="true" />
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ProgressMeter({
  label,
  completed,
  total,
  percent,
  hint,
}: {
  label: string;
  completed: number;
  total: number;
  percent: number;
  hint: string;
}) {
  return (
    <div className="vx-inset p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium">{label}</p>
        <p className="vx-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
          {total === 0 ? "No records" : `${completed}/${total} · ${percent}%`}
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
        <div
          className="h-full rounded-full bg-[var(--accent-fill)]"
          style={{ width: `${total === 0 ? 0 : percent}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--text-muted)]">{hint}</p>
    </div>
  );
}

function TaskReminderNote({ reminders }: { reminders?: ReminderView[] }) {
  if (!reminders || reminders.length === 0) return null;
  const next = reminders.find((reminder) => !reminder.completedAt) ?? reminders[0];
  const due = new Date(next.dueAt);
  const date = formatDate(next.dueAt);

  return (
    <p className="mt-2 inline-flex flex-wrap items-center gap-1 text-[10px] text-[var(--accent)]">
      <CalendarDays size={10} aria-hidden="true" />
      {next.completedAt ? "Reminder completed: " : "Reminder: "}
      {next.title}
      {!next.completedAt && date
        ? ` · due ${date}${next.hasTime ? ` ${due.toISOString().slice(11, 16)} UTC` : " (all day)"}`
        : ""}
    </p>
  );
}

function TaskDueDate({
  task,
  busy,
  disabled,
  onSave,
}: {
  task: RoadmapTaskView;
  busy: boolean;
  disabled: boolean;
  onSave: (task: RoadmapTaskView, value: string) => void;
}) {
  const [value, setValue] = useState(task.dueDate ? task.dueDate.slice(0, 10) : "");
  const savedValue = task.dueDate ? task.dueDate.slice(0, 10) : "";
  const formatted = formatDate(task.dueDate);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <CalendarDays size={11} className="text-[var(--text-muted)]" aria-hidden="true" />
      <span className="text-[10px] text-[var(--text-muted)]">
        {formatted ? `Due ${formatted}` : "No due date"}
      </span>
      <input
        type="date"
        value={value}
        aria-label={`Due date for ${task.title}`}
        onChange={(event) => setValue(event.target.value)}
        className="rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-1.5 py-1 text-[10px] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
      />
      {value !== savedValue && (
        <button
          type="button"
          onClick={() => onSave(task, value)}
          disabled={busy || disabled}
          className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)] disabled:opacity-50"
        >
          {busy && <Loader2 size={9} className="animate-spin" />}
          Save
        </button>
      )}
    </div>
  );
}
