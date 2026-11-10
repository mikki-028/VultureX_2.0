"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Check, FileUp, Loader2, Megaphone, MessageSquarePlus, Upload, XCircle,
} from "lucide-react";
import { formatBytes } from "@/features/pitch-deck/files";

export type AdminFileRow = {
  id: string;
  fileName: string;
  sizeBytes: number;
  isPublished: boolean;
  uploadedAt: string | null;
};

export function AdminRequestControls({
  requestId,
  status,
  hasApprovedSummary,
  files,
  adminNote,
}: {
  requestId: string;
  status: string;
  hasApprovedSummary: boolean;
  files: AdminFileRow[];
  adminNote: string | null;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(
    files.find((f) => f.isPublished)?.id ?? null,
  );
  const [publishing, setPublishing] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [note, setNote] = useState(adminNote ?? "");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rejected = status === "rejected";
  const canOperate = !rejected && status !== "completed";
  const canReject = status === "pending_approval" || status === "approved" || status === "in_progress";

  function uploadFile(file: File) {
    if (uploading) return;
    setUploading(true);
    setError("");
    setMessage("");
    setProgress(0);

    // XHR (not fetch) so real upload progress can be reported.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/admin/pitch-deck/requests/${requestId}/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        setMessage("Draft uploaded. It is private until you publish it.");
        router.refresh();
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          setError(data.error ?? "Upload failed.");
        } catch {
          setError("Upload failed. Please try again.");
        }
      }
    };
    xhr.onerror = () => {
      setUploading(false);
      setError("Upload failed. Check your connection and try again.");
    };

    const body = new FormData();
    body.append("file", file);
    xhr.send(body);
  }

  async function publish() {
    if (!selectedFileId || publishing) return;
    setPublishing(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/pitch-deck/requests/${requestId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: selectedFileId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Publishing failed.");
        return;
      }
      setConfirmPublish(false);
      setMessage("Published. The startup can now download this deck from their dashboard.");
      router.refresh();
    } catch {
      setError("Publishing failed. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  async function reject() {
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setError("Provide a clear reason (at least 5 characters) so the founder knows what to fix.");
      return;
    }
    setRejecting(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/pitch-deck/requests/${requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Rejection failed.");
        return;
      }
      setMessage("Request rejected. The founder can now see the reason and reopen it.");
      router.refresh();
    } catch {
      setError("Rejection failed. Please try again.");
    } finally {
      setRejecting(false);
    }
  }

  async function patchStatus(payload: { status?: string; note?: string }) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/pitch-deck/requests/${requestId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Update failed.");
        return;
      }
      setMessage("Request updated.");
      router.refresh();
    } catch {
      setError("Update failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="px-3 py-2.5 rounded-md border border-[var(--red)]/30 bg-[var(--red-muted)] text-[11px] text-[var(--red)] flex gap-2">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {message && (
        <div className="px-3 py-2.5 rounded-md border border-[var(--green)]/30 bg-[var(--green-muted)] text-[11px] text-[var(--green)] flex gap-2">
          <Check size={12} className="mt-0.5 shrink-0" /> {message}
        </div>
      )}

      {/* Upload */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h2 className="text-xs font-medium text-[var(--text-muted)] mb-1 flex items-center gap-2">
          <FileUp size={12} /> Upload prepared deck
        </h2>
        <p className="text-[10px] text-[var(--text-muted)] mb-3">
          PDF or PPTX, up to 20 MB. Uploading never publishes — you publish explicitly below.
        </p>
        {rejected && (
          <p className="mb-3 rounded-md border border-[var(--red)]/30 bg-[var(--red-muted)] px-3 py-2 text-[10px] text-[var(--red)]">
            This request was rejected. Uploads stay blocked until the founder reopens it.
          </p>
        )}

        <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium border border-[var(--border)] rounded-md cursor-pointer text-[var(--text-secondary)] hover:border-[var(--border-hover)] transition-colors">
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          {uploading ? `Uploading ${progress}%` : "Choose file"}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.pptx,.ppt,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            className="hidden"
            disabled={uploading || !canOperate}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
              e.target.value = "";
            }}
          />
        </label>

        {uploading && (
          <div className="mt-3 h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent-fill)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </section>

      {/* Files + publish */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h2 className="text-xs font-medium text-[var(--text-muted)] mb-3 flex items-center gap-2">
          <Megaphone size={12} /> Publish
        </h2>

        {files.length === 0 ? (
          <p className="text-[11px] text-[var(--text-muted)]">
            No decks uploaded for this request yet.
          </p>
        ) : (
          <>
            <ul className="space-y-2 mb-4">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md border border-[var(--border)] bg-[var(--bg)]"
                >
                  <label className="flex items-center gap-2.5 min-w-0 cursor-pointer">
                    <input
                      type="radio"
                      name="deck-file"
                      checked={selectedFileId === f.id}
                      onChange={() => setSelectedFileId(f.id)}
                      className="accent-[var(--accent)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-[11px] truncate">{f.fileName}</span>
                      <span className="block text-[10px] text-[var(--text-muted)]">
                        {formatBytes(f.sizeBytes)} ·{" "}
                        {f.uploadedAt ? new Date(f.uploadedAt).toLocaleString() : ""}
                      </span>
                    </span>
                  </label>
                  <div className="flex items-center gap-2 shrink-0">
                    {f.isPublished && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-medium bg-[var(--green-muted)] text-[var(--green)]">
                        Published
                      </span>
                    )}
                    <a
                      href={`/api/files/${f.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-[var(--accent)] hover:underline"
                    >
                      Verify file
                    </a>
                  </div>
                </li>
              ))}
            </ul>

            {!hasApprovedSummary && (
              <p className="text-[10px] text-[var(--amber)] mb-3">
                The founder has not approved a summary yet — publishing is blocked until they do.
              </p>
            )}

            {!confirmPublish ? (
              <button
                onClick={() => setConfirmPublish(true)}
                disabled={!selectedFileId || !hasApprovedSummary || !canOperate}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[var(--accent-fill)] text-[var(--accent-foreground)] rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-colors"
              >
                <Megaphone size={12} /> Publish Pitch Deck
              </button>
            ) : (
              <div className="px-3 py-3 rounded-md border border-[var(--amber)]/40 bg-[var(--amber-muted)]">
                <p className="text-[11px] text-[var(--amber)] mb-3">
                  Publish this file to the startup now? They will be able to download it immediately.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={publish}
                    disabled={publishing}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium bg-[var(--accent-fill)] text-[var(--accent-foreground)] rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-50"
                  >
                    {publishing && <Loader2 size={11} className="animate-spin" />}
                    Confirm publication
                  </button>
                  <button
                    onClick={() => setConfirmPublish(false)}
                    className="px-3 py-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Status + note */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h2 className="text-xs font-medium text-[var(--text-muted)] mb-3">Request status</h2>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            onClick={() => patchStatus({ status: "approved" })}
            disabled={busy || !hasApprovedSummary || !canOperate}
            className="px-3 py-1.5 text-[11px] rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] disabled:opacity-40"
          >
            Approved (queued)
          </button>
          <button
            onClick={() => patchStatus({ status: "in_progress" })}
            disabled={busy || !hasApprovedSummary || !canOperate}
            className="px-3 py-1.5 text-[11px] rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] disabled:opacity-40"
          >
            Mark in progress
          </button>
        </div>

        <label className="block text-[10px] text-[var(--text-muted)] mb-1">
          Internal note (visible to the founder)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Deck in production, expected Friday"
            className="flex-1 px-3 py-2 text-xs rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--border-hover)]"
          />
          <button
            onClick={() => patchStatus({ note })}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] border border-[var(--border)] rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] disabled:opacity-40"
          >
            <MessageSquarePlus size={11} /> Save note
          </button>
        </div>
      </section>

      {/* Rejection */}
      {canReject && (
        <section className="rounded-xl border border-[var(--red)]/30 bg-[var(--bg-card)] p-5">
          <h2 className="text-xs font-medium text-[var(--red)] mb-1 flex items-center gap-2">
            <XCircle size={12} /> Reject request
          </h2>
          <p className="text-[10px] text-[var(--text-muted)] mb-3">
            The reason is saved, shown to the founder, and included in their notification. The
            request cannot be uploaded or published until the founder reopens it.
          </p>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Explain what the founder needs to change…"
            className="w-full px-3 py-2 text-xs rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:border-[var(--border-hover)]"
          />
          <button
            type="button"
            onClick={() => void reject()}
            disabled={rejecting || reason.trim().length < 5}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-md border border-[var(--red)]/40 text-[var(--red)] hover:bg-[var(--red-muted)] disabled:opacity-40"
          >
            {rejecting ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
            Reject with reason
          </button>
        </section>
      )}
    </div>
  );
}
