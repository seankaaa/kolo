import { readDB, updateDB, newId } from "@/lib/db";
import { client, FAST_MODEL, textOf } from "@/lib/claude";
import { LANG_NAMES } from "@/lib/areas";
import type { Lang, Message } from "@/lib/types";

async function translate(text: string, from: Lang, to: Lang): Promise<string> {
  if (from === to) return text;
  const msg = await client.messages.create({
    model: FAST_MODEL,
    max_tokens: 1024,
    system:
      `Translate the user's chat message from ${LANG_NAMES[from]} to ${LANG_NAMES[to]}. ` +
      "This is a conversation between a local service provider and a customer. Keep the tone, " +
      "keep numbers, prices, dates and addresses exactly. Output only the translation.",
    messages: [{ role: "user", content: text }],
  });
  return textOf(msg).trim();
}

export async function POST(req: Request, ctx: RouteContext<"/api/orders/[id]/messages">) {
  const { id } = await ctx.params;
  const { from, text } = (await req.json()) as { from: "customer" | "provider"; text: string };
  const db = await readDB();
  const order = db.orders.find((o) => o.id === id);
  const provider = order && db.providers.find((p) => p.id === order.providerId);
  if (!order || !provider || !text?.trim()) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const senderLang = from === "customer" ? order.customerLanguage : provider.language;
  const readerLang = from === "customer" ? provider.language : order.customerLanguage;

  let translated = text;
  try {
    translated = await translate(text, senderLang, readerLang);
  } catch (e) {
    console.error("translate failed", (e as Error).message);
  }
  const message: Message = {
    id: newId("m"),
    from,
    original: text,
    lang: senderLang,
    translations: { [readerLang]: translated },
    at: Date.now(),
  };
  await updateDB((db) => db.orders.find((o) => o.id === id)?.messages.push(message));
  return Response.json(message);
}
