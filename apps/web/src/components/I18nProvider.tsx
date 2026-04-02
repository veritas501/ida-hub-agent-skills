import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { messages } from "@/lib/i18n/messages";
import { getInitialLocale, persistLocale, setDocumentLang } from "@/lib/i18n/helpers";
import type { Locale, NestedMessageKey } from "@/lib/i18n/types";

type MessageKey = NestedMessageKey<(typeof messages)[Locale]>;
type I18nContextValue = { locale: Locale; setLocale: (locale: Locale) => void; t: (key: MessageKey) => string };
const I18nContext = createContext<I18nContextValue | null>(null);

function getMessage(locale: Locale, key: MessageKey): string {
  const value = key.split(".").reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === "object" && segment in acc) return (acc as Record<string, unknown>)[segment];
    return undefined;
  }, messages[locale]);
  return typeof value === "string" ? value : key;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => getInitialLocale());
  useEffect(() => { persistLocale(locale); setDocumentLang(locale); }, [locale]);
  const setLocale = useCallback((nextLocale: Locale) => { setLocaleState(nextLocale); }, []);
  const t = useCallback((key: MessageKey) => getMessage(locale, key), [locale]);
  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within I18nProvider");
  return context;
}

export type { MessageKey };
