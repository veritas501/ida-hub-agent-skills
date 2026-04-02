import type { Locale } from "./types";
export const LOCALE_STORAGE_KEY = "ida_hub_locale";
const SUPPORTED_LOCALES: Locale[] = ["zh", "en"];
export function isLocale(value: string | null | undefined): value is Locale { return value === "zh" || value === "en"; }
export function getBrowserLocale(): Locale {
  const candidates = [navigator.language, ...(navigator.languages ?? [])];
  const matched = candidates.map((item) => item?.toLowerCase().split("-")[0]).find((item): item is Locale => isLocale(item));
  return matched ?? "zh";
}
export function getInitialLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (isLocale(stored)) return stored;
  return getBrowserLocale();
}
export function persistLocale(locale: Locale): void { localStorage.setItem(LOCALE_STORAGE_KEY, locale); }
export function setDocumentLang(locale: Locale): void { document.documentElement.lang = locale === "zh" ? "zh-CN" : "en"; }
export function getDateTimeLocale(locale: Locale): string { return locale === "zh" ? "zh-CN" : "en"; }
export function formatMessage(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), template);
}
export function getSupportedLocales(): Locale[] { return SUPPORTED_LOCALES; }
