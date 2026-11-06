"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Header from "@/components/Header";
import OrderChat, { formatWhen, StatusPill } from "@/components/OrderChat";
import { servesLabel, VerifiedBadge } from "@/components/ProviderDrawer";
import { LANG_NAMES } from "@/lib/areas";
import { catLabel, pick, useUILang } from "@/lib/i18n";
import { authHeaders, logout, useSession } from "@/lib/session";
import type { Lang, Order, Provider, User } from "@/lib/types";

type MeData = { user: User; listings: Provider[]; received: Order[]; placed: Order[] };
type Tab = "new" | "accepted" | "done" | "support";
const card = "rounded-2xl border border-line-strong bg-white p-4";
const pill = "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold";

export default function Me() {
  const router = useRouter();
  const { user, ready, setUser } = useSession();
  const { lang, t, setLang } = useUILang(user?.language ?? null);
  const [data, setData] = useState<MeData | null>(null);
  const [tab, setTab] = useState<Tab>("new");
  const [chat, setChat] = useState<{ id: string; role: "provider" | "customer" } | null>(null);
  const [liveId, setLiveId] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/me");
  }, [ready, user, router]);

  const load = useCallback(() => {
    if (!user) return;
    fetch(`/api/me?userId=${user.id}`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setData(d));
  }, [user]);

  useEffect(() => {
    setLiveId(new URLSearchParams(window.location.search).get("live"));
    load();
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [load]);

  async function patchListing(id: string, body: Record<string, unknown>) {
    await fetch(`/api/providers/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(body) });
    load();
  }
  async function deleteListing(id: string) {
    await fetch(`/api/providers/${id}`, { method: "DELETE", headers: authHeaders() });
    load();
  }
  async function setOrderStatus(id: string, status: Order["status"]) {
    await fetch(`/api/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  if (!user || !data) return <div className="min-h-screen bg-paper"><Header /></div>;

  const live = data.listings.find((l) => l.id === liveId);
  const orders = data.received.filter((o) => o.type !== "support");
  const byTab: Record<Tab, Order[]> = {
    new: orders.filter((o) => o.status === "new"),
    accepted: orders.filter((o) => o.status === "accepted"),
    done: orders.filter((o) => o.status === "done" || o.status === "declined"),
    support: data.received.filter((o) => o.type === "support"),
  };

  return (
    <div className="min-h-screen bg-paper">
      <Header />
      {live && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 bg-pine px-5 py-3 text-white">
          <div><span className="text-lg font-bold">🎉 {t("live")}</span> <span className="opacity-90">{t("liveSub")}</span></div>
          <div className="flex flex-wrap items-center gap-2">
            {live.verified ? (
              <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-pine">✓ {t("verified")}</span>
            ) : (
              <>
                <span className="text-sm opacity-90">{t("getVerified")}:</span>
                <Link href={`/verify?listing=${live.id}`} className={`${pill} bg-white text-pine`}>🪪 {t("getVerified")}</Link>
              </>
            )}
            <Link href={`/explore?live=${live.id}`} className={`${pill} border-2 border-white`}>🗺️ {t("seeMeOnMap")}</Link>
          </div>
        </div>
      )}

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          {/* ---------- My listings ---------- */}
          <section id="listings" className="scroll-mt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-ink">📋 {t("myListings")}</h2>
              <Link href="/join" className={`${pill} bg-pine text-white hover:bg-pine-dark`}>＋ {t("addListing")}</Link>
            </div>
            {data.listings.length === 0 && <p className="mt-3 text-muted">{t("noListings")}</p>}
            <ul className="mt-3 space-y-3">
              {data.listings.map((p) => (
                <ListingCard key={p.id} p={p} lang={lang} t={t} onPatch={(b) => patchListing(p.id, b)} onDelete={() => deleteListing(p.id)} />
              ))}
            </ul>
          </section>

          {/* ---------- Account ---------- */}
          <AccountCard user={user} t={t} onSaved={(u) => { setUser(u); setLang(u.language); }} onLogout={() => { logout(); router.push("/"); }} />
        </div>

        <div className="space-y-6">
          {/* ---------- Orders received ---------- */}
          <section id="orders" className="scroll-mt-4">
            <h2 className="text-xl font-bold text-ink">📥 {t("ordersReceived")}</h2>
            <div role="tablist" className="mt-3 flex gap-1">
              {(["new", "accepted", "done", "support"] as Tab[]).map((k) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  className={`min-h-11 flex-1 rounded-full text-sm font-semibold ${tab === k ? "bg-ink text-white" : "bg-line-strong text-ink-2"}`}>
                  {k === "support" ? `💛 ${t("supportOffers")}` : t(k === "new" ? "tabNew" : k === "accepted" ? "tabAccepted" : "tabDone")}
                  {byTab[k].length > 0 && <span className={`ml-1.5 rounded-full px-1.5 text-xs ${k === "new" || k === "support" ? "bg-pine text-white" : "bg-white/30"}`}>{byTab[k].length}</span>}
                </button>
              ))}
            </div>
            {byTab[tab].length === 0 && <p className="mt-3 text-sm text-faint">{t("noOrders")}</p>}
            <ul className="mt-3 space-y-2">
              {byTab[tab].map((o) => (
                <li key={o.id} className={`${card} ${chat?.id === o.id ? "border-white/30" : ""}`}>
                  <OrderSummary o={o} lang={lang} t={t} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {o.status === "new" && o.type !== "support" && (
                      <>
                        <button onClick={() => setOrderStatus(o.id, "accepted")} className={`${pill} bg-pine text-white`}>✓ {t("accept")}</button>
                        <button onClick={() => setOrderStatus(o.id, "declined")} className={`${pill} border border-line-strong`}>✕ {t("decline")}</button>
                      </>
                    )}
                    {o.status === "accepted" && <button onClick={() => setOrderStatus(o.id, "done")} className={`${pill} bg-violet-600 text-white`}>✔︎ {t("markDone")}</button>}
                    <button onClick={() => setChat({ id: o.id, role: "provider" })} className={`${pill} border border-line-strong`}>💬 {t("openChat")}</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* ---------- Orders placed ---------- */}
          <section>
            <h2 className="text-xl font-bold text-ink">🧾 {t("ordersPlaced")}</h2>
            {data.placed.length === 0 && <p className="mt-3 text-sm text-faint">{t("noCustomerOrders")}</p>}
            <ul className="mt-3 space-y-2">
              {data.placed.map((o) => (
                <li key={o.id} className={`${card} ${chat?.id === o.id ? "border-white/30" : ""}`}>
                  <OrderSummary o={o} lang={lang} t={t} customer />
                  <button onClick={() => setChat({ id: o.id, role: "customer" })} className={`${pill} mt-2 border border-line-strong`}>💬 {t("openChat")}</button>
                </li>
              ))}
            </ul>
          </section>

          {chat && (
            <section className="h-[32rem] overflow-hidden rounded-2xl border border-line-strong bg-white">
              <OrderChat key={chat.id} orderId={chat.id} role={chat.role} />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

type T = ReturnType<typeof useUILang>["t"];

function OrderSummary({ o, lang, t, customer }: { o: Order; lang: Lang; t: T; customer?: boolean }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-ink">{o.type === "support" && <span className="mr-1 rounded-full bg-beauty-tint px-2 py-0.5 text-xs text-beauty-ink">💛 {t("supportThread")}</span>}{customer ? o.item : o.customerName}</span>
        <StatusPill status={o.status} customer={customer} />
      </div>
      {!customer && <div className="text-sm text-ink-2">{o.item}{o.quantity && o.quantity > 1 ? ` × ${o.quantity}` : ""}</div>}
      <div className="mt-1 space-y-0.5 text-xs text-muted">
        {o.when && <div>🗓️ {formatWhen(o.when, lang)}</div>}
        {o.areaText && <div>🏘️ {o.areaText}</div>}
        {!customer && <div>🗣️ {t("customerSpeaks", { lang: LANG_NAMES[o.customerLanguage] })}</div>}
        <div>💬 {o.messages.length}</div>
      </div>
    </>
  );
}

function ListingCard({ p, lang, t, onPatch, onDelete }: {
  p: Provider; lang: Lang; t: T; onPatch: (b: Record<string, unknown>) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [form, setForm] = useState({
    title_en: p.title_en, title_native: p.title_native, availability: p.availability || "", services: p.services,
    story_native: p.story_native || "", story_en: p.story_en || "", needs: p.needs || [], paymentHandles: (p.paymentHandles || []).join("\n"),
  });
  const input = "min-h-11 w-full rounded-lg border border-line-strong px-3 text-sm";

  function save() {
    onPatch({
      listing: {
        ...p, ...form, other_city: p.otherCity,
        needs: form.needs.filter((n) => n.label_native.trim() || n.label_en.trim()),
        paymentHandles: form.paymentHandles.split("\n").map((h) => h.trim()).filter(Boolean),
      },
    });
    setEditing(false);
  }

  return (
    <li className={`${card} ${p.paused ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {catLabel(lang, p.category)} · {LANG_NAMES[p.language]} {p.verified && <VerifiedBadge />}
        <span className={`rounded-full px-2 py-0.5 font-semibold ${p.paused ? "bg-line-strong text-ink-2" : "bg-pine-soft text-pine"}`}>
          {p.paused ? `❚❚ ${t("paused")}` : `● ${t("available")}`}
        </span>
      </div>
      {editing ? (
        <div className="mt-2 space-y-2">
          <label className="block text-xs text-muted">{t("titleNative")}<input value={form.title_native} onChange={(e) => setForm({ ...form, title_native: e.target.value })} className={input} /></label>
          <label className="block text-xs text-muted">{t("titleEn")}<input value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} className={input} /></label>
          <label className="block text-xs text-muted">{t("availability")}<input value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })} className={input} /></label>
          {form.services.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_7rem] gap-2">
              <input aria-label={t("services")} value={s.name} onChange={(e) => setForm({ ...form, services: form.services.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} className={input} />
              <input aria-label={t("price")} value={s.price} onChange={(e) => setForm({ ...form, services: form.services.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) })} className={input} />
            </div>
          ))}
          <label className="block text-xs text-muted">💛 {t("story")}
            <textarea rows={3} value={form.story_native} onChange={(e) => setForm({ ...form, story_native: e.target.value })} className={`${input} py-2`} />
          </label>
          <label className="block text-xs text-muted">💛 {t("story")} (English)
            <textarea rows={2} value={form.story_en} onChange={(e) => setForm({ ...form, story_en: e.target.value })} className={`${input} py-2`} />
          </label>
          <fieldset className="space-y-2 rounded-lg border border-beauty p-2">
            <legend className="px-1 text-xs font-semibold text-beauty-ink">{t("howHelp")}</legend>
            {form.needs.map((n, i) => (
              <div key={i} className="grid grid-cols-[5.5rem_1fr_5rem_2.75rem] gap-1">
                <select aria-label="type" value={n.type} onChange={(e) => setForm({ ...form, needs: form.needs.map((x, j) => (j === i ? { ...x, type: e.target.value as typeof n.type } : x)) })} className={input}>
                  <option value="money">💵</option><option value="goods">🎁</option><option value="help">🤝</option>
                </select>
                <input aria-label={t("needs")} value={n.label_native} onChange={(e) => setForm({ ...form, needs: form.needs.map((x, j) => (j === i ? { ...x, label_native: e.target.value, label_en: x.label_en || e.target.value } : x)) })} className={input} />
                <input aria-label={t("goal")} type="number" min={0} placeholder="$" value={n.goal ?? ""} disabled={n.type !== "money"} onChange={(e) => setForm({ ...form, needs: form.needs.map((x, j) => (j === i ? { ...x, goal: e.target.value ? +e.target.value : undefined } : x)) })} className={input} />
                <button aria-label={t("delete")} onClick={() => setForm({ ...form, needs: form.needs.filter((_, j) => j !== i) })} className="min-h-11 rounded-lg border border-line-strong">✕</button>
              </div>
            ))}
            <button onClick={() => setForm({ ...form, needs: [...form.needs, { type: "goods", label_native: "", label_en: "" }] })} className="min-h-11 rounded-full border border-beauty px-3 text-sm text-beauty-ink">＋ {t("addNeed")}</button>
          </fieldset>
          <label className="block text-xs text-muted">💵 {t("paymentHandles")}
            <textarea rows={2} value={form.paymentHandles} onChange={(e) => setForm({ ...form, paymentHandles: e.target.value })} placeholder="Venmo: @name" className={`${input} py-2 font-mono`} />
            <span className="text-faint">{t("moneyDirect")}</span>
          </label>
          <div className="flex gap-2">
            <button onClick={save} className={`${pill} bg-ink text-white`}>✓ {t("save")}</button>
            <button onClick={() => setEditing(false)} className={`${pill} border border-line-strong`}>{t("cancel")}</button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1 font-semibold text-ink">{pick(p, lang, p.title_en, p.title_native)}</p>
          <p className="text-xs text-muted">📍 {t("serves")} {servesLabel(p)}</p>
          <ul className="mt-2 space-y-0.5 text-sm text-ink-2">
            {p.services.map((s) => <li key={s.name} className="flex justify-between gap-2"><span>{s.name}</span><b>{s.price === "price on request" ? t("priceOnRequest") : s.price}</b></li>)}
          </ul>
          {(p.story_native || p.story_en) && <p className="mt-2 text-sm italic text-muted">“{pick(p, lang, p.story_en, p.story_native)}”</p>}
          {!!p.needs?.length && (
            <ul className="mt-2 flex flex-wrap gap-1">
              {p.needs.map((n, i) => <li key={i} className="rounded-full bg-beauty-tint px-2 py-0.5 text-xs text-beauty-ink">{n.type === "money" ? "💵" : n.type === "goods" ? "🎁" : "🤝"} {lang === p.language ? n.label_native : n.label_en}{n.goal ? ` · $${n.goal}` : ""}</li>)}
            </ul>
          )}
          {p.paused && <p className="mt-1 text-xs text-muted">{t("pausedHint")}</p>}
        </>
      )}
      {!editing && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!p.verified && <Link href={`/verify?listing=${p.id}`} className={`${pill} bg-pine text-white hover:bg-pine-dark`}>🪪 {t("getVerified")}</Link>}
          <button onClick={() => setEditing(true)} className={`${pill} border border-line-strong`}>✎ {t("edit")}</button>
          <button onClick={() => onPatch({ paused: !p.paused })} className={`${pill} border border-line-strong`}>{p.paused ? `▶ ${t("activate")}` : `❚❚ ${t("pause")}`}</button>
          <Link href={`/explore?live=${p.id}`} className={`${pill} border border-line-strong`}>🗺️ {t("seeOnMap")}</Link>
          {confirming ? (
            <span className="flex flex-wrap items-center gap-2 rounded-xl bg-red-50 p-2 text-sm text-red-800">
              {t("confirmDelete")}
              <button onClick={onDelete} className={`${pill} bg-red-600 text-white`}>{t("yesDelete")}</button>
              <button onClick={() => setConfirming(false)} className={`${pill} border border-line-strong bg-white text-ink-2`}>{t("cancel")}</button>
            </span>
          ) : (
            <button onClick={() => setConfirming(true)} className={`${pill} border border-red-200 text-red-700`}>🗑 {t("delete")}</button>
          )}
        </div>
      )}
    </li>
  );
}

function AccountCard({ user, t, onSaved, onLogout }: { user: User; t: T; onSaved: (u: User) => void; onLogout: () => void }) {
  const [name, setName] = useState(user.name);
  const [language, setLanguage] = useState<Lang>(user.language);
  const [saved, setSaved] = useState(false);
  async function save() {
    const r = await fetch(`/api/users/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, language }) });
    if (r.ok) {
      onSaved(await r.json());
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }
  const input = "min-h-11 w-full rounded-lg border border-line-strong px-3";
  return (
    <section className={card}>
      <h2 className="text-xl font-bold text-ink">⚙️ {t("account")}</h2>
      <div className="mt-3 space-y-3">
        <label className="block text-sm text-muted">{t("firstNameShort")}<input value={name} onChange={(e) => setName(e.target.value)} className={input} /></label>
        <label className="block text-sm text-muted">{t("email")}<input value={user.email} readOnly className={`${input} bg-paper text-muted`} /></label>
        <label className="block text-sm text-muted">{t("language")}
          <select value={language} onChange={(e) => setLanguage(e.target.value as Lang)} className={input}>
            {Object.entries(LANG_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button onClick={save} className={`${pill} bg-ink text-white`}>{saved ? `✓ ${t("saved")}` : t("save")}</button>
          <button onClick={onLogout} className={`${pill} border border-line-strong`}>🚪 {t("logout")}</button>
        </div>
        <p className="text-xs text-faint">🧪 {t("demoLogin")}</p>
      </div>
    </section>
  );
}
