import { readDB } from "@/lib/db";
import { publicProvider } from "@/lib/publicProvider";

/** Everything the profile page needs for one (mock-logged-in) user. */
export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("userId");
  const db = await readDB();
  const user = db.users?.find((u) => u.id === userId);
  if (!user) return Response.json({ error: "Not found" }, { status: 404 });
  const listings = db.providers.filter((p) => p.ownerId === user.id);
  const ids = new Set(listings.map((p) => p.id));
  const byNewest = <T extends { createdAt: number }>(a: T, b: T) => b.createdAt - a.createdAt;
  return Response.json({
    user,
    listings: listings.map(publicProvider),
    received: db.orders.filter((o) => o.providerUserId === user.id || ids.has(o.providerId)).sort(byNewest),
    placed: db.orders.filter((o) => o.customerUserId === user.id).sort(byNewest),
  });
}
