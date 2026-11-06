"use client";

import dynamic from "next/dynamic";
import Header from "@/components/Header";
import { useUILang } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { AREAS, areaById, CATEGORIES, LANG_NAMES } from "@/lib/areas";
import ProviderDrawer, { servesLabel, VerifiedBadge } from "@/components/ProviderDrawer";
import type { Area, Provider } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-stone-400">Loading map…</div>,
});

export default function Home() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [areaQuery, setAreaQuery] = useState("");
  const [focus, setFocus] = useState<Area | null>(null);
  const [selected, setSelected] = useState<Provider | null>(null);
  const [group, setGroup] = useState<{ areaId: string; list: Provider[] } | null>(null);
  const [liveId, setLiveId] = useState<string | null>(null);
  const { t } = useUILang();

  useEffect(() => {
    // After publishing, /join redirects to /?live=<id>: center on her area and open her drawer.
    const live = new URLSearchParams(window.location.search).get("live");
    fetch("/api/providers")
      .then((r) => r.json())
      .then((list: Provider[]) => {
        setProviders(list);
        const me = live && list.find((p) => p.id === live);
        if (me) {
          setLiveId(me.id);
          setSelected(me);
          const a = areaById(me.areaId);
          if (a) setFocus({ ...a });
        }
      });
  }, []);

  async function verify() {
    if (!liveId) return;
    const res = await fetch(`/api/providers/${liveId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: true }),
    });
    const p: Provider = await res.json();
    setProviders((ps) => ps.map((x) => (x.id === p.id ? p : x)));
    setSelected(p);
  }
  const me = providers.find((p) => p.id === liveId);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return providers.filter((p) => {
      if (category && p.category !== category) return false;
      if (!kw) return true;
      const hay = [p.name, p.title_en, p.title_native, p.story_en, p.story_native, ...p.services.map((s) => s.name)]
        .join(" ")
        .toLowerCase();
      return hay.includes(kw);
    });
  }, [providers, category, keyword]);

  const areaMatches = areaQuery.trim()
    ? AREAS.filter((a) => a.name.toLowerCase().includes(areaQuery.trim().toLowerCase())).slice(0, 6)
    : [];

  function goToArea(a: Area) {
    setFocus({ ...a }); // new object so the map re-flies even if the same area is picked twice
    setAreaQuery(a.name);
  }

  const visibleList = group ? group.list.filter((p) => filtered.includes(p)) : filtered;

  return (
    <div className="flex h-screen flex-col bg-stone-50">
      <Header />
      {me && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 bg-emerald-600 px-5 py-3 text-white">
          <div>
            <span className="text-lg font-bold">🎉 {t("live")}</span> <span className="opacity-90">{t("liveSub")}</span>
          </div>
          {me.verified ? (
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-emerald-800">✓ {t("verified")}</span>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm opacity-90">{t("getVerified")}:</span>
              <button onClick={verify} className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-emerald-800">🪪 {t("verifyId")}</button>
              <button onClick={verify} className="min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-emerald-800">🤝 {t("verifyPartner")}</button>
              <span className="text-xs opacity-75">{t("demoVerify")}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <section className="flex w-full max-w-sm flex-col border-r border-stone-200 bg-white">
          <div className="space-y-3 border-b border-stone-100 p-4">
            <div className="relative">
              <input
                value={areaQuery}
                onChange={(e) => setAreaQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && areaMatches[0] && goToArea(areaMatches[0])}
                placeholder="📍 Area: Oakland, Mission, South Bay…"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
              {areaMatches.length > 0 && areaMatches[0].name !== areaQuery && (
                <ul className="absolute z-[1100] mt-1 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
                  {areaMatches.map((a) => (
                    <li key={a.id}>
                      <button onClick={() => goToArea(a)} className="w-full px-3 py-2 text-left text-sm hover:bg-orange-50">
                        {a.name} <span className="text-xs text-stone-400">{a.level}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="🔎 Search: tamales, manicure, медівник…"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setCategory(category === k ? null : k)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    category === k ? "border-orange-600 bg-orange-600 text-white" : "border-stone-300 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {group && (
            <div className="flex items-center justify-between bg-orange-50 px-4 py-2 text-sm text-orange-900">
              <span>
                {group.list.length} providers serving <b>{areaById(group.areaId)?.name}</b>
              </span>
              <button onClick={() => setGroup(null)} className="text-xs underline">Show all</button>
            </div>
          )}

          <ul className="flex-1 divide-y divide-stone-100 overflow-y-auto">
            {visibleList.map((p) => (
              <li key={p.id}>
                <button onClick={() => setSelected(p)} className="w-full px-4 py-3 text-left hover:bg-stone-50">
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <span>{CATEGORIES[p.category]}</span>·<span>{LANG_NAMES[p.language]}</span>
                    {p.verified && <VerifiedBadge />}
                  </div>
                  <div className="font-medium text-stone-900">{p.title_en}</div>
                  <div className="text-xs text-stone-500">
                    {p.name} · {p.locationPrecision === "exact" ? "🏪" : "Serves"} {servesLabel(p)}
                  </div>
                </button>
              </li>
            ))}
            {visibleList.length === 0 && <li className="p-6 text-center text-sm text-stone-400">No matches yet.</li>}
          </ul>
        </section>

        <main className="relative min-w-0 flex-1">
          <MapView
            providers={filtered}
            focus={focus}
            onSelectGroup={(areaId, list) => setGroup({ areaId, list })}
            onSelectProvider={setSelected}
          />
          {selected && <ProviderDrawer key={selected.id} provider={selected} onClose={() => setSelected(null)} />}
        </main>
      </div>
    </div>
  );
}
