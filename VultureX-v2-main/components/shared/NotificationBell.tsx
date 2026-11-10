"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CalendarClock, Check, Loader2, MessageSquare, Sparkles, Trophy, X } from "lucide-react";
import { refreshBadges } from "./use-unread-badges";

type NotificationItem = {
  id: string;
  type:
    | "interest_request"
    | "request_accepted"
    | "request_rejected"
    | "message"
    | "business_match"
    | "competition_published"
    | "competition_review"
    | "competition_application"
    | "competition_application_status"
    | "competition_winner_proposed"
    | "competition_winner_announced"
    | "reminder_due"
    | "pitch_deck_submitted"
    | "pitch_deck_status"
    | "pitch_deck_published"
    | "impact_submitted"
    | "impact_review";
  body: string | null;
  createdAt: string;
  readAt: string | null;
  actor: {
    userId: string;
    name: string;
    subtitle: string | null;
    avatarUrl: string | null;
    href: string | null;
    initials: string;
  } | null;
  requestId: string | null;
  requestStatus: string | null;
  conversationId: string | null;
  competitionId: string | null;
  applicationId: string | null;
  reminderId: string | null;
  href: string;
};

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  return (
    <div className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[11px] font-semibold text-[var(--text-muted)] overflow-hidden shrink-0">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
      setUnread(Number(data.unreadCount ?? 0));
      setError("");
    } catch {
      setError("Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setItems(data.notifications ?? []);
        setUnread(Number(data.unreadCount ?? 0));
        setError("");
      })
      .catch(() => {
        if (!cancelled) setError("Could not load notifications.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const interval = window.setInterval(load, 20000);
    const onRefresh = () => void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("vx:badges", onRefresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("vx:badges", onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markRead(id: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, readAt: new Date().toISOString() } : item
      )
    );
    setUnread((count) => Math.max(0, count - 1));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    refreshBadges();
  }

  async function markAllRead() {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
      }))
    );
    setUnread(0);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
    refreshBadges();
  }

  async function respond(item: NotificationItem, action: "accept" | "reject") {
    if (!item.requestId || working) return;
    setWorking(item.id);
    setError("");
    try {
      const res = await fetch(`/api/connections/${item.requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not update the request.");
        return;
      }
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                requestStatus: action === "accept" ? "accepted" : "rejected",
                conversationId: data.conversationId ?? entry.conversationId,
                readAt: entry.readAt ?? new Date().toISOString(),
              }
            : entry
        )
      );
      setUnread((count) => Math.max(0, count - 1));
      refreshBadges();
      // Re-read from the server so the item picks up its conversation link.
      await load();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setWorking(null);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void load();
        }}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-elevated)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60"
      >
        <Bell size={15} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-[var(--accent-fill)] text-[var(--accent-foreground)] text-[9px] font-bold flex items-center justify-center tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute left-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-xl z-[60] overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <p className="text-xs font-medium">Notifications</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
              >
                Mark all read
              </button>
            ) : (
              <span className="text-[10px] text-[var(--text-muted)]">All caught up</span>
            )}
          </div>

          {error && (
            <p className="px-4 py-2 text-[10px] text-[var(--red)] border-b border-[var(--border)]">
              {error}
            </p>
          )}

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={14} className="animate-spin text-[var(--text-muted)]" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={18} className="mx-auto text-[var(--text-muted)] mb-2" />
                <p className="text-xs text-[var(--text-secondary)]">No notifications yet</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  Interest+ requests, messages and competitions will appear here.
                </p>
              </div>
            ) : (
              items.map((item) => {
                const isPending =
                  item.type === "interest_request" && item.requestStatus === "pending";
                const isConnected =
                  item.type === "request_accepted" || item.requestStatus === "accepted";
                return (
                  <div
                    key={item.id}
                    className={`px-4 py-3 border-b border-[var(--border)] last:border-0 ${
                      item.readAt ? "" : "bg-[var(--accent-muted)]/40"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <Avatar
                        name={item.actor?.initials ?? "?"}
                        src={item.actor?.avatarUrl ?? null}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                          {item.body ?? "New activity on VultureX"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {timeAgo(item.createdAt)}
                          </span>
                          {!item.readAt && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-fill)]" aria-label="Unread" />
                          )}
                          {item.actor?.href && (
                            <Link
                              href={item.actor.href}
                              onClick={() => void markRead(item.id)}
                              className="text-[10px] text-[var(--accent)] hover:underline"
                            >
                              View profile
                            </Link>
                          )}
                        </div>

                        {isPending && (
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => respond(item, "accept")}
                              disabled={working === item.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-[var(--accent-fill)] text-[var(--accent-foreground)] rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
                            >
                              {working === item.id ? (
                                <Loader2 size={9} className="animate-spin" />
                              ) : (
                                <Check size={9} />
                              )}
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => respond(item, "reject")}
                              disabled={working === item.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] border border-[var(--border)] text-[var(--text-muted)] rounded-md hover:text-[var(--text-secondary)] hover:border-[var(--border-hover)] disabled:opacity-50 transition-colors"
                            >
                              <X size={9} /> Decline
                            </button>
                          </div>
                        )}

                        {isConnected && item.conversationId && (
                          <Link
                            href={`/messages?c=${item.conversationId}`}
                            onClick={() => {
                              setOpen(false);
                              void markRead(item.id);
                            }}
                            className="inline-flex items-center gap-1 mt-2 text-[10px] font-medium text-[var(--green)] hover:underline"
                          >
                            <MessageSquare size={10} /> Open conversation
                          </Link>
                        )}

                        {item.type === "reminder_due" && (
                          <Link
                            href={item.href}
                            onClick={() => {
                              setOpen(false);
                              void markRead(item.id);
                            }}
                            className="inline-flex items-center gap-1 mt-2 text-[10px] font-medium text-[var(--accent)] hover:underline"
                          >
                            <CalendarClock size={10} /> View reminders
                          </Link>
                        )}

                        {item.type === "business_match" && (
                          <Link
                            href={item.href}
                            onClick={() => {
                              setOpen(false);
                              void markRead(item.id);
                            }}
                            className="inline-flex items-center gap-1 mt-2 text-[10px] font-medium text-[var(--accent)] hover:underline"
                          >
                            <Sparkles size={10} /> View recommendation
                          </Link>
                        )}

                        {item.type === "message" && item.conversationId && (
                          <Link
                            href={item.href}
                            onClick={() => {
                              setOpen(false);
                              void markRead(item.id);
                            }}
                            className="inline-flex items-center gap-1 mt-2 text-[10px] font-medium text-[var(--accent)] hover:underline"
                          >
                            <MessageSquare size={10} /> Reply
                          </Link>
                        )}

                        {item.type.startsWith("competition") && (
                          <Link
                            href={item.href}
                            onClick={() => {
                              setOpen(false);
                              void markRead(item.id);
                            }}
                            className="inline-flex items-center gap-1 mt-2 text-[10px] font-medium text-[var(--accent)] hover:underline"
                          >
                            <Trophy size={10} />
                            {item.type === "competition_review"
                              ? "Review competition"
                              : item.type === "competition_application_status"
                                ? "View application"
                                : item.type === "competition_application"
                                  ? "Review applicants"
                                  : "View competition"}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-4 py-2 border-t border-[var(--border)] text-center">
            <Link
              href="/interests"
              onClick={() => setOpen(false)}
              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              View all requests →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
