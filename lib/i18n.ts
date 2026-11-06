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
  let s: string = DICTS[lang]?.[key] ?? DICTS.en[key] ?? key;
  for (const [k, v] of Object.entries(vars || {})) s = s.replace(`{${k}}`, String(v));
  return s;
}

function tabLang(): Lang | null {
  try {
    return (sessionStorage.getItem("kolo.lang") as Lang) || null;
  } catch {
    return null;
  }
}

/**
 * The UI language for every string on every page. It is per browser tab (sessionStorage),
 * so a two-window demo can show the customer in English and the provider in Ukrainian;
 * new tabs start from the last choice (localStorage). A page can pass a default (e.g. her
 * language on her profile) used only when this tab hasn't chosen yet.
 */
export function useUILang(pageDefault?: Lang | null) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const chosen = tabLang();
    if (chosen) setLangState(chosen);
    else if (pageDefault) {
      setLangState(pageDefault);
      try { sessionStorage.setItem("kolo.lang", pageDefault); } catch {}
      window.dispatchEvent(new CustomEvent(EVT, { detail: pageDefault }));
    } else setLangState(load<Lang>("kolo.lang", "en"));
    const on = (e: Event) => setLangState((e as CustomEvent<Lang>).detail);
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, [pageDefault]);
  const setLang = useCallback((l: Lang) => {
    save("kolo.lang", l);
    try { sessionStorage.setItem("kolo.lang", l); } catch {}
    window.dispatchEvent(new CustomEvent(EVT, { detail: l }));
  }, []);
  const t = useCallback((key: UIKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  return { lang, setLang, t };
}

/** Category label in the UI language. */
export function catLabel(lang: Lang, cat: string) {
  return translate(lang, `cat_${cat}` as UIKey) || cat;
}

/** Listing text in the UI language when it matches her language, otherwise English. */
export function pick<T extends { language: Lang }>(p: T, lang: Lang, en: string, native: string) {
  return lang === p.language && native ? native : en;
}
