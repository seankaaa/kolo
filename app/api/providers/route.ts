import { readDB, updateDB, newId } from "@/lib/db";
import { areaById } from "@/lib/areas";
import type { Provider } from "@/lib/types";

export async function GET() {
  const db = await readDB();
  return Response.json(db.providers);
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<Provider>;
  if (!body.areaId || !areaById(body.areaId)) {
    return Response.json({ error: "Unknown area" }, { status: 400 });
  }
  const isShop = body.locationPrecision === "exact";
  const provider: Provider = {
    id: newId("p"),
    name: body.name || "New provider",
    language: body.language || "en",
    category: body.category || "other",
    title_en: body.title_en || "",
    title_native: body.title_native || "",
    story_en: body.story_en || "",
    story_native: body.story_native || "",
    services: body.services || [],
    areaId: body.areaId,
    // Home-based providers never get exact coordinates; they render at the area center.
    locationPrecision: isShop ? "exact" : areaById(body.areaId)!.level,
    ...(isShop && body.lat && body.lng ? { lat: body.lat, lng: body.lng, address: body.address } : {}),
    travelRadius: body.travelRadius ?? 0,
    availability: body.availability,
    verified: false,
  };
  await updateDB((db) => db.providers.push(provider));
  return Response.json(provider);
}
