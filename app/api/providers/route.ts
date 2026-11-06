import { readDB, updateDB, newId } from "@/lib/db";
import { publicProvider } from "@/lib/publicProvider";
import { areaById } from "@/lib/areas";
import type { Lang, Provider } from "@/lib/types";

export async function GET() {
  const db = await readDB();
  return Response.json(db.providers.filter((p) => p.status !== "draft" && !p.paused).map(publicProvider));
}

/** Publish a new listing owned by a user. Home-based listings never get coordinates. */
export async function POST(req: Request) {
  const b = (await req.json()) as { ownerId?: string; language?: Lang; listing?: Partial<Provider> };
  const db0 = await readDB();
  const owner = db0.users?.find((u) => u.id === b.ownerId);
  const l = b.listing;
  if (!owner || !l) return Response.json({ error: "login required" }, { status: 401 });
  if (!l.areaId || !areaById(l.areaId)) return Response.json({ error: "Unknown area" }, { status: 400 });
  const isShop = l.locationPrecision === "exact" && !!l.address;
  const coords = isShop ? await geocode(l.address!, l.areaId) : null;
  const provider: Provider = {
    id: newId("p"),
    ownerId: owner.id,
    name: owner.name,
    language: b.language || owner.language,
    category: l.category || "other",
    title_en: l.title_en || "",
    title_native: l.title_native || "",
    summary_en: l.summary_en || "",
    summary_native: l.summary_native || "",
    story_en: l.story_en || "",
    story_native: l.story_native || "",
    services: (l.services || []).map((s) => ({ name: s.name, price: s.price, kind: s.kind || "service" })),
    areaId: l.areaId,
    locationPrecision: isShop ? "exact" : areaById(l.areaId)!.level,
    ...(isShop && coords ? { ...coords, address: l.address } : {}),
    travelRadius: Number(l.travelRadius) || 0,
    availability: l.availability || "",
    languages: l.languages || [],
    needs: (l.needs || []).slice(0, 6),
    paymentHandles: (l.paymentHandles || []).slice(0, 4),
    otherCity: (l as { other_city?: string }).other_city || undefined,
    status: "live",
    verified: false,
  };
  await updateDB((db) => db.providers.push(provider));
  return Response.json(publicProvider(provider));
}

async function geocode(address: string, areaId: string) {
  const a = areaById(areaId)!;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`, {
      headers: { "User-Agent": "kolo-hackathon-demo" },
    });
    const [hit] = await r.json();
    if (hit) return { lat: +hit.lat, lng: +hit.lon };
  } catch {}
  return { lat: a.lat, lng: a.lng };
}
