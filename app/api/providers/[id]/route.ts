import { readDB, updateDB } from "@/lib/db";

export async function GET(_req: Request, ctx: RouteContext<"/api/providers/[id]">) {
  const { id } = await ctx.params;
  const p = (await readDB()).providers.find((x) => x.id === id);
  return p ? Response.json(p) : Response.json({ error: "Not found" }, { status: 404 });
}

// Mock verification only: flips the badge, no real identity check.
export async function PATCH(req: Request, ctx: RouteContext<"/api/providers/[id]">) {
  const { id } = await ctx.params;
  const { verified } = await req.json();
  const p = await updateDB((db) => {
    const p = db.providers.find((x) => x.id === id);
    if (p) p.verified = !!verified;
    return p;
  });
  return p ? Response.json(p) : Response.json({ error: "Not found" }, { status: 404 });
}
