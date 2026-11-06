import { readDB, updateDB, newId } from "@/lib/db";
import { publicProvider } from "@/lib/publicProvider";
import type { Lang, Provider } from "@/lib/types";

export async function GET() {
  const db = await readDB();
  return Response.json(db.providers.filter((p) => p.status !== "draft" && !p.paused).map(publicProvider));
}

/** Sign-up: creates a draft provider. No passwords, no SSN, no status fields. */
export async function POST(req: Request) {
  const b = (await req.json()) as { name?: string; contact?: string; language?: Lang };
  if (!b.name?.trim() || !b.contact?.trim()) {
    return Response.json({ error: "name and contact required" }, { status: 400 });
  }
  const provider: Provider = {
    id: newId("p"),
    name: b.name.trim().slice(0, 60),
    contact: b.contact.trim().slice(0, 120),
    language: b.language || "en",
    category: "other",
    title_en: "",
    title_native: "",
    story_en: "",
    story_native: "",
    services: [],
    areaId: "bay-area",
    locationPrecision: "region",
    travelRadius: 0,
    status: "draft",
    verified: false,
  };
  await updateDB((db) => db.providers.push(provider));
  return Response.json(publicProvider(provider));
}
