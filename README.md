# Kolo ◯

**A 3-minute voice conversation in your own language becomes a professional local listing, and every customer conversation after that is translated.**

Kolo (коло, "circle") is a two-sided local services platform for immigrant women, and for any woman building income, built around language access.

🎥 **Demo video:** _coming soon_

---

## The problem

Listing yourself on Thumbtack, Yelp, or TaskRabbit assumes you write fluent English and can fill in long forms. A woman who makes the best tamales in Oakland, or who was a nail technician for six years in Kharkiv, often can't present herself professionally in English. After she gets listed, every customer message is another language barrier.

## How it works

### Her side (`/join`)
1. She picks her language: **Українською · En español · По-русски · English**, then ticks one box: "I'm authorized to work in the US." That's the only status question.
2. She **talks** (Web Speech API) or types. Claude interviews her in her language, **one question at a time**: services, prices, shop vs. home-based, area, travel or delivery radius, availability, and an optional short story.
3. She chooses how precise her location is, from broad to precise (Bay Area › East Bay › Oakland). Home-based work defaults to the subregion. An exact address is offered **only** for a physical shop.
4. Claude writes a **bilingual listing** (English plus her language). A second Claude pass runs a **privacy check** that flags street names, client or employer names, children's names or schools, and immigration-status hints, and suggests a rewrite for each. She clicks to accept.
5. **Publish**, and she's on the map. Then an optional mock **Get verified** step (ID or partner organization).

### Customer side (`/`)
1. Browse a **map** of local services. Search by area (it recenters the map) or by keyword, and filter by category.
2. Home-based providers appear as a **circle over the area they chose**, grouped with a count badge. Storefronts get a real pin.
3. Open a listing to see the bilingual title, her story ("read in her words"), services and prices, and who she serves. Then **Book** or **Order**.
4. Chat inside the order. **Every message is translated** both ways, with the original shown underneath. 🎤 speaks in your language; 🔊 reads messages aloud.

She manages orders at `/her/<id>`, where the whole UI is in her language. She can accept or decline, and shares her exact address in the chat only after she accepts, and only if she chooses to.

## What's different

- **Voice intake in any language.** No forms. She just talks.
- **Polish, never invent.** Claude may rewrite and translate, but every fact must come from her answers. Missing prices, credentials, or experience get asked about, never made up.
- **Privacy check before publishing.** It catches what people overshare.
- **Location scope she chooses, shown as circles.** Home-based providers never have exact coordinates stored. They render at the fixed center of the area they picked, with no random jitter that could be averaged out.
- **Translated order chat.** It uses Claude Haiku in both directions, with the original always visible.

## Run it

```bash
git clone https://github.com/seankaaa/kolo && cd kolo
npm install
cp .env.example .env.local   # then put your ANTHROPIC_API_KEY in .env.local
npm run dev
```

**Two-window demo** (use **Chrome** for voice input):

| Window | URL | Role |
|---|---|---|
| 1 | http://localhost:3000/ | Customer: browse the map, book Oksana's gel manicure, pick English |
| 2 | http://localhost:3000/her/oksana | Provider: her inbox, in Ukrainian |

Chat in both windows. Each side reads the other in their own language, and the windows sync every 2 seconds. To create a new provider, go to http://localhost:3000/join.

State lives in `data/db.json`, created from `data/seed.json` on first run. Delete it to reset the demo.

Models: `claude-sonnet-5-5` (intake and privacy check), `claude-haiku-5-5` (chat translation).

## Data & safety

- **Synthetic data only.** All 12 seeded providers, names, and shop addresses are fictional.
- **No status data.** Work authorization is a single checkbox and isn't stored. There are no immigration-status fields and no SSNs.
- **No exact locations for home-based providers.** Only the area she chose is stored. Exact coordinates exist only for storefronts that list a public shop address.
- **No real payments.** Book and Order only create a request and a chat.
- `ANTHROPIC_API_KEY` stays in `.env.local` and is never committed.

## Limitations & next steps

- **Verification is mocked.** Next step: real ID verification, plus vouching by partner organizations (resettlement agencies, community groups).
- **Licensing hints** for regulated services: cosmetology licenses, childcare background checks, and California cottage-food and home-kitchen permits.
- **Payments** and deposits.
- **SMS and WhatsApp notifications**, since many providers live in WhatsApp and not in a web inbox.
- **Partner organizations to solve cold start.** They can onboard providers in groups and seed customer demand.
- Real auth, a real database, and moderation. This demo uses a JSON file and has no accounts.

## License

MIT
