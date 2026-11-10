"use client";

import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { useLanguage } from "./LanguageProvider";

/**
 * Persists a low-bandwidth preference. The initial class is applied by the
 * bootstrap script in the root layout, so this only reflects and toggles it.
 */
export function LiteModeToggle() {
  const { t } = useLanguage();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(document.documentElement.dataset.saver === "true");
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    document.documentElement.dataset.saver = next ? "true" : "false";
    try {
      localStorage.setItem("vx-lite", next ? "true" : "false");
    } catch {
      // Storage can be unavailable in private/embedded contexts; the current
      // page still honours the mode.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      title={t(enabled ? "lite.disable" : "lite.enable")}
      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-xs transition-colors ${
        enabled
          ? "text-[var(--accent)] bg-[var(--accent-muted)]"
          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
      }`}
    >
      <Gauge size={14} aria-hidden="true" />
      <span className="flex-1 truncate text-left">
        {t(enabled ? "lite.on" : "lite.label")}
      </span>
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          enabled ? "bg-[var(--accent)]" : "bg-[var(--border-hover)]"
        }`}
      />
    </button>
  );
}
