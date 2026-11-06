import { readDB, updateDB } from "@/lib/db";

export async function GET(_req: Request, ctx: RouteContext<"/api/orders/[id]">) {
  const { id } = await ctx.params;
  const db = await readDB();
  const order = db.orders.find((o) => o.id === id);
  if (!order) return Response.json({ error: "Not found" }, { status: 404 });
  const provider = db.providers.find((p) => p.id === order.providerId);
  return Response.json({ order, provider });
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/orders/[id]">) {
  const { id } = await ctx.params;
  const { status } = await req.json();
  const order = await updateDB((db) => {
    const o = db.orders.find((x) => x.id === id);
    if (o && ["new", "accepted", "declined", "done"].includes(status)) o.status = status;
    return o;
  });
  return order ? Response.json(order) : Response.json({ error: "Not found" }, { status: 404 });
}
