import { client, FAST_MODEL, textOf, extractJSON } from "@/lib/claude";
import { readDB } from "@/lib/db";
import { areaById, CATEGORIES } from "@/lib/areas";

export interface Suggestion {
  id: string;
  reason: string;
}

const MAX_SUGGESTIONS = 3;

const SYSTEM = `You help customers on a local-services marketplace. The customer searched for something and no listing matched the exact words. From the providers below, pick up to ${MAX_SUGGESTIONS} who could PLAUSIBLY help, because what they already offer is the same thing under another name, a close neighbor of it, or a skill that clearly covers it (e.g. "nail art" -> a manicurist, "birthday cake" -> a baker of custom cakes, "empanadas" -> someone who cooks Latin American food).

Rules:
- Only use provider ids from the list. Never invent providers.
- Never claim a provider offers something she did not list. Phrase the reason as why she MIGHT help, based on what she does list (e.g. "Bakes custom honey cakes; may take a birthday cake order").
- Each reason: one short sentence in English, under 20 words.
- If nobody is a reasonable fit, return an empty list. A weak stretch is worse than no suggestion.
- Order best fit first.

Respond ONLY with JSON: {"suggestions": [{"id": "...", "reason": "..."}]}`;

export async function POST(req: Request) {
  const { query, category } = (await req.json()) as { query?: string; category?: string | null };
  const q = (query || "").trim().slice(0, 200);
  if (!q) return Response.json({ suggestions: [] });

  const db = await readDB();
  const pool = db.providers.filter((p) => !category || p.category === category);
  if (pool.length === 0) return Response.json({ suggestions: [] });

  // Compact view of each provider: enough to judge fit, nothing private.
  const catalog = pool.map((p) => ({
    id: p.id,
    category: CATEGORIES[p.category] || p.category,
    title: p.title_en,
    services: p.services.map((s) => s.name),
    about: p.story_en.slice(0, 300),
    serves: areaById(p.areaId)?.name,
  }));

  try {
    const msg = await client.messages.create({
      model: FAST_MODEL,
      max_tokens: 600,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Customer searched for: ${JSON.stringify(q)}\n\nProviders:\n${JSON.stringify(catalog, null, 2)}`,
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
