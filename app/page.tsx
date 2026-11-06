"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AREAS, areaById, CATEGORIES, LANG_NAMES } from "@/lib/areas";
import ProviderDrawer, { servesLabel, VerifiedBadge } from "@/components/ProviderDrawer";
import type { Area, Provider } from "@/lib/types";
import type { Suggestion } from "@/app/api/suggest/route";

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
  // AI fallback when the keyword matches nothing: keyed by the search it answers, so stale results never show.
  const [suggest, setSuggest] = useState<{ key: string; items: Suggestion[] | null } | null>(null);

  useEffect(() => {
    fetch("/api/providers").then((r) => r.json()).then(setProviders);
  }, []);

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

  const kw = keyword.trim();
  const suggestKey = `${category || ""}|${kw.toLowerCase()}`;
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
        body: JSON.stringify({ query: kw, category }),
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
  }, [wantSuggestions, suggestKey, kw, category]);

  const suggestState = wantSuggestions && suggest?.key === suggestKey ? suggest.items : undefined;
  const suggested = (suggestState || [])
    .map((s) => ({ ...s, provider: providers.find((p) => p.id === s.id) }))
    .filter((s): s is Suggestion & { provider: Provider } => !!s.provider);

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
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-3">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold tracking-tight text-stone-900">
            Kolo <span className="text-orange-600">◯</span>
          </span>
          <span className="hidden text-sm text-stone-500 sm:inline">Local services by women, in their own language</span>
        </div>
        <Link href="/join" className="rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">
          Offer your services →
        </Link>
      </header>

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
                <ProviderRow p={p} onClick={() => setSelected(p)} />
              </li>
            ))}
            {visibleList.length === 0 && suggested.length > 0 && (
              <>
                <li className="bg-orange-50 px-4 py-3 text-sm text-orange-900">
                  No exact matches for <b>“{kw}”</b>, but these providers might be able to help. Ask them in chat to confirm.
                </li>
                {suggested.map(({ provider: p, reason }) => (
                  <li key={p.id}>
                    <ProviderRow p={p} onClick={() => setSelected(p)} reason={reason} />
                  </li>
                ))}
              </>
            )}
            {visibleList.length === 0 && suggestState === null && (
              <li className="p-6 text-center text-sm text-stone-400">No exact matches. Looking for someone who might help…</li>
            )}
            {visibleList.length === 0 && suggestState !== null && suggested.length === 0 && (
              <li className="p-6 text-center text-sm text-stone-400">No matches yet.</li>
            )}
          </ul>
        </section>

        <main className="relative min-w-0 flex-1">
          <MapView
            providers={filtered.length === 0 && suggested.length > 0 ? suggested.map((s) => s.provider) : filtered}
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

function ProviderRow({ p, onClick, reason }: { p: Provider; onClick: () => void; reason?: string }) {
  return (
    <button onClick={onClick} className="w-full px-4 py-3 text-left hover:bg-stone-50">
      <div className="flex items-center gap-2 text-xs text-stone-500">
        <span>{CATEGORIES[p.category]}</span>·<span>{LANG_NAMES[p.language]}</span>
        {p.verified && <VerifiedBadge />}
      </div>
      <div className="font-medium text-stone-900">{p.title_en}</div>
      <div className="text-xs text-stone-500">
        {p.name} · {p.locationPrecision === "exact" ? "🏪" : "Serves"} {servesLabel(p)}
      </div>
      {reason && <div className="mt-1 text-xs italic text-orange-800">✨ {reason}</div>}
    </button>
  );
}
