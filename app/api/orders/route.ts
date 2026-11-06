import { readDB, updateDB, newId } from "@/lib/db";
import type { Order } from "@/lib/types";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const providerId = params.get("providerId");
  const customerId = params.get("customerId");
  if (!providerId && !customerId) return Response.json([]);
  const db = await readDB();
  const orders = db.orders.filter((o) => (providerId ? o.providerId === providerId : o.customerId === customerId));
  return Response.json(orders.sort((a, b) => b.createdAt - a.createdAt));
}

export async function POST(req: Request) {
  const b = await req.json();
  const order: Order = {
    id: newId("o"),
    providerId: b.providerId,
    customerName: b.customerName || "Customer",
    customerLanguage: b.customerLanguage || "en",
    item: b.item || "",
    details: b.details || "",
    quantity: Math.max(1, Math.min(99, Number(b.quantity) || 1)),
    when: typeof b.when === "string" ? b.when.slice(0, 16) : undefined,
    areaText: typeof b.areaText === "string" ? b.areaText.slice(0, 80) : undefined,
    contact: typeof b.contact === "string" ? b.contact.slice(0, 120) : undefined,
    customerId: typeof b.customerId === "string" ? b.customerId.slice(0, 40) : undefined,
    status: "new",
    messages: [],
    createdAt: Date.now(),
  };
  await updateDB((db) => db.orders.push(order));
  return Response.json(order);
}
