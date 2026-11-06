"use client";

import { useEffect, useRef, useState } from "react";
import { areaById, LANG_NAMES, SPEECH_LANG } from "@/lib/areas";
import { speak, speechSupported, useSpeech } from "./useSpeech";
import type { Lang, Order, Provider } from "@/lib/types";

export const CHAT_T: Record<Lang, Record<string, string>> = {
  uk: { serves: "Обслуговує", original: "оригінал", placeholder: "Повідомлення…", send: "Надіслати", new: "Новий", accepted: "Прийнято", declined: "Відхилено", done: "Виконано", accept: "Прийняти", decline: "Відхилити", empty: "Повідомлень ще немає.", addressHint: "Свою точну адресу ви можете надіслати тут, у чаті, коли будете готові.", translating: "перекладаємо…" },
  es: { serves: "Atiende", original: "original", placeholder: "Mensaje…", send: "Enviar", new: "Nuevo", accepted: "Aceptado", declined: "Rechazado", done: "Completado", accept: "Aceptar", decline: "Rechazar", empty: "Todavía no hay mensajes.", addressHint: "Puedes compartir tu dirección exacta aquí en el chat cuando quieras.", translating: "traduciendo…" },
  ru: { serves: "Обслуживает", original: "оригинал", placeholder: "Сообщение…", send: "Отправить", new: "Новый", accepted: "Принят", declined: "Отклонён", done: "Выполнен", accept: "Принять", decline: "Отклонить", empty: "Сообщений пока нет.", addressHint: "Свой точный адрес вы можете отправить здесь, в чате, когда будете готовы.", translating: "переводим…" },
  en: { serves: "Serves", original: "original", placeholder: "Message…", send: "Send", new: "New", accepted: "Accepted", declined: "Declined", done: "Done", accept: "Accept", decline: "Decline", empty: "No messages yet.", addressHint: "You can share your exact address here in the chat when you're ready.", translating: "translating…" },
};

const STATUS_STYLE: Record<Order["status"], string> = {
  new: "bg-sky-100 text-sky-800",
  accepted: "bg-emerald-100 text-emerald-800",
  declined: "bg-stone-200 text-stone-600",
  done: "bg-violet-100 text-violet-800",
};

export function StatusPill({ status, lang }: { status: Order["status"]; lang: Lang }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>{CHAT_T[lang][status]}</span>;
}

export default function OrderChat({ orderId, role }: { orderId: string; role: "customer" | "provider" }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const count = order?.messages.length ?? 0;

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/orders/${orderId}`)
        .then((r) => r.json())
        .then((d) => {
          if (!alive || !d.order) return;
          setOrder(d.order);
          setProvider(d.provider);
        });
    load();
    const t = setInterval(load, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [orderId]);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [count, sending]);

  const myLang: Lang = role === "customer" ? order?.customerLanguage ?? "en" : provider?.language ?? "en";
  const t = CHAT_T[myLang];
  const { listening, start } = useSpeech(SPEECH_LANG[myLang], (text) => setInput((c) => (c ? c + " " : "") + text));

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    const res = await fetch(`/api/orders/${orderId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: role, text }),
    });
    const msg = await res.json();
    setOrder((o) => (o && msg.id ? { ...o, messages: [...o.messages, msg] } : o));
    setSending(false);
  }

  async function setStatus(status: Order["status"]) {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setOrder(await res.json());
  }

  if (!order || !provider) return <div className="grid h-full place-items-center text-stone-400">…</div>;
  const other = role === "customer" ? provider.name : order.customerName;
  const otherLang = role === "customer" ? provider.language : order.customerLanguage;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-stone-200 bg-white px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-stone-900">
              {other} <span className="text-xs font-normal text-stone-400">· {LANG_NAMES[otherLang]}</span>
            </div>
            <div className="text-xs text-stone-500">
              {order.item} · 📍 {t.serves} {areaById(provider.areaId)?.name}
            </div>
          </div>
          <StatusPill status={order.status} lang={myLang} />
        </div>
        {role === "provider" && order.status === "new" && (
          <div className="mt-3 flex gap-2">
            <button onClick={() => setStatus("accepted")} className="flex-1 rounded-full bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700">✓ {t.accept}</button>
            <button onClick={() => setStatus("declined")} className="flex-1 rounded-full border border-stone-300 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100">✕ {t.decline}</button>
          </div>
        )}
        {role === "provider" && order.status === "accepted" && <p className="mt-2 text-xs text-emerald-700">🔒 {t.addressHint}</p>}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-stone-50 p-5">
        {order.messages.length === 0 && <p className="text-center text-sm text-stone-400">{t.empty}</p>}
        {order.messages.map((m) => {
          const mine = m.from === role;
          const shown = m.lang === myLang ? m.original : m.translations[myLang] ?? m.original;
          const translated = m.lang !== myLang;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${mine ? "bg-orange-600 text-white" : "border border-stone-200 bg-white text-stone-800"}`}>
                <div className="flex items-start gap-2">
                  <span className="whitespace-pre-wrap">{shown}</span>
                  {!mine && (
                    <button onClick={() => speak(shown, SPEECH_LANG[myLang])} className="shrink-0 text-sm opacity-60 hover:opacity-100" aria-label="Listen">
                      🔊
                    </button>
                  )}
                </div>
                {translated && (
                  <div className={`mt-1 border-t pt-1 text-xs ${mine ? "border-orange-400 text-orange-100" : "border-stone-100 text-stone-400"}`}>
                    {t.original} ({LANG_NAMES[m.lang]}): {m.original}
                  </div>
                )}
                {mine && m.lang !== otherLang && m.translations[otherLang] && (
                  <div className="mt-1 border-t border-orange-400 pt-1 text-xs text-orange-100">→ {m.translations[otherLang]}</div>
                )}
              </div>
            </div>
          );
        })}
        {sending && <p className="text-right text-xs text-stone-400">{t.translating}</p>}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 border-t border-stone-200 bg-white p-3">
        {speechSupported() && (
          <button onClick={start} className={`rounded-full px-4 text-xl ${listening ? "animate-pulse bg-red-600 text-white" : "border border-stone-300"}`} aria-label="Speak">
            🎤
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t.placeholder}
          className="flex-1 rounded-full border border-stone-300 px-4 py-2.5"
        />
        <button onClick={send} disabled={sending} className="rounded-full bg-stone-900 px-5 font-semibold text-white disabled:opacity-40">
          {t.send}
        </button>
      </div>
    </div>
  );
}
