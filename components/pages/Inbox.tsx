"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import OrderChat, { formatWhen, StatusPill } from "@/components/OrderChat";
import { servesLabel, VerifiedBadge } from "@/components/ProviderDrawer";
import { LANG_NAMES } from "@/lib/areas";
import { catLabel, load, pick, save, useUILang } from "@/lib/i18n";
import type { Order, Provider } from "@/lib/types";

// Demo shortcuts so the provider side is always one click away.
const SAMPLES = [
  { id: "maria", label: "María T. · Español · cleaning" },
  { id: "oksana", label: "Oksana K. · Українська · manicure" },
  { id: "us-halyna", label: "Halyna D. · Українська · Brooklyn bakery" },
  { id: "tatiana", label: "Tatiana M. · Русский · nanny" },
];

type Tab = "new" | "accepted" | "done";

export default function Inbox() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [missing, setMissing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<Tab>("new");
  const [chatId, setChatId] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  // Her profile opens in her language unless this tab already picked one.
  const { lang, t } = useUILang(provider?.language ?? null);

  useEffect(() => {
    setLive(new URLSearchParams(window.location.search).has("live"));
    fetch(`/api/providers/${id}`).then(async (r) => {
      if (!r.ok) {
        setMissing(true);
        if (load<string | null>("kolo.providerId", null) === id) save("kolo.providerId", null);
        return;
      }
      setProvider(await r.json());
    });
    const loadOrders = () => fetch(`/api/orders?providerId=${id}`).then((r) => r.json()).then(setOrders);
    loadOrders();
    const timer = setInterval(loadOrders, 2000);
    return () => clearInterval(timer);
  }, [id]);

  async function patch(body: Record<string, unknown>) {
    const r = await fetch(`/api/providers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) setProvider(await r.json());
  }
  async function setOrderStatus(orderId: string, status: Order["status"]) {
    await fetch(`/api/orders/${orderId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setOrders((os) => os.map((o) => (o.id === orderId ? { ...o, status } : o)));
  }

  if (missing) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Header showOffer={false} />
        <main className="mx-auto max-w-lg px-5 py-12">
          <h1 className="text-2xl font-bold text-stone-900">{t("notFoundTitle")}</h1>
          <p className="mt-2 text-stone-600">{t("notFoundBody")}</p>
          <Link href="/join" className="mt-6 flex min-h-12 items-center justify-center rounded-full bg-orange-600 font-semibold text-white">✋ {t("offer")} →</Link>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-stone-400">{t("openSample")}</h2>
          <ul className="mt-2 space-y-2">
            {SAMPLES.map((s) => (
              <li key={s.id}>
                <button onClick={() => router.push(`/her/${s.id}`)} className="min-h-11 w-full rounded-xl border border-stone-200 bg-white px-4 text-left hover:bg-orange-50">
                  👩 {s.label}
                </button>
              </li>
            ))}
          </ul>
        </main>
      </div>
    );
  }

  const byTab: Record<Tab, Order[]> = {
    new: orders.filter((o) => o.status === "new"),
    accepted: orders.filter((o) => o.status === "accepted"),
    done: orders.filter((o) => o.status === "done" || o.status === "declined"),
  };
  const mapHref = provider ? `/explore?live=${provider.id}` : "/explore";

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 lg:h-screen">
      <Header showOffer={false}>
        <span className="text-sm font-medium text-stone-700">👩 {provider?.name}</span>
      </Header>

      {live && provider && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 bg-emerald-600 px-5 py-3 text-white">
          <div>
            <span className="text-lg font-bold">🎉 {t("live")}</span> <span className="opacity-90">{t("liveSub")}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {provider.verified ? (
              <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-emerald-800">✓ {t("verified")}</span>
            ) : (
              <>
                <span className="text-sm opacity-90">{t("getVerified")}:</span>
                <button onClick={() => patch({ verified: true })} className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-emerald-800">🪪 {t("verifyId")}</button>
                <button onClick={() => patch({ verified: true })} className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-emerald-800">🤝 {t("verifyPartner")}</button>
              </>
            )}
            <Link href={mapHref} className="min-h-11 rounded-full border-2 border-white px-4 py-2 text-sm font-semibold">🗺️ {t("seeMeOnMap")}</Link>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="shrink-0 overflow-y-auto border-b border-stone-200 bg-white lg:w-[26rem] lg:border-b-0 lg:border-r">
          {provider && (
            <section className="border-b border-stone-100 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">{t("myListingTitle")}</h2>
                {provider.status !== "draft" && (
                  <div role="group" className="flex overflow-hidden rounded-full border border-stone-300 text-xs font-semibold">
                    <button onClick={() => patch({ paused: false })} aria-pressed={!provider.paused} className={`min-h-9 px-3 ${!provider.paused ? "bg-emerald-600 text-white" : "bg-white text-stone-600"}`}>● {t("available")}</button>
                    <button onClick={() => patch({ paused: true })} aria-pressed={!!provider.paused} className={`min-h-9 px-3 ${provider.paused ? "bg-stone-700 text-white" : "bg-white text-stone-600"}`}>❚❚ {t("paused")}</button>
                  </div>
                )}
              </div>
              {provider.status === "draft" ? (
                <>
                  <p className="mt-1 text-sm text-stone-600">{t("notPublished")}</p>
                  <Link href="/join" className="mt-2 inline-flex min-h-11 items-center rounded-full bg-orange-600 px-4 text-sm font-semibold text-white">✍️ {t("finishListing")}</Link>
                </>
              ) : (
                <div className={`mt-2 rounded-xl border border-stone-200 p-3 ${provider.paused ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    {catLabel(lang, provider.category)} · {LANG_NAMES[provider.language]} {provider.verified && <VerifiedBadge />}
                  </div>
                  <p className="mt-1 font-semibold text-stone-900">{pick(provider, lang, provider.title_en, provider.title_native)}</p>
                  <p className="text-xs text-stone-500">📍 {t("serves")} {servesLabel(provider)}</p>
                  <ul className="mt-2 space-y-0.5 text-sm text-stone-700">
                    {provider.services.map((s) => (
                      <li key={s.name} className="flex justify-between gap-2"><span>{s.name}</span><b>{s.price === "price on request" ? t("priceOnRequest") : s.price}</b></li>
                    ))}
                  </ul>
                  {provider.paused && <p className="mt-2 text-xs text-stone-500">{t("pausedHint")}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={mapHref} className="inline-flex min-h-11 items-center rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-800 hover:bg-stone-50">
                      👀 {t("previewAsCustomer")}
                    </Link>
                  </div>
                </div>
              )}
            </section>
          )}

          <h1 className="px-4 pt-4 text-lg font-semibold text-stone-900">{t("ordersTitle")}</h1>
          <div role="tablist" className="flex gap-1 px-4 pt-2">
            {(["new", "accepted", "done"] as Tab[]).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`min-h-11 flex-1 rounded-full text-sm font-semibold ${tab === k ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700"}`}
              >
                {t(k === "new" ? "tabNew" : k === "accepted" ? "tabAccepted" : "tabDone")}
                {byTab[k].length > 0 && (
                  <span className={`ml-1.5 rounded-full px-1.5 text-xs ${k === "new" ? "bg-orange-500 text-white" : "bg-white/30"}`}>{byTab[k].length}</span>
                )}
              </button>
            ))}
          </div>
          {byTab[tab].length === 0 && <p className="px-4 py-4 text-sm text-stone-400">{t("noOrders")}</p>}
          <ul className="space-y-2 p-4">
            {byTab[tab].map((o) => (
              <li key={o.id} className={`rounded-xl border p-3 ${chatId === o.id ? "border-orange-400 bg-orange-50" : "border-stone-200 bg-white"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-stone-900">{o.customerName}</span>
                  <StatusPill status={o.status} />
                </div>
                <div className="text-sm text-stone-700">{o.item}{o.quantity && o.quantity > 1 ? ` × ${o.quantity}` : ""}</div>
                <div className="mt-1 space-y-0.5 text-xs text-stone-500">
                  {o.when && <div>🗓️ {formatWhen(o.when, lang)}</div>}
                  {o.areaText && <div>🏘️ {o.areaText}</div>}
                  <div>🗣️ {t("customerSpeaks", { lang: LANG_NAMES[o.customerLanguage] })} · 💬 {o.messages.length}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {o.status === "new" && (
                    <>
                      <button onClick={() => setOrderStatus(o.id, "accepted")} className="min-h-11 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white">✓ {t("accept")}</button>
                      <button onClick={() => setOrderStatus(o.id, "declined")} className="min-h-11 rounded-full border border-stone-300 px-4 text-sm font-semibold">✕ {t("decline")}</button>
                    </>
                  )}
                  {o.status === "accepted" && (
                    <button onClick={() => setOrderStatus(o.id, "done")} className="min-h-11 rounded-full bg-violet-600 px-4 text-sm font-semibold text-white">✔︎ {t("markDone")}</button>
                  )}
                  <button onClick={() => setChatId(o.id)} className="min-h-11 rounded-full border border-stone-300 px-4 text-sm font-semibold">💬 {t("openChat")}</button>
                </div>
              </li>
            ))}
          </ul>
        </aside>
        <main className="min-h-[60vh] min-w-0 flex-1 bg-white lg:min-h-0">
          {chatId ? (
            <OrderChat key={chatId} orderId={chatId} role="provider" />
          ) : (
            <div className="grid h-full min-h-[40vh] place-items-center text-stone-400">{t("pickOrder")}</div>
          )}
        </main>
      </div>
    </div>
  );
}
