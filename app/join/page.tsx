"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { areaChain, CATEGORIES, LANG_NAMES, SPEECH_LANG } from "@/lib/areas";
import { speechSupported, useSpeech } from "@/components/useSpeech";
import type { Lang, Provider } from "@/lib/types";

type Msg = { role: "user" | "assistant"; content: string };
type Listing = Omit<Provider, "id" | "language" | "verified">;
type Flag = { field: string; text: string; reason: string; rewrite: string };

const T: Record<Lang, Record<string, string>> = {
  uk: {
    auth: "Я маю дозвіл на роботу в США.",
    authNote: "Ми більше нічого не питаємо і не зберігаємо про ваш статус.",
    start: "Почати",
    placeholder: "Напишіть або натисніть 🎤 і говоріть…",
    send: "Надіслати",
    preview: "Ваше оголошення",
    checking: "Перевіряємо приватність…",
    privacyOk: "Перевірка приватності: усе гаразд ✓",
    privacyFlags: "Перевірка приватності: радимо змінити",
    accept: "Прийняти зміну",
    publish: "Опублікувати",
    edit: "Продовжити розмову",
    published: "Опубліковано! Ваше оголошення вже на карті.",
    getVerified: "Отримати позначку «Перевірено»",
    verifyId: "Підтвердити мій документ",
    verifyPartner: "Перевірено партнерською організацією",
    verified: "Перевірено ✓",
    inbox: "Відкрити мої замовлення",
    map: "Подивитися на карті",
  },
  es: {
    auth: "Estoy autorizada para trabajar en EE. UU.",
    authNote: "No preguntamos ni guardamos nada más sobre tu estatus.",
    start: "Empezar",
    placeholder: "Escribe o toca 🎤 y habla…",
    send: "Enviar",
    preview: "Tu anuncio",
    checking: "Revisando privacidad…",
    privacyOk: "Revisión de privacidad: todo bien ✓",
    privacyFlags: "Revisión de privacidad: te sugerimos cambiar",
    accept: "Aceptar cambio",
    publish: "Publicar",
    edit: "Seguir conversando",
    published: "¡Publicado! Tu anuncio ya está en el mapa.",
    getVerified: "Obtener insignia de verificación",
    verifyId: "Verificar mi identificación",
    verifyPartner: "Verificada por organización aliada",
    verified: "Verificada ✓",
    inbox: "Abrir mis pedidos",
    map: "Ver en el mapa",
  },
  ru: {
    auth: "У меня есть разрешение на работу в США.",
    authNote: "Мы больше ничего не спрашиваем и не храним о вашем статусе.",
    start: "Начать",
    placeholder: "Напишите или нажмите 🎤 и говорите…",
    send: "Отправить",
    preview: "Ваше объявление",
    checking: "Проверяем приватность…",
    privacyOk: "Проверка приватности: всё в порядке ✓",
    privacyFlags: "Проверка приватности: советуем изменить",
    accept: "Принять правку",
    publish: "Опубликовать",
    edit: "Продолжить разговор",
    published: "Опубликовано! Ваше объявление уже на карте.",
    getVerified: "Получить отметку «Проверено»",
    verifyId: "Подтвердить мой документ",
    verifyPartner: "Проверено партнёрской организацией",
    verified: "Проверено ✓",
    inbox: "Открыть мои заказы",
    map: "Посмотреть на карте",
  },
  en: {
    auth: "I'm authorized to work in the US.",
    authNote: "We don't ask or store anything else about your status.",
    start: "Start",
    placeholder: "Type, or tap 🎤 and talk…",
    send: "Send",
    preview: "Your listing",
    checking: "Running privacy check…",
    privacyOk: "Privacy check: all clear ✓",
    privacyFlags: "Privacy check: we suggest changing",
    accept: "Accept rewrite",
    publish: "Publish",
    edit: "Keep talking",
    published: "Published! Your listing is on the map.",
    getVerified: "Get a Verified badge",
    verifyId: "Verify my ID",
    verifyPartner: "Verified by partner organization",
    verified: "Verified ✓",
    inbox: "Open my orders",
    map: "See it on the map",
  },
};

const ENTRY: { lang: Lang; label: string }[] = [
  { lang: "uk", label: "Українською" },
  { lang: "es", label: "En español" },
  { lang: "ru", label: "По-русски" },
  { lang: "en", label: "English" },
];

function getField(l: Listing, field: string): string {
  const m = field.match(/^services\.(\d+)\.name$/);
  if (m) return l.services[+m[1]]?.name ?? "";
  return ((l as unknown as Record<string, unknown>)[field] as string) ?? "";
}
function setField(l: Listing, field: string, value: string): Listing {
  const m = field.match(/^services\.(\d+)\.name$/);
  if (m) return { ...l, services: l.services.map((s, i) => (i === +m[1] ? { ...s, name: value } : s)) };
  return { ...l, [field]: value };
}

