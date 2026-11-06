import { updateDB, newId } from "@/lib/db";
import type { Lang, User } from "@/lib/types";

/** Demo login: find by email or create. No passwords, no email is sent. */
export async function POST(req: Request) {
  const b = (await req.json()) as { email?: string; name?: string; language?: Lang };
  const email = (b.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "email" }, { status: 400 });
  const user = await updateDB((db) => {
    db.users ??= [];
    let u = db.users.find((x) => x.email === email);
    if (!u) {
      u = { id: newId("u"), email, name: (b.name || email.split("@")[0]).trim().slice(0, 60), language: b.language || "en", createdAt: Date.now() } as User;
      db.users.push(u);
    }
    return u;
  });
  return Response.json(user);
}
