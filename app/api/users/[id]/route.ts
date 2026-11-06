import { readDB, updateDB } from "@/lib/db";

export async function GET(_req: Request, ctx: RouteContext<"/api/users/[id]">) {
  const { id } = await ctx.params;
  const u = (await readDB()).users?.find((x) => x.id === id);
  return u ? Response.json(u) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/users/[id]">) {
  const { id } = await ctx.params;
  const b = await req.json();
  const u = await updateDB((db) => {
    const u = db.users?.find((x) => x.id === id);
    if (!u) return null;
    if (typeof b.name === "string" && b.name.trim()) u.name = b.name.trim().slice(0, 60);
    if (["es", "uk", "ru", "en"].includes(b.language)) u.language = b.language;
    return u;
  });
  return u ? Response.json(u) : Response.json({ error: "Not found" }, { status: 404 });
}
