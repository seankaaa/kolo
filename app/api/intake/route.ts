import type Anthropic from "@anthropic-ai/sdk";
import { client, SMART_MODEL } from "@/lib/claude";
import { completeTurn, TURN_TOOL, turnSystem, type ChatMsg } from "@/lib/intake";
import type { Lang } from "@/lib/types";

const KICKOFF = "(She just opened the intake. Greet her and ask the first open question.)";

export async function POST(req: Request) {
  const { lang, name, messages } = (await req.json()) as { lang: Lang; name: string; messages: ChatMsg[] };
  try {
    const msg = await client.messages.create({
      model: SMART_MODEL,
      max_tokens: 1500,
      system: turnSystem(lang, name || "friend"),
      tools: [TURN_TOOL],
      tool_choice: { type: "auto" }, // forced tool choice isn't supported on this model; the prompt requires the tool
      messages: [{ role: "user", content: KICKOFF }, ...messages],
    });
    const tool = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (tool) return Response.json(completeTurn(tool.input as Record<string, unknown>, messages));
    // Fallback: plain-text reply; keep the conversation going.
    const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    console.warn("intake: model replied without the tool");
    return Response.json(completeTurn({ reply: text, asking: "none", collected: {} }, messages));
  } catch (e) {
    console.error("intake failed", (e as Error).message);
    return Response.json({ error: "intake_failed" }, { status: 500 });
  }
}
