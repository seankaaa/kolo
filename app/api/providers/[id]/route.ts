import { readDB, updateDB } from "@/lib/db";
import { areaById } from "@/lib/areas";
import { publicProvider } from "@/lib/publicProvider";
import type { Provider } from "@/lib/types";

export async function GET(_req: Request, ctx: RouteContext<"/api/providers/[id]">) {
  const { id } = await ctx.params;
  const p = (await readDB()).providers.find((x) => x.id === id);
  return p ? Response.json(publicProvider(p)) : Response.json({ error: "Not found" }, { status: 404 });
}

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
      { headers: { "User-Agent": "kolo-hackathon-demo" } }
    );
    const [hit] = await r.json();
    return hit ? { lat: +hit.lat, lng: +hit.lon } : null;
  } catch {
    return null;
  }
}

/**
 * Two uses: { verified: true } (mock verification), or { listing } to publish.
 * Home-based providers never get coordinates; they render at their chosen area's center.
 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/providers/[id]">) {
  const { id } = await ctx.params;
  const body = await req.json();
  const l = body.listing as Partial<Provider> | undefined;
  // Mock auth: owned listings can only be changed by their owner (user id sent by the client).
  const actor = req.headers.get("x-kolo-user");
  const existing = (await readDB()).providers.find((x) => x.id === id);
  if (existing?.ownerId && existing.ownerId !== actor) return Response.json({ error: "forbidden" }, { status: 403 });

  let coords: { lat: number; lng: number } | null = null;
  const isShop = !!(l && l.locationPrecision === "exact" && l.address);
  if (l) {
    if (!l.areaId || !areaById(l.areaId)) return Response.json({ error: "Unknown area" }, { status: 400 });
    if (isShop) {
      const a = areaById(l.areaId)!;
      coords = (await geocode(l.address!)) ?? { lat: a.lat, lng: a.lng };
    }
  }

  const p = await updateDB((db) => {
    const p = db.providers.find((x) => x.id === id);
    if (!p) return null;
    if (typeof body.verified === "boolean") p.verified = body.verified;
    if (typeof body.paused === "boolean") p.paused = body.paused;
    if (l) {
      Object.assign(p, {
        category: l.category || "other",
        title_en: l.title_en || "",
        title_native: l.title_native || "",
        summary_en: l.summary_en || "",
        summary_native: l.summary_native || "",
        story_en: l.story_en || "",
        story_native: l.story_native || "",
        services: (l.services || []).map((s) => ({ name: s.name, price: s.price, kind: s.kind || "service" })),
        areaId: l.areaId,
        locationPrecision: isShop ? "exact" : areaById(l.areaId!)!.level,
        travelRadius: Number(l.travelRadius) || 0,
        availability: l.availability || "",
        languages: l.languages || [],
        otherCity: (l as { other_city?: string }).other_city || undefined,
        status: "live",
      });
      delete p.lat;
      delete p.lng;
      delete p.address;
      if (isShop && coords) Object.assign(p, coords, { address: l.address });
    }
    return p;
  });
  return p ? Response.json(publicProvider(p)) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/providers/[id]">) {
  const { id } = await ctx.params;
  const actor = req.headers.get("x-kolo-user");
  const ok = await updateDB((db) => {
    const p = db.providers.find((x) => x.id === id);
    if (!p || (p.ownerId && p.ownerId !== actor)) return false;
    db.providers = db.providers.filter((x) => x.id !== id);
    return true;
  });
  return ok ? Response.json({ ok }) : Response.json({ error: "forbidden" }, { status: 403 });
}
