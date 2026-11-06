import { client, FAST_MODEL, textOf, extractJSON } from "@/lib/claude";
import { readDB } from "@/lib/db";
import { areaById, CATEGORIES, distanceKm } from "@/lib/areas";
import type { Provider } from "@/lib/types";

export interface Suggestion {
  id: string;
  reason: string;
}

const MAX_SUGGESTIONS = 3;
/** With a chosen area, only the nearest providers are considered (and the prompt stays small). */
const NEARBY_POOL = 25;

const SYSTEM = `You help customers on a local-services marketplace. The customer searched for something and no listing matched the exact words. From the providers below, pick up to ${MAX_SUGGESTIONS} who could PLAUSIBLY help, because what they already offer is the same thing under another name, a close neighbor of it, or a skill that clearly covers it (e.g. "nail art" -> a manicurist, "birthday cake" -> a baker of custom cakes, "empanadas" -> someone who cooks Latin American food).

Rules:
- Only use provider ids from the list. Never invent providers.
- Never claim a provider offers something she did not list. Phrase the reason as why she MIGHT help, based on what she does list (e.g. "Bakes custom honey cakes; may take a birthday cake order").
- Each reason: one short sentence in English, under 20 words.
- If nobody is a reasonable fit, return an empty list. A weak stretch is worse than no suggestion.
- If distances are given, prefer closer providers when the fit is similar.
- Order best fit first.

Respond ONLY with JSON: {"suggestions": [{"id": "...", "reason": "..."}]}`;

export async function POST(req: Request) {
  const { query, category, near } = (await req.json()) as { query?: string; category?: string | null; near?: string };
  const q = (query || "").trim().slice(0, 200);
  if (!q) return Response.json({ suggestions: [] });

  const db = await readDB();
  // Same visibility as the public map: never suggest unpublished drafts.
  let pool: (Provider & { km?: number })[] = db.providers.filter((p) => p.status !== "draft" && (!category || p.category === category));
  const center = near ? areaById(near) : undefined;
  if (center) {
    pool = pool
      .map((p) => {
        const a = areaById(p.areaId);
        const lat = p.locationPrecision === "exact" && p.lat ? p.lat : a?.lat;
        const lng = p.locationPrecision === "exact" && p.lng ? p.lng : a?.lng;
        return { ...p, km: lat != null && lng != null ? Math.round(distanceKm(center.lat, center.lng, lat, lng)) : Infinity };
      })
      .sort((a, b) => a.km! - b.km!)
      .slice(0, NEARBY_POOL);
  }
  if (pool.length === 0) return Response.json({ suggestions: [] });

  // Compact view of each provider: enough to judge fit, nothing private.
  const catalog = pool.map((p) => ({
    id: p.id,
    category: CATEGORIES[p.category] || p.category,
    title: p.title_en,
    services: p.services.map((s) => s.name),
    about: p.story_en.slice(0, 300),
    serves: areaById(p.areaId)?.name,
    ...(p.km != null && Number.isFinite(p.km) ? { distance_km: p.km } : {}),
  }));

  try {
    const msg = await client.messages.create({
      model: FAST_MODEL,
      max_tokens: 600,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Customer searched for: ${JSON.stringify(q)}${center ? ` near ${center.name}` : ""}\n\nProviders:\n${JSON.stringify(catalog, null, 2)}`,
        },
      ],
    });
    const parsed = extractJSON<{ suggestions: Suggestion[] }>(textOf(msg));
    const valid = new Set(pool.map((p) => p.id));
    const seen = new Set<string>();
    const suggestions = (parsed?.suggestions || [])
      .filter((s) => s && valid.has(s.id) && typeof s.reason === "string" && !seen.has(s.id) && seen.add(s.id))
      .slice(0, MAX_SUGGESTIONS);
    return Response.json({ suggestions });
  } catch (err) {
    // No API key or model error: the page just falls back to "No matches yet."
    console.error("suggest failed", err);
    return Response.json({ suggestions: [] });
  }
}
