"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import ProviderDrawer, { servesLabel, VerifiedBadge } from "@/components/ProviderDrawer";
import type { Bounds, MapTarget } from "@/components/MapView";
import { AREAS, areaById, CATEGORIES, distanceKm, LANG_NAMES, nearestArea, parentLabel, searchAreas } from "@/lib/areas";
import { catLabel, pick, useUILang, type UIKey } from "@/lib/i18n";
import type { Area, Provider } from "@/lib/types";
import type { Suggestion } from "@/app/api/suggest/route";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-stone-400">…</div>,
});

function posOf(p: Provider): [number, number] | null {
  if (p.locationPrecision === "exact" && p.lat && p.lng) return [p.lat, p.lng];
  const a = areaById(p.areaId);
  return a ? [a.lat, a.lng] : null;
}

const inBounds = (b: Bounds, [lat, lng]: [number, number]) => lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;

export default function Home() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [areaQuery, setAreaQuery] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [focusArea, setFocusArea] = useState<Area | null>(null);
  const [target, setTarget] = useState<MapTarget | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [selected, setSelected] = useState<Provider | null>(null);
  const [group, setGroup] = useState<{ areaId: string; list: Provider[] } | null>(null);
  const [liveId, setLiveId] = useState<string | null>(null);
  const [geoMsg, setGeoMsg] = useState("");
  const { lang, t } = useUILang();
  // AI fallback when the keyword matches nothing: keyed by the search it answers, so stale results never show.
  const [suggest, setSuggest] = useState<{ key: string; items: Suggestion[] | null } | null>(null);

  function flyToArea(a: Area) {
    setFocusArea(a);
    setGroup(null);
    setTarget({ lat: a.lat, lng: a.lng, radius_km: a.radius_km, nonce: Date.now() });
  }

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
          if (a) flyToArea(a);
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
      const hay = [p.name, p.title_en, p.title_native, p.story_en, p.story_native, ...p.services.map((s) => s.name)].join(" ").toLowerCase();
      return hay.includes(kw);
    });
  }, [providers, category, keyword]);

  // The list follows the map: only providers whose pin or area center is in view.
  const inView = useMemo(
    () => (bounds ? filtered.filter((p) => { const pos = posOf(p); return pos && inBounds(bounds, pos); }) : filtered),
    [filtered, bounds]
  );
  const visibleList = group ? group.list.filter((p) => filtered.includes(p)) : inView;

  const kw = keyword.trim();
  const near = focusArea?.id || "";
  const suggestKey = `${category || ""}|${near}|${kw.toLowerCase()}`;
  const wantSuggestions = kw.length >= 3 && providers.length > 0 && filtered.length === 0;

  useEffect(() => {
    if (!wantSuggestions) return;
    const ctrl = new AbortController();
    // Debounce so we ask once the customer pauses typing, not on every keystroke.
    const t = setTimeout(() => {
      setSuggest({ key: suggestKey, items: null });
      fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: kw, category, near }),
        signal: ctrl.signal,
      })
        .then((r) => r.json())
        .then((d) => setSuggest({ key: suggestKey, items: d.suggestions || [] }))
        .catch(() => {});
    }, 700);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [wantSuggestions, suggestKey, kw, category, near]);

  const suggestState = wantSuggestions && suggest?.key === suggestKey ? suggest.items : undefined;
  const suggested = (suggestState || [])
    .map((s) => ({ ...s, provider: providers.find((p) => p.id === s.id) }))
    .filter((s): s is Suggestion & { provider: Provider } => !!s.provider);

  const suggestions = useMemo(() => searchAreas(areaQuery), [areaQuery]);
  const noMatch = areaQuery.trim().length >= 2 && suggestions.length === 0;

  function pick(a: Area) {
    setAreaQuery(a.name);
    setShowSuggest(false);
    flyToArea(a);
  }

  function nearMe() {
    setGeoMsg("");
    if (!navigator.geolocation) return setGeoMsg(t("geoUnavailable"));
    // Used once, in the browser only: never stored or sent anywhere.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const a = nearestArea(pos.coords.latitude, pos.coords.longitude);
        if (a) pick(a);
      },
      () => setGeoMsg(t("geoFailed"))
    );
  }

  // Empty state helpers: nearest areas that do have providers.
  const nearestWithProviders = useMemo(() => {
    if (!focusArea) return [];
    const withP = new Set(providers.map((p) => p.areaId));
    return AREAS.filter((a) => withP.has(a.id) && a.id !== focusArea.id && a.level !== "state")
      .sort((a, b) => distanceKm(focusArea.lat, focusArea.lng, a.lat, a.lng) - distanceKm(focusArea.lat, focusArea.lng, b.lat, b.lng))
      .slice(0, 3);
  }, [focusArea, providers]);

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

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section className="flex max-h-[45vh] w-full flex-col border-b border-stone-200 bg-white md:max-h-none md:max-w-sm md:border-b-0 md:border-r">
          <div className="space-y-3 border-b border-stone-100 p-4">
            <div className="relative">
              <label htmlFor="area-q" className="sr-only">{t("areaLabel")}</label>
              <input
                id="area-q"
                value={areaQuery}
                onChange={(e) => { setAreaQuery(e.target.value); setShowSuggest(true); }}
                onFocus={() => setShowSuggest(true)}
                onKeyDown={(e) => e.key === "Enter" && suggestions[0] && pick(suggestions[0])}
                placeholder={t("areaPlaceholder")}
                autoComplete="off"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
              {showSuggest && suggestions.length > 0 && (
                <ul className="absolute z-[1100] mt-1 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
                  {suggestions.map((a) => (
                    <li key={a.id}>
                      <button onClick={() => pick(a)} className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-orange-50">
                        <span>
                          {a.name}
                          {parentLabel(a) && <span className="text-stone-400"> · {parentLabel(a)}</span>}
                        </span>
                        <span className="text-xs text-stone-400">{t(`lvl_${a.level}` as UIKey)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {noMatch && <p className="mt-1 text-xs text-amber-700">{t("noPlace")}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={nearMe} className="min-h-9 flex-1 rounded-full border border-stone-300 text-xs font-medium hover:bg-stone-100">📍 {t("nearMe")}</button>
              <button onClick={() => { setFocusArea(null); setGroup(null); setTarget({ us: true, nonce: Date.now() }); }} className="min-h-9 flex-1 rounded-full border border-stone-300 text-xs font-medium hover:bg-stone-100">
                🇺🇸 {t("allUS")}
              </button>
            </div>
            {geoMsg && <p className="text-xs text-amber-700">{geoMsg}</p>}
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchLabel")}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(CATEGORIES).map((k) => (
                <button
                  key={k}
                  onClick={() => setCategory(category === k ? null : k)}
                  aria-pressed={category === k}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    category === k ? "border-orange-600 bg-orange-600 text-white" : "border-stone-300 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {catLabel(lang, k)}
                </button>
              ))}
            </div>
          </div>

          {group && (
            <div className="flex items-center justify-between bg-orange-50 px-4 py-2 text-sm text-orange-900">
              <span>{t("servingArea", { n: group.list.length, area: areaById(group.areaId)?.name ?? "" })}</span>
              <button onClick={() => setGroup(null)} className="text-xs underline">{t("showAllInView")}</button>
            </div>
          )}

          <ul className="flex-1 divide-y divide-stone-100 overflow-y-auto">
            {visibleList.map((p) => (
              <li key={p.id}>
                <ProviderRow p={p} onClick={() => setSelected(p)} />
              </li>
            ))}
            {visibleList.length === 0 && !wantSuggestions && (
              <li className="space-y-3 p-6 text-center text-sm text-stone-500">
                <p>
                  {t("emptyHere")}{" "}
                  <Link href="/join" className="font-semibold text-orange-700 underline">{t("offer")} →</Link>
                </p>
                {nearestWithProviders.length > 0 && (
                  <div>
                    <p className="text-xs text-stone-400">{t("nearbyWithProviders")}</p>
                    <div className="mt-2 flex flex-wrap justify-center gap-2">
                      {nearestWithProviders.map((a) => (
                        <button key={a.id} onClick={() => pick(a)} className="rounded-full border border-stone-300 px-3 py-1 text-xs hover:bg-orange-50">
                          📍 {a.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            )}
            {wantSuggestions && suggested.length > 0 && (
              <>
                <li className="bg-orange-50 px-4 py-3 text-sm text-orange-900">
                  {t("suggestIntro", { kw })}
                </li>
                {suggested.map(({ provider: p, reason }) => (
                  <li key={p.id}>
                    <ProviderRow p={p} onClick={() => setSelected(p)} reason={reason} />
                  </li>
                ))}
              </>
            )}
            {wantSuggestions && !suggestState && (
              <li className="p-6 text-center text-sm text-stone-400">{t("suggestLooking")}</li>
            )}
            {wantSuggestions && suggestState && suggested.length === 0 && (
              <li className="p-6 text-center text-sm text-stone-400">{t("noMatches")}</li>
            )}
          </ul>
        </section>

        <main className="relative min-h-0 min-w-0 flex-1">
          <MapView
            providers={filtered.length === 0 && suggested.length > 0 ? suggested.map((s) => s.provider) : filtered}
            target={target}
            onBounds={setBounds}
            onSelectGroup={(areaId, list) => setGroup({ areaId, list })}
            onSelectProvider={setSelected}
            onFly={(id) => { const a = areaById(id); if (a) flyToArea(a); }}
          />
          {selected && <ProviderDrawer key={selected.id} provider={selected} onClose={() => setSelected(null)} />}
        </main>
      </div>
    </div>
  );
}

function ProviderRow({ p, onClick, reason }: { p: Provider; onClick: () => void; reason?: string }) {
  const { lang, t } = useUILang();
  return (
    <button onClick={onClick} className="w-full px-4 py-3 text-left hover:bg-stone-50">
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <span>{catLabel(lang, p.category)}</span>·<span>{LANG_NAMES[p.language]}</span>
        {p.verified && <VerifiedBadge />}
      </div>
      <div className="font-medium text-stone-900">{pick(p, lang, p.title_en, p.title_native)}</div>
      <div className="text-xs text-stone-500">
        {p.name} · {p.locationPrecision === "exact" ? "🏪" : t("serves")} {servesLabel(p)}
      </div>
      {reason && <div className="mt-1 text-xs italic text-orange-800">✨ {reason}</div>}
    </button>
  );
}
