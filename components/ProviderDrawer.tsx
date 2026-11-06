"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/lib/session";
import { areaById, LANG_NAMES } from "@/lib/areas";
import { catLabel, pick, useUILang } from "@/lib/i18n";
import type { Lang, Need, Provider, ServiceItem } from "@/lib/types";

export function VerifiedBadge() {
  const { t } = useUILang();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-pine-soft px-2 py-0.5 text-xs font-medium text-pine">
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
    <aside className="absolute right-0 top-0 z-[1000] flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-line-strong bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-line p-5">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{catLabel(lang, p.category)}</span>
            <span>·</span>
            <span>{t("speaks", { lang: LANG_NAMES[p.language] })}</span>
            {p.verified && <VerifiedBadge />}
          </div>
          <h2 className="text-xl font-semibold leading-tight text-ink">{title}</h2>
          {p.language !== "en" && title !== p.title_native && <p className="mt-1 text-muted">{p.title_native}</p>}
          {p.summary_en && <p className="mt-2 text-sm text-muted">{pick(p, lang, p.summary_en, p.summary_native || "")}</p>}
          <p className="mt-2 text-sm font-medium text-ink-2">{p.name}</p>
        </div>
        <button onClick={onClose} className="min-h-11 min-w-11 rounded-full text-faint hover:bg-sand" aria-label={t("close")}>
          ✕
        </button>
      </div>

      <div className="space-y-5 p-5">
        <div className="rounded-xl bg-sand px-4 py-3 text-sm text-pine">
          📍 {p.locationPrecision === "exact" ? t("shopAt") : t("serves")} <b>{servesLabel(p)}</b>
          {p.travelRadius > 0 && <span className="text-pine"> · {t("travelsUpTo", { km: p.travelRadius })}</span>}
        </div>

        {p.story_en && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-2">{t("story")}</h3>
              {hasNative && (
                <button onClick={() => setShowNative(!showNative)} className="min-h-8 text-xs font-medium text-pine hover:underline">
                  {showNative ? t("readTranslated") : t("readHerWords")}
                </button>
              )}
            </div>
            <p className="text-sm leading-relaxed text-muted">{showNative && hasNative ? p.story_native : p.story_en}</p>
          </div>
        )}

        {p.availability && <p className="text-sm text-muted">🕒 {p.availability}</p>}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink-2">{t("services")}</h3>
          <ul className="divide-y divide-line rounded-xl border border-line-strong">
            {p.services.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="text-sm text-ink-2">{s.name}</div>
                  <div className="text-sm font-semibold text-ink">{s.price === "price on request" ? t("priceOnRequest") : s.price}</div>
                </div>
                <button
                  // Ordering requires (demo) login; come back to this same listing afterwards.
                  onClick={() => (user ? setBooking(s) : router.push(`/login?next=${encodeURIComponent(`/explore?open=${p.id}`)}`))}
                  className="min-h-11 shrink-0 rounded-full bg-ink px-4 text-sm font-medium text-white hover:bg-ink-2"
                >
                  {s.kind === "product" ? t("order") : t("book")}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {booking && <BookingForm key={booking.name} provider={p} initial={booking} onCancel={() => setBooking(null)} />}

        {!!p.needs?.length && <HelpSection p={p} />}
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
      <div role="status" className="space-y-3 rounded-xl border-2 border-pine-soft bg-pine-soft p-4 text-center">
        <p className="text-lg font-semibold text-pine">✅ {t("requestSent", { name: provider.name.replace(/\.$/, "") })}</p>
        <Link href="/me#orders" className="inline-flex min-h-11 items-center rounded-full bg-pine px-5 font-semibold text-white">
          💬 {t("openOrder")}
        </Link>
      </div>
    );
  }

  const field = "w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-sm min-h-11";

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border-2 border-line-strong bg-sand p-4">
      <h3 className="font-semibold text-ink">{item.kind === "product" ? t("order") : t("book")} · {provider.name}</h3>
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
      {tooSoon && <p className="text-xs text-warn-ink">⏰ {t("dateTooSoon")}</p>}
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
          <div className="flex justify-between font-semibold text-ink"><span>{t("estTotal")}</span><span>${total}</span></div>
          <div className="text-xs text-muted">{t("paidDirectly")}</div>
        </div>
      )}
      <p className="text-xs text-muted">🔒 {t("addressAfterAccept")}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button disabled={busy || tooSoon} className="min-h-11 flex-1 rounded-full bg-pine text-sm font-semibold text-white hover:bg-pine-dark disabled:opacity-50">
          {busy ? t("sending") : t("sendRequest")}
        </button>
        <button type="button" onClick={onCancel} className="min-h-11 rounded-full px-4 text-sm text-muted hover:bg-sand">
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-muted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const NEED_ICON: Record<Need["type"], string> = { money: "💵", goods: "🎁", help: "🤝" };

