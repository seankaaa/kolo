"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { formatWhen, StatusPill } from "@/components/OrderChat";
import { load, useUILang } from "@/lib/i18n";
import type { Order } from "@/lib/types";

/** Customer "My orders": no account, just the customer id saved in this browser. */
export default function MyOrders() {
  const { lang, t } = useUILang();
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    const id = load<string | null>("kolo.customerId", null);
    if (!id) return setOrders([]);
    const get = () => fetch(`/api/orders?customerId=${encodeURIComponent(id)}`).then((r) => r.json()).then(setOrders);
    get();
    const timer = setInterval(get, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-stone-900">🧾 {t("myOrders")}</h1>
        {orders?.length === 0 && (
          <p className="mt-4 text-stone-500">
            {t("noCustomerOrders")} <Link href="/explore" className="font-semibold text-orange-700 underline">🗺️ {t("navHome")}</Link>
          </p>
        )}
        <ul className="mt-4 space-y-3">
          {orders?.map((o) => (
            <li key={o.id}>
              <Link href={`/order/${o.id}`} className="block rounded-2xl border border-stone-200 bg-white p-4 hover:border-orange-300">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-stone-900">{o.item}{o.quantity && o.quantity > 1 ? ` × ${o.quantity}` : ""}</span>
                  <StatusPill status={o.status} customer />
                </div>
                <div className="mt-1 text-sm text-stone-500">
                  {o.when && <>🗓️ {formatWhen(o.when, lang)} · </>}💬 {o.messages.length}
                </div>
                <div className="mt-2 text-sm font-semibold text-orange-700">{t("openChat")} →</div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
