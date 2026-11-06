import { client, SMART_MODEL, textOf, extractJSON } from "@/lib/claude";

export interface Flag {
  field: string;
  text: string;
  reason: string;
  rewrite: string;
}

const SYSTEM = `You are a privacy reviewer for a public local-services listing written by (or for) an immigrant woman. Find text that could expose her or others. Flag:
- street names, house numbers, apartment/building details (EXCEPT the "address" field of a storefront, which is intentionally public)
- names of clients, employers, or other private people
- children's names, ages tied to names, or schools
- hints about immigration status, visas, documents, asylum, being undocumented, or legal cases
- personal phone numbers or emails

For each problem return the exact substring ("text") as it appears in that field, a short reason in English, and a "rewrite" of that substring that keeps the meaning but removes the risk (written in the same language as the substring). Do not flag ordinary business info, prices, neighborhoods/cities, or first names of the provider herself.

Respond ONLY with JSON: {"flags": [{"field": "story_en", "text": "...", "reason": "...", "rewrite": "..."}]}. Return {"flags": []} if nothing is risky.`;

export async function POST(req: Request) {
  const listing = await req.json();
  const fields: Record<string, string> = {};
  for (const k of ["name", "title_en", "title_native", "summary_en", "summary_native", "story_en", "story_native", "availability"]) {
    if (typeof listing[k] === "string" && listing[k]) fields[k] = listing[k];
  }
  (listing.services || []).forEach((s: { name: string }, i: number) => (fields[`services.${i}.name`] = s.name));

  const msg = await client.messages.create({
    model: SMART_MODEL,
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(fields, null, 2) }],
  });
  const parsed = extractJSON<{ flags: Flag[] }>(textOf(msg));
  // Keep only flags whose text actually appears, so the UI can highlight and replace it.
  const flags = (parsed?.flags || []).filter((f) => fields[f.field]?.includes(f.text));
  return Response.json({ flags });
}
