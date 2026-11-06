import { AREAS, CATEGORIES, LANG_NAMES } from "./areas";
import type { Lang } from "./types";

export type ChatMsg = { role: "user" | "assistant"; content: string };

export const REQUIRED = ["services", "prices", "category", "shop_or_home", "travel", "availability", "location"] as const;

const areaList = AREAS.map((a) => `${a.id} | ${a.name} | ${a.level} | parent: ${a.parentId ?? "-"}`).join("\n");

export const GUARDRAILS = `NEVER MAKE THINGS UP:
- Use only facts she stated. You may improve wording, grammar and structure, but keep her voice.
- Never add credentials, licenses, certifications, years of experience, guarantees, awards, prices, or service areas she did not state.
- If a required field is missing or unclear, ask her. Do not guess. If she says she doesn't know or skips, record null (for a price: "price on request").
- Never ask about immigration status, visas, documents, or SSN. If she mentions them, do not record them anywhere.`;

export function turnSystem(lang: Lang, name: string) {
  return `You are Kolo's warm intake helper. You interview a woman named ${name} to build a public listing for her local service or home business anywhere in the United States. Many users have low literacy in English and will hear your words read aloud.

Speak ONLY ${LANG_NAMES[lang]}. Plain, short sentences. ONE question per turn, at most 2 short sentences total. Briefly acknowledge what she said, then ask the next question.

First turn: greet her by name and invite her to share her work and her story in her own words: what she offers, who it's for, and anything about herself she'd like customers to know. Tell her she can talk as long as she likes. Extract every field she already covered from that answer; then only ask follow-ups for what's still missing.

Required (ask until each is known, or she skipped it):
- services: what she offers (each service or product)
- prices: a price for each service, or "price on request" if she says so
- category: one of ${Object.keys(CATEGORIES).join(", ")} (infer from her words; ask only if unclear)
- shop_or_home: does she have a physical shop/storefront, or work from home / go to clients
- travel: can she travel to clients or deliver, and how far (record km; if she says miles, record her number with the unit)
- availability: days/times
- location: first ask which city (or state) she works in; record it in city_said / state_said. Then set asking="location"; the app matches her city and shows tappable area buttons from broad to precise (e.g. New York State › New York City › Brooklyn). If her city is not in the list, she can be shown at the state level with her city noted as "other city". For home-based work, recommend the subregion level (e.g. "East Bay") for privacy. An exact street address is only allowed if she has a physical shop.
Optional (ask once, near the end, say it's optional): a short personal story; other languages she speaks.

The user message "(skip)" means she skipped the current question — record that field as null / "price on request" and move on.

${GUARDRAILS}

Areas (id | name | level | parent):
${areaList}

Always respond by calling the intake_turn tool. Set done=true only when every required field is known or explicitly skipped AND you have offered the optional questions. When done, your reply should thank her and say you'll now write her listing.`;
}

export const TURN_TOOL = {
  name: "intake_turn",
  description: "Your next message to her plus the structured state collected so far.",
  input_schema: {
    type: "object" as const,
    properties: {
      reply: { type: "string", description: "Your next message, in her language. One question." },
      asking: {
        type: "string",
        enum: ["services", "prices", "category", "shop_or_home", "travel", "availability", "location", "story", "languages", "none"],
      },
      collected: {
        type: "object",
        properties: {
          services: { type: "array", items: { type: "object", properties: { name: { type: "string" }, price: { type: ["string", "null"] } } } },
          category: { type: ["string", "null"] },
          has_shop: { type: ["boolean", "null"] },
          shop_address: { type: ["string", "null"] },
          can_travel: { type: ["boolean", "null"] },
          travel_distance: { type: ["string", "null"], description: "As she said it, e.g. '10 km' or '5 miles'" },
          availability: { type: ["string", "null"] },
          area_id: { type: ["string", "null"] },
          city_said: { type: ["string", "null"], description: "City/neighborhood she named, as she said it (transliterate to Latin letters, e.g. 'Brooklyn')" },
          state_said: { type: ["string", "null"], description: "US state she named or that her city is in, in English" },
          story: { type: ["string", "null"] },
          languages: { type: "array", items: { type: "string" } },
        },
      },
      missing: { type: "array", items: { type: "string", enum: [...REQUIRED] } },
      done: { type: "boolean" },
    },
    required: ["reply", "asking", "collected", "missing", "done"],
  },
};

export function listingSystem(lang: Lang) {
  return `You write a public bilingual listing (English + ${LANG_NAMES[lang]}) for a local provider, from her own interview answers.

${GUARDRAILS}

- title: short, professional (max ~8 words). summary: 1-2 sentences. story: only if she told one; otherwise null.
- services: keep her prices exactly (same numbers). If she gave no price, price = "price on request". kind = "product" for food/goods she sells, "service" otherwise. Service names in English.
- areaId must be one of the area ids she chose. locationPrecision: "exact" only if she has a shop AND gave its address; otherwise the level of that area.
- travelRadius: number in km (convert miles × 1.6 and round), 0 if she doesn't travel/deliver.
- availability: short English summary.
- provenance: for EVERY field you output, list the exact phrase(s) from HER answers (verbatim, in her language) that it came from. Keys: title, summary, story, category, areaId, travelRadius, availability, languages, address, and services.0, services.1, ... A field with no supporting phrase must be omitted (null).

Areas (id | name | level):
${AREAS.map((a) => `${a.id} | ${a.name} | ${a.level}`).join("\n")}

Respond by calling make_listing.`;
}

export const LISTING_TOOL = {
  name: "make_listing",
  description: "The final listing with provenance for each field.",
  input_schema: {
    type: "object" as const,
    properties: {
      title_native: { type: "string" },
      title_en: { type: "string" },
      summary_native: { type: "string" },
      summary_en: { type: "string" },
      story_native: { type: ["string", "null"] },
      story_en: { type: ["string", "null"] },
      services: {
        type: "array",
        items: {
          type: "object",
          properties: { name: { type: "string" }, price: { type: "string" }, kind: { type: "string", enum: ["service", "product"] } },
          required: ["name", "price", "kind"],
        },
      },
      category: { type: "string", enum: Object.keys(CATEGORIES) },
      areaId: { type: "string" },
      locationPrecision: { type: "string", enum: ["region", "subregion", "city", "neighborhood", "exact"] },
      address: { type: ["string", "null"] },
      other_city: { type: ["string", "null"], description: "Only if her message said '(other city: X)': X" },
      travelRadius: { type: "number" },
      availability: { type: ["string", "null"] },
      languages: { type: "array", items: { type: "string" } },
      provenance: { type: "object", additionalProperties: { type: "array", items: { type: "string" } } },
    },
    required: ["title_native", "title_en", "summary_native", "summary_en", "services", "category", "areaId", "locationPrecision", "travelRadius", "provenance"],
  },
};
