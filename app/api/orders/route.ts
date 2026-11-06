import { readDB, updateDB, newId } from "@/lib/db";
import type { Order } from "@/lib/types";

export async function GET(req: Request) {
  const providerId = new URL(req.url).searchParams.get("providerId");
  const db = await readDB();
  const orders = providerId ? db.orders.filter((o) => o.providerId === providerId) : db.orders;
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
    status: "new",
    messages: [],
    createdAt: Date.now(),
  };
  await updateDB((db) => db.orders.push(order));
  return Response.json(order);
}
