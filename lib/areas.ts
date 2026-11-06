import areasData from "@/data/areas.json";
import type { Area, Lang } from "./types";

type RawArea = Omit<Area, "lat" | "lng"> & { center: [number, number] };
export const AREAS: Area[] = (areasData as RawArea[]).map(({ center, ...a }) => ({ ...a, lat: center[0], lng: center[1] }));
const BY_ID = new Map(AREAS.map((a) => [a.id, a]));
export const areaById = (id: string) => BY_ID.get(id);

/** Lowercase, strip accents and punctuation: "Pequeña Habana" -> "pequena habana". */
export const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function editDistance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

const LEVEL_RANK: Record<Area["level"], number> = { region: 0, subregion: 1, city: 2, neighborhood: 3, state: 4 };

/** Fuzzy, case- and accent-insensitive search over names and aliases, best first. */
export function searchAreas(query: string, limit = 8): Area[] {
  const q = norm(query);
  if (!q) return [];
  const scored: { a: Area; score: number }[] = [];
  for (const a of AREAS) {
    let best = Infinity;
    for (const raw of [a.name, ...a.aliases]) {
      const n = norm(raw);
      let s = Infinity;
      if (n === q) s = 0;
      else if (n.startsWith(q)) s = 1;
      else if (n.split(" ").some((w) => w.startsWith(q))) s = 2;
      else if (q.length >= 3 && n.includes(q)) s = 3;
      else if (q.length >= 4) {
        const d = Math.min(editDistance(q, n), ...n.split(" ").map((w) => editDistance(q, w)));
        if (d <= (q.length >= 7 ? 2 : 1)) s = 4 + d;
      }
      best = Math.min(best, s);
    }
    if (best < Infinity) scored.push({ a, score: best * 10 + LEVEL_RANK[a.level] });
  }
  return scored.sort((x, y) => x.score - y.score).slice(0, limit).map((x) => x.a);
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

/** Nearest non-state area to a point. */
export function nearestArea(lat: number, lng: number, filter: (a: Area) => boolean = (a) => a.level !== "state") {
  return AREAS.filter(filter).sort((a, b) => distanceKm(lat, lng, a.lat, a.lng) - distanceKm(lat, lng, b.lat, b.lng))[0];
}

/** The metro (region) or state an area belongs to, used for US-level clustering. */
export function metroOf(id: string): Area | undefined {
  const chain = areaChain(id);
  return chain.find((a) => a.level === "region") ?? chain[0];
}

export function parentLabel(a: Area) {
  const p = a.parentId ? areaById(a.parentId) : undefined;
  return p ? p.name : "";
}

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
  tutoring: "📚 Tutoring",
  eldercare: "🫶 Elder care",
  petsitting: "🐾 Pet sitting",
  interpreting: "🗣️ Interpreting",
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
