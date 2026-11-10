"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import {
  LOCALES,
  LOCALE_LABELS,
  type Locale,
} from "@/features/i18n/messages";
import { useLanguage } from "./LanguageProvider";

/**
 * Persists the founder's interface language and refreshes the server tree so
 * navigation, the Knowledge Hub and For You re-render in the chosen locale.
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const [current, setCurrent] = useState<Locale>(locale);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  async function change(next: Locale) {
    if (next === current) return;
    setCurrent(next);
    setError("");
    try {
      const response = await fetch("/api/preferences/language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredLanguage: next }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Could not save language.");
      }
      startTransition(() => router.refresh());
    } catch (changeError) {
      setCurrent(locale);
      setError(
        changeError instanceof Error ? changeError.message : "Could not save language."
      );
    }
  }

  return (
    <label
      className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-[var(--text-muted)] ${
        compact ? "" : "w-full"
      }`}
      title={error || t("language.choose")}
    >
      <Languages size={13} aria-hidden="true" />
      <span className={compact ? "sr-only" : ""}>{t("language.label")}</span>
      <select
        aria-label={t("language.choose")}
        value={current}
        disabled={pending}
        onChange={(event) => void change(event.target.value as Locale)}
        className="min-w-0 flex-1 cursor-pointer rounded border border-[var(--border)] bg-[var(--bg-card)] px-1.5 py-1 text-[11px] text-[var(--text-secondary)] focus:border-[var(--border-hover)] focus:outline-none disabled:opacity-60"
      >
        {LOCALES.map((option) => (
          <option key={option} value={option}>
            {LOCALE_LABELS[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
