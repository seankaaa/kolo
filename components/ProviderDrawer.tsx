"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { areaById, CATEGORIES, LANG_NAMES } from "@/lib/areas";
import type { Lang, Provider, ServiceItem } from "@/lib/types";

export function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
      ✓ Verified
    </span>
  );
}

export function servesLabel(p: Provider) {
  if (p.locationPrecision === "exact") return p.address || areaById(p.areaId)?.name;
  return areaById(p.areaId)?.name;
}

export default function ProviderDrawer({ provider: p, onClose }: { provider: Provider; onClose: () => void }) {
  const [native, setNative] = useState(false);
  const [booking, setBooking] = useState<ServiceItem | null>(null);
  const hasNative = p.language !== "en";

  return (
    <aside className="absolute right-0 top-0 z-[1000] flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-stone-200 bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-stone-100 p-5">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
            <span>{CATEGORIES[p.category] || p.category}</span>
            <span>·</span>
            <span>Speaks {LANG_NAMES[p.language]}</span>
            {p.verified && <VerifiedBadge />}
          </div>
          <h2 className="text-xl font-semibold leading-tight text-stone-900">{p.title_en}</h2>
          {hasNative && <p className="mt-1 text-stone-500">{p.title_native}</p>}
          {p.summary_en && <p className="mt-2 text-sm text-stone-600">{p.summary_en}</p>}
          <p className="mt-2 text-sm font-medium text-stone-700">{p.name}</p>
        </div>
        <button onClick={onClose} className="rounded-full p-2 text-stone-400 hover:bg-stone-100" aria-label="Close">
          ✕
        </button>
      </div>

      <div className="space-y-5 p-5">
        <div className="rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-900">
          📍 {p.locationPrecision === "exact" ? "Shop at" : "Serves"} <b>{servesLabel(p)}</b>
          {p.travelRadius > 0 && <span className="text-orange-700"> · travels/delivers up to {p.travelRadius} km</span>}
        </div>

        {p.story_en && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-800">Her story</h3>
              {hasNative && (
                <button onClick={() => setNative(!native)} className="text-xs font-medium text-orange-700 hover:underline">
                  {native ? "Read in English" : "Read in her words"}
                </button>
              )}
            </div>
            <p className="text-sm leading-relaxed text-stone-600">{native ? p.story_native : p.story_en}</p>
          </div>
        )}

        {p.availability && <p className="text-sm text-stone-600">🕒 {p.availability}</p>}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-stone-800">Services & prices</h3>
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
            {p.services.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="text-sm text-stone-800">{s.name}</div>
                  <div className="text-sm font-semibold text-stone-900">{s.price}</div>
                </div>
                <button
                  onClick={() => setBooking(s)}
                  className="shrink-0 rounded-full bg-stone-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-stone-700"
                >
                  {s.kind === "product" ? "Order" : "Book"}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {booking && <BookingForm provider={p} item={booking} onCancel={() => setBooking(null)} />}
      </div>
    </aside>
  );
}

function BookingForm({ provider, item, onCancel }: { provider: Provider; item: ServiceItem; onCancel: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [lang, setLang] = useState<Lang>("en");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: provider.id,
        customerName: name,
        customerLanguage: lang,
        item: `${item.name} (${item.price})`,
        details,
      }),
    });
    const order = await res.json();
    // Details become the first chat message so they get translated for her.
    if (details.trim()) {
      await fetch(`/api/orders/${order.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: "customer", text: details.trim() }),
      });
    }
    router.push(`/order/${order.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border-2 border-orange-200 bg-orange-50/50 p-4">
      <h3 className="font-semibold text-stone-900">
        {item.kind === "product" ? "Order" : "Book"}: {item.name}
      </h3>
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your first name"
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
      />
      <label className="block text-xs text-stone-600">
        Your language
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
          className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        >
          {Object.entries(LANG_NAMES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </label>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder={item.kind === "product" ? "When do you need it? Pickup or delivery?" : "Preferred date and time, any details"}
        rows={3}
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
      />
      <p className="text-xs text-stone-500">Demo only: no payment is taken. You can chat with {provider.name} in your language after sending.</p>
      <div className="flex gap-2">
        <button disabled={busy} className="flex-1 rounded-full bg-orange-600 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
          {busy ? "Sending…" : "Send request"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-stone-600 hover:bg-stone-100">
          Cancel
        </button>
      </div>
    </form>
  );
}
