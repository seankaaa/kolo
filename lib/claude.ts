import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;
/** Created lazily so routes still load (and chat degrades to untranslated) when no key is set. */
export const client = {
  get messages() {
    _client ??= new Anthropic();
    return _client.messages;
  },
};
export const SMART_MODEL = "claude-sonnet-5-5";
export const FAST_MODEL = "claude-haiku-5-5";

export function textOf(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** Pull the first JSON object out of a model reply (tolerates ```json fences). */
export function extractJSON<T>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
