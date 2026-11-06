import type Anthropic from "@anthropic-ai/sdk";
import { client, SMART_MODEL } from "@/lib/claude";
import { areaById } from "@/lib/areas";
import { LISTING_TOOL, listingSystem, type ChatMsg } from "@/lib/intake";
import type { Lang } from "@/lib/types";

type Listing = {
  title_native: string; title_en: string; summary_native: string; summary_en: string;
  story_native?: string | null; story_en?: string | null;
  services: { name: string; price: string; kind: "service" | "product"; source?: string[] }[];
  category: string; areaId: string; locationPrecision: string; address?: string | null;
  travelRadius: number; availability?: string | null; languages?: string[];
  provenance: Record<string, string[]>;
};

const nums = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) || []).map((n) => parseFloat(n.replace(",", ".")));

/**
 * Deterministic guardrails, independent of the model:
 * 1. every number in the listing must appear in her own words (km may come from miles);
 * 2. every field must carry non-empty provenance, or it is removed.
 */
function check(l: Listing, transcript: string) {
  const said = new Set(nums(transcript));
  const has = (n: number) => said.has(n);
  const dropped: string[] = [];
  const prov = l.provenance || {};
  const hasProv = (k: string) => Array.isArray(prov[k]) && prov[k].some((q) => q?.trim());

  // Attach each service's source quotes before filtering so indices can't drift.
  l.services = (l.services || [])
    .map((s, i) => ({ ...s, source: prov[`services.${i}`] }))
    .filter((s) => {
      if (!s.source?.some((q) => q?.trim())) { dropped.push(`service "${s.name}" (no source in her words)`); return false; }
      return true;
    });
  l.services.forEach((s) => {
    const bad = nums(s.price).filter((n) => !has(n));
    if (bad.length) { dropped.push(`price "${s.price}" for ${s.name}`); s.price = "price on request"; }
  });

  if (l.travelRadius) {
    const km = l.travelRadius;
    const okMiles = [Math.round(km / 1.6), Math.round(km / 1.609), Math.floor(km / 1.6), Math.ceil(km / 1.609)].some(has);
    if (!(has(km) || okMiles) || !hasProv("travelRadius")) { dropped.push(`travel radius ${km} km`); l.travelRadius = 0; }
  }

  for (const f of ["title", "summary", "story"] as const) {
    const native = `${f}_native` as const, en = `${f}_en` as const;
    const text = `${l[native] ?? ""} ${l[en] ?? ""}`;
    const bad = nums(text).filter((n) => !has(n));
    if (bad.length) dropped.push(`${f}: number(s) ${bad.join(", ")} not in her words`);
    if (!hasProv(f) || bad.length) {
      if (f === "story") { l.story_native = null; l.story_en = null; }
      else { l[native] = ""; l[en] = ""; }
    }
  }
  if (!hasProv("availability")) l.availability = null;
  if (!hasProv("languages")) l.languages = [];
  if (!hasProv("address") || l.locationPrecision !== "exact") { l.address = null; }
  if (!areaById(l.areaId) || !hasProv("areaId")) { dropped.push("location area"); l.areaId = ""; }
  if (l.locationPrecision === "exact" && !l.address) l.locationPrecision = areaById(l.areaId)?.level || "region";
  return dropped;
}

export async function POST(req: Request) {
  const { lang, messages } = (await req.json()) as { lang: Lang; messages: ChatMsg[] };
  const transcript = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  try {
    const msg = await client.messages.create({
      model: SMART_MODEL,
      max_tokens: 3000,
      system: listingSystem(lang),
      tools: [LISTING_TOOL],
      tool_choice: { type: "tool", name: LISTING_TOOL.name },
      messages: [
        {
          role: "user",
          content: `Interview transcript (Q = Kolo, A = her):\n\n${messages
            .map((m) => `${m.role === "user" ? "A" : "Q"}: ${m.content}`)
            .join("\n")}`,
        },
      ],
    });
    const tool = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!tool) throw new Error("no tool call");
    const listing = tool.input as Listing;
    const dropped = check(listing, transcript);
    return Response.json({ listing, dropped });
  } catch (e) {
    console.error("listing failed", (e as Error).message);
    return Response.json({ error: "listing_failed" }, { status: 500 });
  }
}
