"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  LOCALE_LABELS,
  translate,
  type Locale,
  type MessageKey,
} from "@/features/i18n/messages";

type LanguageContextValue = {
  locale: Locale;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  locale: "en",
  t: (key, values) => translate("en", key, values),
});

export function LanguageProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LanguageContext.Provider
      value={{
        locale,
        t: (key, values) => translate(locale, key, values),
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export { LOCALE_LABELS };
export type { Locale, MessageKey };
