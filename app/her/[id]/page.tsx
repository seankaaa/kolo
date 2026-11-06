"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import OrderChat, { StatusPill } from "@/components/OrderChat";
import type { Lang, Order, Provider } from "@/lib/types";

const INBOX_T: Record<Lang, Record<string, string>> = {
  uk: { title: "Мої замовлення", none: "Замовлень поки немає. Нові з’являться тут автоматично.", pick: "Оберіть замовлення зліва.", from: "від" },
  es: { title: "Mis pedidos", none: "Aún no hay pedidos. Los nuevos aparecerán aquí automáticamente.", pick: "Elige un pedido a la izquierda.", from: "de" },
  ru: { title: "Мои заказы", none: "Заказов пока нет. Новые появятся здесь автоматически.", pick: "Выберите заказ слева.", from: "от" },
  en: { title: "My orders", none: "No orders yet. New ones will appear here automatically.", pick: "Pick an order on the left.", from: "from" },
};

export default function Inbox() {
  const { id } = useParams<{ id: string }>();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/providers/${id}`).then((r) => r.json()).then((p) => p.id && setProvider(p));
    const load = () => fetch(`/api/orders?providerId=${id}`).then((r) => r.json()).then(setOrders);
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [id]);

  const t = INBOX_T[provider?.language ?? "en"];
  const current = selected ?? orders[0]?.id ?? null;

  return (
    <div className="flex h-screen flex-col bg-stone-50">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-3">
        <Link href="/" className="text-2xl font-bold tracking-tight text-stone-900">
          Kolo <span className="text-orange-600">◯</span>
        </Link>
        <span className="text-sm font-medium text-stone-700">
          {provider?.name} {provider?.verified && <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">✓</span>}
        </span>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-stone-200 bg-white">
          <h1 className="px-4 pb-2 pt-4 text-lg font-semibold text-stone-900">{t.title}</h1>
          {orders.length === 0 && <p className="px-4 text-sm text-stone-400">{t.none}</p>}
          <ul className="divide-y divide-stone-100">
            {orders.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => setSelected(o.id)}
                  className={`w-full px-4 py-3 text-left ${current === o.id ? "bg-orange-50" : "hover:bg-stone-50"}`}
                >
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
        <main className="min-w-0 flex-1 bg-white">
          {current ? <OrderChat key={current} orderId={current} role="provider" /> : <div className="grid h-full place-items-center text-stone-400">{t.pick}</div>}
        </main>
      </div>
    </div>
  );
}
