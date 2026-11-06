"use client";

import { useCallback, useEffect, useState } from "react";
import en from "@/i18n/en.json";
import es from "@/i18n/es.json";
import uk from "@/i18n/uk.json";
import ru from "@/i18n/ru.json";
import type { Lang } from "./types";

export type UIKey = keyof typeof en;
const DICTS: Record<Lang, Record<UIKey, string>> = { en, es, uk, ru };
export const UI_LANGS: Lang[] = ["es", "uk", "ru", "en"];

// localStorage can throw (private mode, blocked storage); never let that break the page.
export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const EVT = "kolo-lang";

export function translate(lang: Lang, key: UIKey, vars?: Record<string, string | number>) {
  let s = DICTS[lang]?.[key] ?? DICTS.en[key] ?? key;
  for (const [k, v] of Object.entries(vars || {})) s = s.replace(`{${k}}`, String(v));
  return s;
}

/** UI language, persisted in localStorage and shared across components on the page. */
export function useUILang() {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    setLangState(load<Lang>("kolo.lang", "en"));
    const on = (e: Event) => setLangState((e as CustomEvent<Lang>).detail);
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  const setLang = useCallback((l: Lang) => {
    save("kolo.lang", l);
    window.dispatchEvent(new CustomEvent(EVT, { detail: l }));
  }, []);
  const t = useCallback((key: UIKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  return { lang, setLang, t };
}
