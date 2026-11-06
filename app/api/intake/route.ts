import type Anthropic from "@anthropic-ai/sdk";
import { client, SMART_MODEL } from "@/lib/claude";
import { TURN_TOOL, turnSystem, type ChatMsg } from "@/lib/intake";
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
      tool_choice: { type: "tool", name: TURN_TOOL.name },
      messages: [{ role: "user", content: KICKOFF }, ...messages],
    });
    const tool = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!tool) throw new Error("no tool call");
    return Response.json(tool.input);
  } catch (e) {
    console.error("intake failed", (e as Error).message);
    return Response.json({ error: "intake_failed" }, { status: 500 });
  }
}
