"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import OrderChat, { StatusPill } from "@/components/OrderChat";
import { servesLabel } from "@/components/ProviderDrawer";
import { CATEGORIES, LANG_NAMES } from "@/lib/areas";
import { load, save } from "@/lib/i18n";
import type { Lang, Order, Provider } from "@/lib/types";

const INBOX_T: Record<Lang, Record<string, string>> = {
  uk: { title: "Мої замовлення", none: "Замовлень поки немає. Нові з’являться тут автоматично.", pick: "Оберіть замовлення зліва.", listing: "Моє оголошення", onMap: "Подивитися на карті", finish: "Завершити оголошення", draft: "Оголошення ще не опубліковане.", map: "← Карта" },
  es: { title: "Mis pedidos", none: "Aún no hay pedidos. Los nuevos aparecerán aquí automáticamente.", pick: "Elige un pedido a la izquierda.", listing: "Mi anuncio", onMap: "Ver en el mapa", finish: "Terminar mi anuncio", draft: "Tu anuncio todavía no está publicado.", map: "← Mapa" },
  ru: { title: "Мои заказы", none: "Заказов пока нет. Новые появятся здесь автоматически.", pick: "Выберите заказ слева.", listing: "Моё объявление", onMap: "Посмотреть на карте", finish: "Завершить объявление", draft: "Объявление ещё не опубликовано.", map: "← Карта" },
  en: { title: "My orders", none: "No orders yet. New ones will appear here automatically.", pick: "Pick an order on the left.", listing: "My listing", onMap: "See it on the map", finish: "Finish my listing", draft: "Your listing isn't published yet.", map: "← Map" },
};

// Demo shortcuts so the provider side is always one click away.
const SAMPLES = [
  { id: "oksana", label: "Oksana K. · Українська · manicure" },
  { id: "lupita", label: "Lupita H. · Español · tamales" },
  { id: "us-halyna", label: "Halyna D. · Українська · Brooklyn bakery" },
  { id: "tatiana", label: "Tatiana M. · Русский · nanny" },
];

export default function Inbox() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [missing, setMissing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/providers/${id}`).then(async (r) => {
      if (!r.ok) {
        setMissing(true);
        // Stale id from a reset demo: forget it so the header offers sign-up again.
        if (load<string | null>("kolo.providerId", null) === id) save("kolo.providerId", null);
        return;
      }
      setProvider(await r.json());
    });
    const loadOrders = () => fetch(`/api/orders?providerId=${id}`).then((r) => r.json()).then(setOrders);
    loadOrders();
    const t = setInterval(loadOrders, 2000);
    return () => clearInterval(t);
  }, [id]);

  const t = INBOX_T[provider?.language ?? "en"];
  const current = selected ?? orders[0]?.id ?? null;

  if (missing) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Top />
        <main className="mx-auto max-w-lg px-5 py-12">
          <h1 className="text-2xl font-bold text-stone-900">We couldn&apos;t find this listing</h1>
          <p className="mt-2 text-stone-600">The demo data may have been reset. Create a new listing, or open a sample provider&apos;s inbox.</p>
          <Link href="/join" className="mt-6 flex min-h-12 items-center justify-center rounded-full bg-orange-600 font-semibold text-white">✋ Offer your services →</Link>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-stone-400">Open as a sample provider</h2>
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

  return (
    <div className="flex h-screen flex-col bg-stone-50">
      <Top label={t.map}>
        <span className="text-sm font-medium text-stone-700">
          {provider?.name} {provider?.verified && <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">✓</span>}
        </span>
      </Top>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="max-h-[45vh] shrink-0 overflow-y-auto border-b border-stone-200 bg-white md:max-h-none md:w-80 md:border-b-0 md:border-r">
          {provider && (
            <section className="border-b border-stone-100 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">{t.listing}</h2>
              {provider.status === "draft" ? (
                <>
                  <p className="mt-1 text-sm text-stone-600">{t.draft}</p>
                  <Link href="/join" className="mt-2 inline-flex min-h-11 items-center rounded-full bg-orange-600 px-4 text-sm font-semibold text-white">✍️ {t.finish}</Link>
                </>
              ) : (
                <>
                  <p className="mt-1 font-semibold text-stone-900">{provider.title_native || provider.title_en}</p>
                  <p className="text-xs text-stone-500">
                    {CATEGORIES[provider.category]} · {LANG_NAMES[provider.language]} · 📍 {servesLabel(provider)}
                  </p>
                  <ul className="mt-2 space-y-0.5 text-sm text-stone-700">
                    {provider.services.map((s) => (
                      <li key={s.name} className="flex justify-between gap-2"><span>{s.name}</span><b>{s.price}</b></li>
                    ))}
                  </ul>
                  <Link href={`/?live=${provider.id}`} className="mt-3 inline-flex min-h-11 items-center rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-800 hover:bg-stone-50">
                    🗺️ {t.onMap}
                  </Link>
                </>
              )}
            </section>
          )}
          <h1 className="px-4 pb-2 pt-4 text-lg font-semibold text-stone-900">{t.title}</h1>
          {orders.length === 0 && <p className="px-4 pb-4 text-sm text-stone-400">{t.none}</p>}
          <ul className="divide-y divide-stone-100">
            {orders.map((o) => (
              <li key={o.id}>
                <button onClick={() => setSelected(o.id)} className={`w-full px-4 py-3 text-left ${current === o.id ? "bg-orange-50" : "hover:bg-stone-50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-stone-900">{o.customerName}</span>
                    {provider && <StatusPill status={o.status} lang={provider.language} />}
                  </div>
                  <div className="truncate text-xs text-stone-500">{o.item}</div>
                  <div className="text-xs text-stone-400">💬 {o.messages.length}</div>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <main className="min-h-0 min-w-0 flex-1 bg-white">
          {current ? <OrderChat key={current} orderId={current} role="provider" /> : <div className="grid h-full place-items-center text-stone-400">{t.pick}</div>}
        </main>
      </div>
    </div>
  );
}

function Top({ label = "← Map", children }: { label?: string; children?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-5 py-3">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-2xl font-bold tracking-tight text-stone-900">
          Kolo <span className="text-orange-600">◯</span>
        </Link>
        <Link href="/" className="text-sm text-stone-500 hover:text-stone-800">{label}</Link>
      </div>
      {children}
    </header>
  );
}
