"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import { speak, speechSupported, useDictation } from "@/components/useSpeech";
import { AREAS, areaChain, CATEGORIES, parentLabel, searchAreas, SPEECH_LANG } from "@/lib/areas";
import { load, save, translate, useUILang, type UIKey } from "@/lib/i18n";
import type { ChatMsg } from "@/lib/intake";
import type { Area, Lang } from "@/lib/types";

type Turn = {
  reply: string;
  asking: string;
  collected: { has_shop?: boolean | null; [k: string]: unknown };
  missing: string[];
  done: boolean;
};
type Service = { name: string; price: string; kind: "service" | "product"; source?: string[] };
type Listing = {
  title_native: string; title_en: string; summary_native: string; summary_en: string;
  story_native?: string | null; story_en?: string | null; services: Service[];
  category: string; areaId: string; locationPrecision: string; address?: string | null;
  travelRadius: number; availability?: string | null; languages?: string[];
  provenance: Record<string, string[]>;
};
type Flag = { field: string; text: string; reason: string; rewrite: string };
type Draft = {
  step: "lang" | "signup" | "intake" | "building" | "preview";
  lang: Lang; name: string; contact: string; providerId?: string;
  messages: ChatMsg[]; display: string[]; turn?: Turn; prevTurns?: Turn[]; followupDone?: boolean;
  listing?: Listing; flags?: Flag[] | null;
};

const TOTAL = 7;
/** Her language first, then English (or Spanish if she chose English). */
const micLangs = (l: Lang): Lang[] => (l === "en" ? ["en", "es"] : [l, "en"]);
const LANG_BUTTONS: { lang: Lang; label: string }[] = [
  { lang: "es", label: "Español" },
  { lang: "uk", label: "Українська" },
  { lang: "ru", label: "Русский" },
  { lang: "en", label: "English" },
];
const EMPTY: Draft = { step: "lang", lang: "en", name: "", contact: "", messages: [], display: [] };

const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-40";

