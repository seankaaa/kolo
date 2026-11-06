"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/lib/session";
import { areaById, LANG_NAMES } from "@/lib/areas";
import { catLabel, pick, useUILang } from "@/lib/i18n";
import type { Lang, Provider, ServiceItem } from "@/lib/types";

export function VerifiedBadge() {
  const { t } = useUILang();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
      ✓ {t("verified")}
    </span>
  );
}

export function servesLabel(p: Provider) {
  if (p.locationPrecision === "exact") return p.address || areaById(p.areaId)?.name;
  const name = areaById(p.areaId)?.name;
  return p.otherCity ? `${name} (${p.otherCity})` : name;
}

/** Parse "$30", "$28/hr", "from $60" -> 30 / 28 / 60; null when there is no price. */
export function priceNumber(price: string): number | null {
  const m = price.match(/\$\s*(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

export default function ProviderDrawer({ provider: p, onClose }: { provider: Provider; onClose: () => void }) {
  const { lang, t } = useUILang();
  const router = useRouter();
  const { user } = useSession();
  const [showNative, setShowNative] = useState(lang === p.language);
  const [booking, setBooking] = useState<ServiceItem | null>(null);
  const hasNative = p.language !== "en" && !!p.story_native;
  const title = pick(p, lang, p.title_en, p.title_native);

  return (
    <aside className="absolute right-0 top-0 z-[1000] flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-stone-200 bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-stone-100 p-5">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
            <span>{catLabel(lang, p.category)}</span>
            <span>·</span>
            <span>{t("speaks", { lang: LANG_NAMES[p.language] })}</span>
            {p.verified && <VerifiedBadge />}
          </div>
          <h2 className="text-xl font-semibold leading-tight text-stone-900">{title}</h2>
          {p.language !== "en" && title !== p.title_native && <p className="mt-1 text-stone-500">{p.title_native}</p>}
          {p.summary_en && <p className="mt-2 text-sm text-stone-600">{pick(p, lang, p.summary_en, p.summary_native || "")}</p>}
          <p className="mt-2 text-sm font-medium text-stone-700">{p.name}</p>
        </div>
        <button onClick={onClose} className="min-h-11 min-w-11 rounded-full text-stone-400 hover:bg-stone-100" aria-label={t("close")}>
          ✕
        </button>
      </div>

      <div className="space-y-5 p-5">
        <div className="rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-900">
          📍 {p.locationPrecision === "exact" ? t("shopAt") : t("serves")} <b>{servesLabel(p)}</b>
          {p.travelRadius > 0 && <span className="text-orange-700"> · {t("travelsUpTo", { km: p.travelRadius })}</span>}
        </div>

        {p.story_en && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-800">{t("story")}</h3>
              {hasNative && (
                <button onClick={() => setShowNative(!showNative)} className="min-h-8 text-xs font-medium text-orange-700 hover:underline">
                  {showNative ? t("readTranslated") : t("readHerWords")}
                </button>
              )}
            </div>
            <p className="text-sm leading-relaxed text-stone-600">{showNative && hasNative ? p.story_native : p.story_en}</p>
          </div>
        )}

        {p.availability && <p className="text-sm text-stone-600">🕒 {p.availability}</p>}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-stone-800">{t("services")}</h3>
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
            {p.services.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="text-sm text-stone-800">{s.name}</div>
                  <div className="text-sm font-semibold text-stone-900">{s.price === "price on request" ? t("priceOnRequest") : s.price}</div>
                </div>
                <button
                  // Ordering requires (demo) login; come back to this same listing afterwards.
                  onClick={() => (user ? setBooking(s) : router.push(`/login?next=${encodeURIComponent(`/explore?open=${p.id}`)}`))}
                  className="min-h-11 shrink-0 rounded-full bg-stone-900 px-4 text-sm font-medium text-white hover:bg-stone-700"
                >
                  {s.kind === "product" ? t("order") : t("book")}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {booking && <BookingForm key={booking.name} provider={p} initial={booking} onCancel={() => setBooking(null)} />}
      </div>
    </aside>
  );
}

function BookingForm({ provider, initial, onCancel }: { provider: Provider; initial: ServiceItem; onCancel: () => void }) {
  const { lang, t } = useUILang();
  const { user } = useSession();
  const [itemName, setItemName] = useState(initial.name);
  const item = provider.services.find((s) => s.name === itemName) || initial;
  const [qty, setQty] = useState(1);
  const [when, setWhen] = useState("");
  const [areaText, setAreaText] = useState("");
  const [details, setDetails] = useState("");
  const [name, setName] = useState(user?.name ?? "");
  const [custLang, setCustLang] = useState<Lang>(user?.language ?? lang);
  const [contact, setContact] = useState(user?.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentId, setSentId] = useState<string | null>(null);

  const unit = priceNumber(item.price);
  const total = unit !== null ? unit * (item.kind === "product" ? qty : 1) : null;
  // Advance notice: at least 24h so she can plan (cakes, catering, cleaning slots).
  const tooSoon = !!when && new Date(when).getTime() < Date.now() + 24 * 3600 * 1000;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (tooSoon) return setError(t("dateTooSoon"));
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: provider.id,
          customerUserId: user?.id,
          customerName: name,
          customerLanguage: custLang,
          contact,
          item: `${item.name} (${item.price})`,
          quantity: item.kind === "product" ? qty : 1,
          when,
          areaText,
          details,
        }),
      });
      const order = await res.json();
      // Notes become the first chat message so they get translated for her.
      if (details.trim()) {
        await fetch(`/api/orders/${order.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: "customer", text: details.trim() }),
        });
      }
      setSentId(order.id);
    } catch {
      setError(t("errNetwork"));
    } finally {
      setBusy(false);
    }
  }

  if (sentId) {
    return (
      <div role="status" className="space-y-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 text-center">
        <p className="text-lg font-semibold text-emerald-900">✅ {t("requestSent", { name: provider.name.replace(/\.$/, "") })}</p>
        <Link href="/me#orders" className="inline-flex min-h-11 items-center rounded-full bg-emerald-700 px-5 font-semibold text-white">
          💬 {t("openOrder")}
        </Link>
      </div>
    );
  }

  const field = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm min-h-11";

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border-2 border-orange-200 bg-orange-50/50 p-4">
      <h3 className="font-semibold text-stone-900">{item.kind === "product" ? t("order") : t("book")} · {provider.name}</h3>
      <L label={t("chooseItem")}>
        <select value={itemName} onChange={(e) => setItemName(e.target.value)} className={field}>
          {provider.services.map((s) => (
            <option key={s.name} value={s.name}>{s.name} — {s.price}</option>
          ))}
        </select>
      </L>
      {item.kind === "product" && (
        <L label={t("quantity")}>
          <input type="number" min={1} max={99} value={qty} onChange={(e) => setQty(Math.max(1, +e.target.value || 1))} className={field} />
        </L>
      )}
      <L label={t("dateTime")}>
        <input type="datetime-local" required value={when} onChange={(e) => { setWhen(e.target.value); setError(""); }} className={field} />
      </L>
      {tooSoon && <p className="text-xs text-amber-800">⏰ {t("dateTooSoon")}</p>}
      <L label={t("generalArea")}>
        <input value={areaText} onChange={(e) => setAreaText(e.target.value)} className={field} />
      </L>
      <L label={t("notes")}>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} placeholder={item.kind === "product" ? t("detailsProduct") : t("detailsService")} className={field} />
      </L>
      <div className="grid grid-cols-2 gap-2">
        <L label={t("yourFirstName")}>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </L>
        <L label={t("yourLanguage")}>
          <select value={custLang} onChange={(e) => setCustLang(e.target.value as Lang)} className={field}>
            {Object.entries(LANG_NAMES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </L>
      </div>
      <L label={t("yourContact")}>
        <input required value={contact} onChange={(e) => setContact(e.target.value)} className={field} />
      </L>
      {total !== null && (
        <div className="rounded-lg bg-white px-3 py-2 text-sm">
          <div className="flex justify-between font-semibold text-stone-900"><span>{t("estTotal")}</span><span>${total}</span></div>
          <div className="text-xs text-stone-500">{t("paidDirectly")}</div>
        </div>
      )}
      <p className="text-xs text-stone-500">🔒 {t("addressAfterAccept")}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button disabled={busy || tooSoon} className="min-h-11 flex-1 rounded-full bg-orange-600 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
          {busy ? t("sending") : t("sendRequest")}
        </button>
        <button type="button" onClick={onCancel} className="min-h-11 rounded-full px-4 text-sm text-stone-600 hover:bg-stone-100">
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-stone-600">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