/** "How you can help": her own words only; money goes directly to her, never through Kolo. */
function HelpSection({ p }: { p: Provider }) {
  const { lang, t } = useUILang();
  const { user } = useSession();
  const router = useRouter();
  const [showHandles, setShowHandles] = useState(false);
  const [offering, setOffering] = useState<Need | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasMoney = p.needs!.some((n) => n.type === "money");

  async function sendOffer() {
    if (!offering || !note.trim() || !user) return;
    setBusy(true);
    const r = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "support",
        providerId: p.id,
        customerUserId: user.id,
        customerName: user.name,
        customerLanguage: user.language,
        item: `${NEED_ICON[offering.type]} ${offering.label_en}`,
        details: note.trim(),
      }),
    });
    const order = await r.json();
    await fetch(`/api/orders/${order.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: "customer", text: note.trim() }),
    });
    setBusy(false);
    setSent(true);
    setOffering(null);
    setNote("");
  }

  return (
    <section className="rounded-xl border-2 border-beauty bg-beauty-tint p-4">
      <h3 className="text-sm font-semibold text-ink-2">💛 {t("howHelp")}</h3>
      <ul className="mt-2 space-y-3">
        {p.needs!.map((n, i) => (
          <li key={i} className="rounded-lg bg-white p-3">
            <div className="text-sm text-ink-2">
              {NEED_ICON[n.type]} {lang === p.language ? n.label_native : n.label_en}
            </div>
            {n.type === "money" && n.goal ? (
              <div className="mt-2">
                <div className="h-2 overflow-hidden rounded-full bg-line-strong" role="progressbar" aria-valuemin={0} aria-valuemax={n.goal} aria-valuenow={n.raised || 0}>
                  <div className="h-full rounded-full bg-beauty-tint0" style={{ width: `${Math.min(100, ((n.raised || 0) / n.goal) * 100)}%` }} />
                </div>
                <div className="mt-1 text-xs text-muted">{t("raisedOf", { raised: n.raised || 0, goal: n.goal })}</div>
              </div>
            ) : null}
            {n.type !== "money" && (
              <button
                onClick={() => (user ? setOffering(n) : router.push(`/login?next=${encodeURIComponent(`/explore?open=${p.id}`)}`))}
                className="mt-2 min-h-11 rounded-full border border-beauty px-4 text-sm font-semibold text-beauty-ink hover:bg-beauty-tint"
              >
                🙋 {t("iCanHelp")}
              </button>
            )}
            {offering === n && (
              <div className="mt-2 space-y-2">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t("helpMsgPlaceholder")} aria-label={t("helpMsgPlaceholder")} className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <button disabled={busy || !note.trim()} onClick={sendOffer} className="min-h-11 rounded-full bg-pine px-4 text-sm font-semibold text-white disabled:opacity-50">➤ {t("sendHelp")}</button>
                  <button onClick={() => setOffering(null)} className="min-h-11 rounded-full px-4 text-sm text-muted">{t("cancel")}</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {sent && (
        <p role="status" className="mt-2 text-sm text-pine">
          ✅ {t("helpSent")} <Link href="/me#orders" className="font-semibold underline">{t("openChat")}</Link>
        </p>
      )}
      {hasMoney && !!p.paymentHandles?.length && (
        <div className="mt-3">
          <button onClick={() => setShowHandles(!showHandles)} aria-expanded={showHandles} className="min-h-11 w-full rounded-full bg-pine text-sm font-semibold text-white hover:bg-pine">
            💵 {t("supportDirectly")}
          </button>
          {showHandles && (
            <div className="mt-2 rounded-lg bg-white p-3 text-sm">
              <ul className="space-y-1 font-mono text-ink-2">{p.paymentHandles!.map((h) => <li key={h}>{h}</li>)}</ul>
              <p className="mt-2 text-xs text-muted">{t("goesDirectly")}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