export default function Join() {
  const router = useRouter();
  const { setLang } = useUILang();
  const [d, setD] = useState<Draft>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [voiceOn, setVoiceOn] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [agreePublic, setAgreePublic] = useState(false);
  const t = (k: UIKey, v?: Record<string, string | number>) => translate(d.lang, k, v);

  // Resume a saved draft: no timeouts, she can leave and come back.
  useEffect(() => {
    setD(load<Draft>("kolo.draft", EMPTY));
    setVoiceOn(load("kolo.voice", true));
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) save("kolo.draft", d);
  }, [d, hydrated]);

  const dictation = useDictation(SPEECH_LANG[d.lang], setAnswer);
  const canSpeak = hydrated && speechSupported();

  // Read each new question aloud in her language.
  const lastSpoken = useRef("");
  useEffect(() => {
    const q = d.turn?.reply;
    if (d.step === "intake" && q && voiceOn && q !== lastSpoken.current) {
      lastSpoken.current = q;
      speak(q, SPEECH_LANG[d.lang]);
    }
  }, [d.turn?.reply, d.step, voiceOn, d.lang]);

  const update = (patch: Partial<Draft>) => setD((cur) => ({ ...cur, ...patch }));

  async function post<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  async function nextTurn(messages: ChatMsg[], display: string[], base: Draft = d) {
    setBusy(true);
    setError("");
    try {
      const turn = await post<Turn>("/api/intake", { lang: base.lang, name: base.name, messages });
      if (!turn || typeof turn.reply !== "string") {
        console.error("[kolo] bad intake response", turn);
        throw new Error("bad response");
      }
      const msgs: ChatMsg[] = [...messages, { role: "assistant", content: turn.reply }];
      const prevTurns = base.turn ? [...(base.prevTurns || []), base.turn] : base.prevTurns || [];
      const next = { ...base, messages: msgs, display, turn, prevTurns };
      setD(next);
      setAnswer("");
      if (turn.done) await buildListing(next);
    } catch {
      setError(t("errNetwork"));
    } finally {
      setBusy(false);
    }
  }

  async function buildListing(base: Draft) {
    setD({ ...base, step: "building" });
    try {
      const { listing, dropped } = await post<{ listing: Listing; dropped: string[] }>("/api/intake/listing", {
        lang: base.lang,
        messages: base.messages,
      });
      // A number or field we couldn't trace to her words: ask her once instead of guessing.
      if (dropped.length && !base.followupDone) {
        const note = `(Kolo check: these were not found in her own words, so they were removed: ${dropped.join("; ")}. Ask her about the first one, briefly.)`;
        const again = { ...base, step: "intake" as const, followupDone: true };
        setD(again);
        await nextTurn([...base.messages, { role: "user", content: note }], base.display, again);
        return;
      }
      const ready = { ...base, step: "preview" as const, listing, flags: null };
      setD(ready);
      const { flags } = await post<{ flags: Flag[] }>("/api/privacy", { ...listing, name: base.name });
      setD({ ...ready, flags });
    } catch {
      setError(t("errNetwork"));
      setD({ ...base, step: "intake" });
    }
  }

  function sendAnswer(content: string, shown = content) {
    if (!content.trim() || busy) return;
    dictation.stop();
    // If the last request failed after her answer was appended, replace it rather than duplicating.
    const base = d.messages[d.messages.length - 1]?.role === "user" ? d.messages.slice(0, -1) : d.messages;
    const disp = d.messages[d.messages.length - 1]?.role === "user" ? d.display.slice(0, -1) : d.display;
    nextTurn([...base, { role: "user", content }], [...disp, shown]);
  }

  async function signup() {
    if (!d.name.trim() || !d.contact.trim() || !authorized || !agreePublic) {
      setError(t("errRequired"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const p = await post<{ id: string }>("/api/providers", { name: d.name, contact: d.contact, language: d.lang });
      save("kolo.providerId", p.id);
      const next = { ...d, providerId: p.id, step: "intake" as const };
      setD(next);
      setBusy(false);
      await nextTurn([], [], next);
    } catch {
      setError(t("errNetwork"));
      setBusy(false);
    }
  }

  async function publish() {
    if (!d.listing || !d.providerId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/providers/${d.providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing: d.listing }),
      });
      if (!res.ok) throw new Error();
      save("kolo.draft", null);
      router.push(`/her/${d.providerId}?live=1`);
    } catch {
      setError(t("errNetwork"));
      setBusy(false);
    }
  }

  /** Re-run the last request after a failure; her answers are kept. */
  function retry() {
    setError("");
    const last = d.messages[d.messages.length - 1];
    if (last?.role === "user" || d.messages.length === 0) nextTurn(d.messages, d.display);
    else if (d.turn?.done) buildListing(d);
    else nextTurn(d.messages, d.display);
  }

  /** Go back one question: drop her last answer + the reply to it, restore the previous question. */
  function previousQuestion() {
    const prev = d.prevTurns || [];
    if (!prev.length || busy) return;
    dictation.stop();
    const lastUser = [...d.messages].map((m) => m.role).lastIndexOf("user");
    setD({
      ...d,
      messages: d.messages.slice(0, lastUser),
      display: d.display.slice(0, -1),
      turn: prev[prev.length - 1],
      prevTurns: prev.slice(0, -1),
    });
    setAnswer(d.display[d.display.length - 1]?.startsWith("📍") ? "" : d.display[d.display.length - 1] || "");
  }

  function startOver() {
    save("kolo.draft", null);
    setD({ ...EMPTY, lang: d.lang, step: "lang" });
    setAnswer("");
    setError("");
  }

  if (!hydrated) return <Page><div /></Page>;

  // ---------- Step 0: language ----------
  if (d.step === "lang") {
    return (
      <Page>
        <h1 className="text-center text-3xl font-bold text-stone-900">🌐 {t("chooseLanguage")}</h1>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {LANG_BUTTONS.map((b) => (
            <button
              key={b.lang}
              lang={b.lang}
              onClick={() => {
                setLang(b.lang);
                update({ lang: b.lang, step: "signup" });
              }}
              className="min-h-28 rounded-3xl border-2 border-stone-200 bg-white text-3xl font-bold text-stone-900 shadow-sm hover:border-orange-500 hover:bg-orange-50 focus-visible:outline-4 focus-visible:outline-orange-500"
            >
              {b.label}
            </button>
          ))}
        </div>
      </Page>
    );
  }

  // ---------- Step 1: sign-up ----------
  if (d.step === "signup") {
    return (
      <Page>
        <h1 className="text-3xl font-bold text-stone-900">{t("signupTitle")}</h1>
        <p className="mt-2 text-lg text-stone-600">{t("chooseLanguageHint")}</p>
        <form
          className="mt-6 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            signup();
          }}
        >
          <Field id="name" label={t("firstName")} hint={t("firstNameHint")}>
            <input id="name" value={d.name} onChange={(e) => update({ name: e.target.value })} autoComplete="given-name" className="input" />
          </Field>
          <Field id="contact" label={t("contact")} hint={t("contactHint")}>
            <input id="contact" value={d.contact} onChange={(e) => update({ contact: e.target.value })} autoComplete="tel" className="input" />
          </Field>
          <Check checked={authorized} onChange={setAuthorized} label={t("authorized")} hint={t("authorizedNote")} />
          <Check checked={agreePublic} onChange={setAgreePublic} label={t("publicAgree")} />
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-lg text-red-800">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => update({ step: "lang" })} className={`${btn} border border-stone-300 bg-white text-lg`}>← {t("back")}</button>
            <button disabled={busy} className={`${btn} flex-1 bg-orange-600 py-4 text-xl text-white hover:bg-orange-700`}>{t("continue")} →</button>
          </div>
        </form>
      </Page>
    );
  }

  // ---------- Step 3: building / preview ----------
  if (d.step === "building" || d.step === "preview") {
    return (
      <Page>
        {d.step === "building" || !d.listing ? (
          <div className="py-20 text-center" aria-live="polite">
            <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
            <p className="mt-6 text-2xl font-semibold text-stone-800">✍️ {t("building")}</p>
          </div>
        ) : (
          <Preview
            d={d}
            t={t}
            onChange={(listing) => update({ listing })}
            onFlag={(f, accept) => {
              const listing = accept ? applyRewrite(d.listing!, f) : d.listing!;
              update({ listing, flags: (d.flags || []).filter((x) => x !== f) });
            }}
          />
        )}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-lg text-red-800">{error}</p>}
        {d.step === "preview" && d.listing && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button onClick={startOver} className={`${btn} border border-stone-300 bg-white`}>↺ {t("startOver")}</button>
            <button onClick={publish} disabled={busy || d.flags === null || !d.listing.areaId} className={`${btn} flex-1 bg-orange-600 py-4 text-xl text-white hover:bg-orange-700`}>
              🚀 {busy ? t("publishing") : t("publish")}
            </button>
          </div>
        )}
      </Page>
    );
  }

  // ---------- Step 2: one question per screen ----------
  const turn = d.turn;
  const step = Math.min(TOTAL, Math.max(1, TOTAL - (turn?.missing.length ?? TOTAL) + 1));
  return (
    <Page>
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg font-medium text-stone-500">{t("stepOf", { n: step, total: TOTAL })}</p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              save("kolo.voice", !voiceOn);
              setVoiceOn(!voiceOn);
              if (voiceOn) window.speechSynthesis?.cancel();
            }}
            aria-pressed={voiceOn}
            className={`${btn} border border-stone-300 bg-white text-sm`}
          >
            {voiceOn ? "🔊" : "🔇"} {voiceOn ? t("speakerOn") : t("speakerOff")}
          </button>
          <button onClick={() => turn && speak(turn.reply, SPEECH_LANG[d.lang])} disabled={!turn} className={`${btn} border border-stone-300 bg-white text-sm`}>
            🔁 {t("repeat")}
          </button>
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200" aria-hidden>
        <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${(step / TOTAL) * 100}%` }} />
      </div>

      <div aria-live="polite" className="mt-8 min-h-24">
        {busy && !turn ? (
          <p className="text-2xl text-stone-400">{t("thinking")}</p>
        ) : (
          <h1 className={`text-[28px] font-bold leading-snug text-stone-900 sm:text-3xl ${busy ? "opacity-40" : ""}`}>{turn?.reply}</h1>
        )}
      </div>

      {turn?.asking === "location" && !busy && (
        <LocationPicker
          t={t}
          hasShop={!!turn.collected?.has_shop}
          citySaid={(turn.collected?.city_said as string) || ""}
          stateSaid={(turn.collected?.state_said as string) || ""}
          areaId={(turn.collected?.area_id as string) || ""}
          onPick={(content, shown) => sendAnswer(content, shown)}
        />
      )}

      <div className="mt-8 flex flex-col items-center gap-3">
        {canSpeak && (
          <>
            <button
              onClick={() => dictation.toggle(answer)}
              disabled={busy}
              aria-label={dictation.listening ? t("listening") : t("tapToSpeak")}
              className={`grid h-28 w-28 place-items-center rounded-full text-5xl shadow-lg transition focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-orange-500 disabled:opacity-40 ${
                dictation.listening ? "animate-pulse bg-red-600 text-white ring-8 ring-red-200" : "bg-orange-600 text-white hover:bg-orange-700"
              }`}
            >
              {dictation.listening ? "⏹" : "🎤"}
            </button>
            <p className={`text-xl font-semibold ${dictation.listening ? "text-red-700" : "text-stone-700"}`}>
              {dictation.listening ? t("listening") : t("tapToSpeak")}
            </p>
            <p className="text-base text-stone-500">💬 {t("talkLong")}</p>
            {dictation.status && dictation.status !== "no-speech" && (
              <p className="text-xs text-stone-400">mic: {dictation.status}</p>
            )}
            {/* Speech recognition hears one language at a time: one tap switches mid-sentence, keeping her words. */}
            <div role="group" aria-label={t("micLanguage")} className="flex items-center gap-2">
              <span className="text-base text-stone-500">{t("micLanguage")}:</span>
              {micLangs(d.lang).map((l) => (
                <button
                  key={l}
                  onClick={() => dictation.switchLang(SPEECH_LANG[l], answer)}
                  aria-pressed={dictation.lang === SPEECH_LANG[l]}
                  className={`min-h-11 rounded-full border-2 px-4 text-base font-semibold ${
                    dictation.lang === SPEECH_LANG[l] ? "border-orange-600 bg-orange-600 text-white" : "border-stone-300 bg-white text-stone-700"
                  }`}
                >
                  🎙️ {translate(l, "langName")}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <label htmlFor="answer" className="mt-6 block text-lg font-medium text-stone-700">
        ⌨️ {answer ? t("yourWords") : t("orType")}
      </label>
      <textarea
        id="answer"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendAnswer(answer);
          }
        }}
        rows={3}
        className="mt-2 w-full rounded-2xl border-2 border-stone-300 bg-white p-4 text-xl text-stone-900 focus:border-orange-500 focus:outline-none"
      />

      {error && (
        <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-3 text-lg text-red-800">
          <span>{error}</span>
          <button onClick={retry} className={`${btn} bg-red-700 text-white`}>↻ {t("tryAgain")}</button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={() => sendAnswer(answer)} disabled={busy || !answer.trim()} className={`${btn} flex-1 bg-stone-900 py-4 text-xl text-white`}>
          ➤ {t("send")}
        </button>
        {canSpeak && answer && (
          <button onClick={() => { setAnswer(""); dictation.start(""); }} disabled={busy} className={`${btn} border border-stone-300 bg-white`}>
            🎙️ {t("rerecord")}
          </button>
        )}
        <button onClick={() => sendAnswer(`(skip: ${turn?.asking ?? "none"})`, t("skip"))} disabled={busy || !turn} className={`${btn} border border-stone-300 bg-white`}>
          ⏭️ {t("skip")}
        </button>
      </div>

      {(step >= 5 || (turn && turn.missing.length === 0)) && (
        <button onClick={() => buildListing(d)} disabled={busy} className={`${btn} mt-6 w-full bg-emerald-600 py-4 text-xl text-white hover:bg-emerald-700`}>
          ✅ {t("finishPreview")}
        </button>
      )}

      {d.display.length > 0 && (
        <details className="mt-8 text-stone-500">
          <summary className="cursor-pointer text-base">💬 {t("yourWords")} ({d.display.length})</summary>
          <ul className="mt-2 space-y-1 text-base">
            {d.display.map((a, i) => <li key={i}>• {a}</li>)}
          </ul>
        </details>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        {!!d.prevTurns?.length && (
          <button onClick={previousQuestion} disabled={busy} className={`${btn} border border-stone-300 bg-white`}>
            ↩︎ {t("prevQuestion")}
          </button>
        )}
        <button onClick={startOver} className="text-base text-stone-400 underline">↺ {t("startOver")}</button>
      </div>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 text-lg">
      <Header showOffer={false} />
      <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>
    </div>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xl font-semibold text-stone-900">{label}</label>
      {hint && <p className="text-base text-stone-500">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-4 rounded-2xl border-2 border-stone-200 bg-white p-4 has-focus-visible:outline-3 has-focus-visible:outline-orange-500">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-7 w-7 shrink-0 accent-orange-600" />
      <span>
        <span className="block text-xl font-semibold text-stone-900">{label}</span>
        {hint && <span className="block text-base text-stone-500">{hint}</span>}
      </span>
    </label>
  );
}

/** Broad → precise area buttons, built from areas.json; works for any US city or state. */
function LocationPicker({ t, hasShop, citySaid, stateSaid, areaId, onPick }: {
  t: (k: UIKey) => string; hasShop: boolean; citySaid: string; stateSaid: string; areaId: string;
  onPick: (content: string, shown: string) => void;
}) {
  // Match what she said: her city if we know it; otherwise her state, with the city kept as "other city".
  const initial = (() => {
    if (areaId && AREAS.some((a) => a.id === areaId)) return { path: areaChain(areaId), other: "" };
    const city = citySaid ? searchAreas(citySaid, 1)[0] : undefined;
    if (city) return { path: areaChain(city.id), other: "" };
    const state = stateSaid ? searchAreas(stateSaid).find((a) => a.level === "state") : undefined;
    if (state) return { path: [state], other: citySaid };
    return { path: [] as Area[], other: citySaid };
  })();
  const [path, setPath] = useState<Area[]>(initial.path);
  const [otherCity, setOtherCity] = useState(initial.other);
  const [query, setQuery] = useState("");
  const [address, setAddress] = useState("");
  const current = path[path.length - 1];
  // Nothing matched yet: offer the metro areas as buttons so she is never stuck.
  const children = current ? AREAS.filter((a) => a.parentId === current.id) : AREAS.filter((a) => a.level === "region");
  const label = path.map((a) => a.name).join(" › ");
  const results = query.trim() ? searchAreas(query, 6) : [];
  const showOther = current?.level === "state" && otherCity;

  /** Any area chip is an answer: submit it right away. */
  function pickArea(a: Area) {
    const chain = areaChain(a.id);
    setPath(chain);
    const label = chain.map((x) => x.name).join(" › ");
    const other = a.level === "state" && otherCity ? ` (other city: ${otherCity})` : "";
    onPick(`📍 Location: ${label} (${a.level})${other} [area_id: ${a.id}]`, `📍 ${a.name}${other ? ` · ${otherCity}` : ""}`);
  }

  return (
    <div className="mt-6 rounded-3xl border-2 border-orange-200 bg-orange-50 p-4">
      <p className="text-lg font-semibold text-stone-800">📍 {t("chooseArea")}</p>
      {path.length > 0 && (
        <>
          <nav aria-label="breadcrumb" className="mt-3 flex flex-wrap gap-2">
            {path.map((a, i) => (
              <button key={a.id} onClick={() => pickArea(a)} className="min-h-11 rounded-full border border-orange-300 bg-white px-4 text-base font-medium text-orange-900">
                {i > 0 && "› "}{a.name}
              </button>
            ))}
          </nav>
          <button
            onClick={() => {
              const other = showOther ? ` (other city: ${otherCity})` : "";
              onPick(`📍 ${label}${other} [area_id: ${current.id}]`, `📍 ${label}${showOther ? ` · ${otherCity}` : ""}`);
            }}
            className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 text-xl font-bold text-white hover:bg-orange-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orange-700"
          >
            ✓ {current.name}{showOther ? ` · ${otherCity}` : ""}
          </button>
          {current.level === "state" && (
            <label className="mt-3 block text-base text-stone-700">
              {t("otherCity")}
              <input value={otherCity} onChange={(e) => setOtherCity(e.target.value)} className="input mt-1" />
            </label>
          )}
        </>
      )}
      {children.length > 0 && (
        <>
          <p className="mt-4 text-base font-medium text-stone-600">🔍 {t("moreExact")}:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {children.map((c) => (
              <button key={c.id} onClick={() => pickArea(c)} className="min-h-11 rounded-full border-2 border-stone-300 bg-white px-4 text-lg hover:border-orange-500">
                {c.name}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="mt-4">
        <label htmlFor="area-search" className="text-base font-medium text-stone-600">🔎 {t("findCity")}</label>
        <input id="area-search" value={query} onChange={(e) => setQuery(e.target.value)} className="input mt-1" />
        {results.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {results.map((a) => (
              <button key={a.id} onClick={() => pickArea(a)} className="min-h-11 rounded-full border-2 border-stone-300 bg-white px-4 text-base hover:border-orange-500">
                {a.name}{parentLabel(a) && <span className="text-stone-400"> · {parentLabel(a)}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {hasShop && current && (
        <div className="mt-4 border-t border-orange-200 pt-4">
          <label htmlFor="addr" className="text-base font-semibold text-stone-800">🏪 {t("exactAddress")}</label>
          <div className="mt-2 flex gap-2">
            <input id="addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("typeAddress")} className="input flex-1" />
            <button
              disabled={!address.trim()}
              onClick={() => onPick(`🏪 My shop address: ${address.trim()} [area_id: ${current.id}]`, `🏪 ${address.trim()}`)}
              className="min-h-11 rounded-full bg-stone-900 px-5 font-semibold text-white disabled:opacity-40"
            >
              ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Preview with provenance + privacy flags ----------
type FieldKey = "title" | "summary" | "story" | "availability";

function getText(l: Listing, field: string): string {
  const m = field.match(/^services\.(\d+)\.name$/);
  if (m) return l.services[+m[1]]?.name ?? "";
  return ((l as unknown as Record<string, unknown>)[field] as string) ?? "";
}
function setText(l: Listing, field: string, value: string): Listing {
  const m = field.match(/^services\.(\d+)\.(name|price)$/);
  if (m) return { ...l, services: l.services.map((s, i) => (i === +m[1] ? { ...s, [m[2]]: value } : s)) };
  return { ...l, [field]: value };
}
function applyRewrite(l: Listing, f: Flag): Listing {
  return setText(l, f.field, getText(l, f.field).replace(f.text, f.rewrite));
}

function Preview({ d, t, onChange, onFlag }: {
  d: Draft; t: (k: UIKey, v?: Record<string, string | number>) => string;
  onChange: (l: Listing) => void; onFlag: (f: Flag, accept: boolean) => void;
}) {
  const l = d.listing!;
  const native = d.lang !== "en";
  const chain = areaChain(l.areaId).map((a) => a.name).join(" › ");
  const flagsFor = (field: string) => (d.flags || []).filter((f) => f.field === field);
  const row = (key: FieldKey, label: string) => {
    const nf = key === "availability" ? "availability" : `${key}_native`;
    const ef = `${key}_en`;
    const value = getText(l, native ? nf : ef);
    if (!value && !(key !== "availability" && getText(l, ef))) return null;
    return (
      <Part label={label} quotes={l.provenance?.[key]} t={t}>
        {native && key !== "availability" ? (
          <>
            <Editable value={getText(l, nf)} onSave={(v) => onChange(setText(l, nf, v))} t={t} big={key === "title"} flags={flagsFor(nf)} onFlag={onFlag} />
            <div className="mt-1 text-base text-stone-500">
              🇺🇸 <Editable value={getText(l, ef)} onSave={(v) => onChange(setText(l, ef, v))} t={t} flags={flagsFor(ef)} onFlag={onFlag} />
            </div>
          </>
        ) : (
          <Editable value={getText(l, ef === "availability_en" ? "availability" : ef)} onSave={(v) => onChange(setText(l, ef === "availability_en" ? "availability" : ef, v))} t={t} big={key === "title"} flags={flagsFor(ef)} onFlag={onFlag} />
        )}
      </Part>
    );
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-stone-900">{t("previewTitle")}</h1>
      <p className="mt-2 rounded-2xl bg-sky-50 p-4 text-lg text-sky-900">✋ {t("onlyYourWords")}</p>

      {!!d.turn?.missing.length && (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-stone-300 bg-white p-4">
          <p className="font-semibold text-stone-800">➕ {t("addLater")}:</p>
          <ul className="mt-1 list-inside list-disc text-base text-stone-600">
            {d.turn.missing.map((m) => <li key={m}>{m.replace(/_/g, " ")}</li>)}
          </ul>
        </div>
      )}
      {!l.areaId && (
        <LocationPicker
          t={t}
          hasShop={false}
          citySaid={(d.turn?.collected?.city_said as string) || ""}
          stateSaid={(d.turn?.collected?.state_said as string) || ""}
          areaId=""
          onPick={(content) => {
            const id = content.match(/\[area_id: ([a-z0-9-]+)\]/)?.[1];
            const a = id && AREAS.find((x) => x.id === id);
            if (a) onChange({ ...l, areaId: a.id, locationPrecision: a.level, provenance: { ...l.provenance, areaId: [content.replace(/ \[area_id.*$/, "")] } });
          }}
        />
      )}

      <div className="mt-5 space-y-3">
        {row("title", d.name)}
        {row("summary", "")}
        <Part label={`🧾 ${t("services")}`} t={t}>
          <ul className="divide-y divide-stone-100">
            {l.services.map((s, i) => (
              <li key={i} className="py-2">
                <div className="flex items-start justify-between gap-3">
                  <Editable value={s.name} onSave={(v) => onChange(setText(l, `services.${i}.name`, v))} t={t} flags={flagsFor(`services.${i}.name`)} onFlag={onFlag} />
                  <span className="shrink-0 font-bold">
                    <Editable value={s.price === "price on request" ? t("priceOnRequest") : s.price} onSave={(v) => onChange(setText(l, `services.${i}.price`, v))} t={t} />
                  </span>
                </div>
                <Quotes quotes={s.source} t={t} />
              </li>
            ))}
          </ul>
        </Part>
        <Part label={`📍 ${t("area")}`} quotes={l.provenance?.areaId} t={t}>
          <p className="font-semibold">{l.locationPrecision === "exact" && l.address ? `🏪 ${l.address}` : chain}</p>
          <p className="text-base text-stone-600">
            {l.travelRadius > 0 ? `🚗 ${t("travel", { km: l.travelRadius })}` : `🏠 ${t("noTravel")}`}
          </p>
          <p className="text-base text-stone-600">{CATEGORIES[l.category]}</p>
        </Part>
        {row("availability", `🕒 ${t("availability")}`)}
        {l.story_en && row("story", `💛 ${t("story")}`)}
        {!!l.languages?.length && (
          <Part label={`🗣️ ${t("languages")}`} quotes={l.provenance?.languages} t={t}>
            {l.languages.join(", ")}
          </Part>
        )}
      </div>

      <section className="mt-6 rounded-3xl border-2 border-stone-200 bg-white p-5" aria-live="polite">
        <h2 className="text-xl font-bold text-stone-900">🛡️ {t("privacyTitle")}</h2>
        {d.flags === null || d.flags === undefined ? (
          <p className="mt-2 text-stone-500">{t("privacyChecking")}</p>
        ) : d.flags.length === 0 ? (
          <p className="mt-2 font-medium text-emerald-700">✓ {t("privacyOk")}</p>
        ) : (
          <>
            <p className="mt-1 text-base text-stone-600">{t("privacyHint")}</p>
            <ul className="mt-3 space-y-3">
              {d.flags.map((f, i) => (
                <li key={i} className="rounded-2xl bg-amber-50 p-4">
                  <p className="text-lg">
                    <mark className="rounded bg-amber-200 px-1 line-through decoration-amber-700">{f.text}</mark> → <b className="text-emerald-800">{f.rewrite}</b>
                  </p>
                  <p className="text-sm text-stone-500">{f.reason}</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => onFlag(f, true)} className="min-h-11 rounded-full bg-emerald-600 px-5 font-semibold text-white">✓ {t("accept")}</button>
                    <button onClick={() => onFlag(f, false)} className="min-h-11 rounded-full border border-stone-300 bg-white px-5 font-semibold">✋ {t("keepMine")}</button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function Part({ label, quotes, t, children }: { label: string; quotes?: string[]; t: (k: UIKey) => string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      {label && <div className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-400">{label}</div>}
      {children}
      <Quotes quotes={quotes} t={t} />
    </div>
  );
}

function Quotes({ quotes, t }: { quotes?: string[]; t: (k: UIKey) => string }) {
  const [open, setOpen] = useState(false);
  if (!quotes?.length) return null;
  return (
    <div className="mt-1">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="min-h-8 text-sm font-medium text-sky-700 underline-offset-2 hover:underline">
        💬 {t("fromYourWords")}
      </button>
      {open && (
        <ul className="mt-1 space-y-1 border-l-4 border-sky-200 pl-3 text-base italic text-stone-600">
          {quotes.map((q, i) => <li key={i}>“{q}”</li>)}
        </ul>
      )}
    </div>
  );
}

function Editable({ value, onSave, t, big, flags = [], onFlag }: {
  value: string; onSave: (v: string) => void; t: (k: UIKey) => string; big?: boolean;
  flags?: Flag[]; onFlag?: (f: Flag, accept: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  void onFlag;
  if (editing) {
    return (
      <span className="flex w-full gap-2">
        <input value={v} onChange={(e) => setV(e.target.value)} autoFocus className="input flex-1" aria-label={t("edit")} />
        <button onClick={() => { onSave(v); setEditing(false); }} className="min-h-11 rounded-full bg-stone-900 px-4 font-semibold text-white">✓ {t("save")}</button>
      </span>
    );
  }
  // Highlight flagged substrings from the privacy check.
  let parts: (string | React.ReactElement)[] = [value];
  for (const f of flags) {
    parts = parts.flatMap((p): (string | React.ReactElement)[] => (typeof p === "string" && p.includes(f.text) ? p.split(f.text).flatMap((s, i) => (i ? [<mark key={f.text + i} className="rounded bg-amber-200 px-0.5">{f.text}</mark>, s] : [s])) : [p]));
  }
  return (
    <button
      onClick={() => { setV(value); setEditing(true); }}
      title={t("edit")}
      className={`rounded-lg text-left hover:bg-orange-50 focus-visible:outline-3 focus-visible:outline-orange-500 ${big ? "text-2xl font-bold text-stone-900" : "text-lg text-stone-800"}`}
    >
      {parts} <span aria-hidden className="text-sm text-stone-300">✎</span>
    </button>
  );
}
