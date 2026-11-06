import areasData from "@/data/areas.json";
import type { Area, Lang } from "./types";

export const AREAS = areasData as Area[];
export const areaById = (id: string) => AREAS.find((a) => a.id === id);

/** Chain from broad to precise, e.g. Bay Area > East Bay > Oakland. */
export function areaChain(id: string): Area[] {
  const chain: Area[] = [];
  let a = areaById(id);
  while (a) {
    chain.unshift(a);
    a = a.parentId ? areaById(a.parentId) : undefined;
  }
  return chain;
}

export const CATEGORIES: Record<string, string> = {
  cleaning: "🧹 Cleaning",
  food: "🫔 Food & catering",
  bakery: "🥐 Bakery",
  beauty: "💅 Beauty",
  childcare: "🧸 Childcare",
  tailoring: "🧵 Tailoring",
  cafe: "☕ Café",
};

export const LANG_NAMES: Record<Lang, string> = {
  es: "Español",
  uk: "Українська",
  ru: "Русский",
  en: "English",
};

export const SPEECH_LANG: Record<Lang, string> = {
  es: "es-MX",
  uk: "uk-UA",
  ru: "ru-RU",
  en: "en-US",
};