export default function Join() {
  const [lang, setLang] = useState<Lang | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listing, setListing] = useState<Listing | null>(null);
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [published, setPublished] = useState<Provider | null>(null);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const t = T[lang || "en"];

  const { listening, start: startMic } = useSpeech(SPEECH_LANG[lang || "en"], (text) =>
    setInput((cur) => (cur ? cur + " " : "") + text)
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, listing, flags]);

  async function ask(history: Msg[]) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, messages: history }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      // The first call uses a synthetic kickoff; keep the visible history clean.
      const base = history.length ? history : [{ role: "user" as const, content: "(She just opened the page. Greet her and ask the first question.)" }];
      setMessages([...base, { role: "assistant", content: data.reply }]);
      if (data.listing) {
        setListing(data.listing);
        runPrivacy(data.listing);
      }
    } catch (e) {
      setError((e as Error).message.slice(0, 200));
    } finally {
      setBusy(false);
    }
  }

  async function runPrivacy(l: Listing) {
    setFlags(null);
    const res = await fetch("/api/privacy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(l),
    });
    const data = await res.json();
    setFlags(data.flags || []);
  }

  function send() {
    if (!input.trim() || busy) return;
    const next = [...messages, { role: "user" as const, content: input.trim() }];
    setMessages(next);
    setInput("");
    setListing(null);
    setFlags(null);
    ask(next);
  }

  function acceptFlag(f: Flag) {
    if (!listing) return;
    setListing(setField(listing, f.field, getField(listing, f.field).replace(f.text, f.rewrite)));
    setFlags((fs) => fs?.filter((x) => x !== f) || []);
  }

  async function publish() {
    if (!listing || !lang) return;
    setBusy(true);
    const res = await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...listing, language: lang }),
    });
    setPublished(await res.json());
    setBusy(false);
  }

  async function verify() {
    if (!published) return;
    const res = await fetch(`/api/providers/${published.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: true }),
    });
    setPublished(await res.json());
  }

  // ---- Step 1: language + work authorization ----
  if (!started) {
    return (
      <Shell>
        <h1 className="text-3xl font-bold text-stone-900">Join Kolo</h1>
        <p className="mt-2 text-stone-600">Talk to us in your language. We&apos;ll write your listing for you.</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {ENTRY.map((e) => (
            <button
              key={e.lang}
              onClick={() => setLang(e.lang)}
              className={`rounded-2xl border-2 px-4 py-5 text-lg font-semibold ${
                lang === e.lang ? "border-orange-600 bg-orange-50 text-orange-800" : "border-stone-200 bg-white text-stone-800 hover:border-stone-300"
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
        {lang && (
          <div className="mt-6 space-y-4">
            <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-4">
              <input type="checkbox" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} className="mt-1 h-5 w-5 accent-orange-600" />
              <span>
                <span className="font-medium text-stone-900">{t.auth}</span>
                <span className="mt-1 block text-sm text-stone-500">{t.authNote}</span>
              </span>
            </label>
            <button
              disabled={!authorized}
              onClick={() => {
                setStarted(true);
                ask([]);
              }}
              className="w-full rounded-full bg-orange-600 py-3 text-lg font-semibold text-white hover:bg-orange-700 disabled:opacity-40"
            >
              {t.start} →
            </button>
          </div>
        )}
      </Shell>
    );
  }

  // ---- After publish: verification ----
  if (published) {
    return (
      <Shell>
        <div className="rounded-2xl bg-emerald-50 p-6 text-center">
          <div className="text-4xl">🎉</div>
          <p className="mt-2 text-lg font-semibold text-emerald-900">{t.published}</p>
        </div>
        <PreviewCard listing={published} lang={lang!} verified={published.verified} />
        <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-5">
          {published.verified ? (
            <p className="text-center text-lg font-semibold text-emerald-700">{t.verified}</p>
          ) : (
            <>
              <h2 className="mb-3 font-semibold text-stone-900">{t.getVerified}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <button onClick={verify} className="rounded-xl border border-stone-300 px-4 py-3 text-sm font-medium hover:bg-stone-50">🪪 {t.verifyId}</button>
                <button onClick={verify} className="rounded-xl border border-stone-300 px-4 py-3 text-sm font-medium hover:bg-stone-50">🤝 {t.verifyPartner}</button>
              </div>
              <p className="mt-2 text-xs text-stone-400">Demo: no real verification is performed.</p>
            </>
          )}
        </div>
        <div className="mt-4 flex gap-3">
          <Link href={`/her/${published.id}`} className="flex-1 rounded-full bg-stone-900 py-3 text-center font-semibold text-white">{t.inbox}</Link>
          <Link href="/" className="flex-1 rounded-full border border-stone-300 py-3 text-center font-semibold text-stone-800">{t.map}</Link>
        </div>
      </Shell>
    );
  }

  // ---- Conversational intake ----
  const visible = messages.filter((m, i) => !(i === 0 && m.role === "user" && m.content.startsWith("(")));
  return (
    <Shell>
      <div className="space-y-3">
        {visible.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 ${
                m.role === "user" ? "bg-orange-600 text-white" : "border border-stone-200 bg-white text-stone-800"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && <div className="text-sm text-stone-400">…</div>}
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      </div>

      {listing && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{t.preview}</h2>
          <PreviewCard listing={listing} lang={lang!} flags={flags || []} />
          <div className="mt-3 rounded-xl border border-stone-200 bg-white p-4">
            {flags === null ? (
              <p className="text-sm text-stone-500">{t.checking}</p>
            ) : flags.length === 0 ? (
              <p className="text-sm font-medium text-emerald-700">{t.privacyOk}</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-amber-800">⚠️ {t.privacyFlags}</p>
                {flags.map((f, i) => (
                  <div key={i} className="rounded-lg bg-amber-50 p-3 text-sm">
                    <div>
                      <mark className="bg-amber-200 px-1">{f.text}</mark> → <span className="font-medium text-emerald-800">{f.rewrite}</span>
                    </div>
                    <div className="mt-1 text-xs text-stone-500">{f.reason}</div>
                    <button onClick={() => acceptFlag(f)} className="mt-2 rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700">
                      {t.accept}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={publish}
            disabled={busy || flags === null}
            className="mt-4 w-full rounded-full bg-orange-600 py-3 text-lg font-semibold text-white hover:bg-orange-700 disabled:opacity-40"
          >
            {t.publish}
          </button>
        </div>
      )}
      <div ref={endRef} />

      <div className="sticky bottom-0 mt-6 flex gap-2 bg-stone-50 py-3">
        {speechSupported() && (
          <button
            onClick={startMic}
            className={`rounded-full px-4 text-xl ${listening ? "animate-pulse bg-red-600 text-white" : "border border-stone-300 bg-white"}`}
            aria-label="Speak"
          >
            🎤
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={listing ? t.edit + "…" : t.placeholder}
          className="flex-1 rounded-full border border-stone-300 bg-white px-4 py-3"
        />
        <button onClick={send} disabled={busy} className="rounded-full bg-stone-900 px-5 font-semibold text-white disabled:opacity-40">
          {t.send}
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white px-5 py-3">
        <Link href="/" className="text-2xl font-bold tracking-tight text-stone-900">
          Kolo <span className="text-orange-600">◯</span>
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-8">{children}</main>
    </div>
  );
}

function Highlight({ text, flags, field }: { text: string; flags: Flag[]; field: string }) {
  const f = flags.find((x) => x.field === field && text.includes(x.text));
  if (!f) return <>{text}</>;
  const [a, ...rest] = text.split(f.text);
  return (
    <>
      {a}
      <mark className="rounded bg-amber-200 px-0.5">{f.text}</mark>
      <Highlight text={rest.join(f.text)} flags={flags.filter((x) => x !== f)} field={field} />
    </>
  );
}

function PreviewCard({ listing: l, lang, flags = [], verified }: { listing: Listing; lang: Lang; flags?: Flag[]; verified?: boolean }) {
  const area = areaChain(l.areaId).map((a) => a.name).join(" › ");
  const cols: { label: string; title: string; story: string; titleF: string; storyF: string }[] = [
    { label: "English", title: l.title_en, story: l.story_en, titleF: "title_en", storyF: "story_en" },
  ];
  if (lang !== "en") cols.push({ label: LANG_NAMES[lang], title: l.title_native, story: l.story_native, titleF: "title_native", storyF: "story_native" });
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="grid divide-y divide-stone-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {cols.map((c) => (
          <div key={c.label} className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">{c.label}</div>
            <h3 className="mt-1 text-lg font-semibold text-stone-900"><Highlight text={c.title} flags={flags} field={c.titleF} /></h3>
            {c.story && <p className="mt-2 text-sm leading-relaxed text-stone-600"><Highlight text={c.story} flags={flags} field={c.storyF} /></p>}
          </div>
        ))}
      </div>
      <div className="space-y-2 border-t border-stone-100 bg-stone-50/60 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2 text-stone-600">
          <b className="text-stone-900"><Highlight text={l.name} flags={flags} field="name" /></b>
          <span>· {CATEGORIES[l.category] || l.category}</span>
          {verified && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">✓ Verified</span>}
        </div>
        <div>📍 {l.locationPrecision === "exact" ? `Shop: ${l.address}` : `Serves ${area}`}{l.travelRadius > 0 && ` · up to ${l.travelRadius} km`}</div>
        {l.availability && <div>🕒 <Highlight text={l.availability} flags={flags} field="availability" /></div>}
        <ul className="mt-2 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {l.services.map((s, i) => (
            <li key={i} className="flex justify-between px-3 py-2">
              <span><Highlight text={s.name} flags={flags} field={`services.${i}.name`} /></span>
              <b>{s.price}</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
