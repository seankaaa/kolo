"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { load, UI_LANGS, useUILang, translate } from "@/lib/i18n";

export default function Header({ showOffer = true }: { showOffer?: boolean }) {
  const { lang, setLang, t } = useUILang();
  const [myId, setMyId] = useState<string | null>(null);
  useEffect(() => setMyId(load<string | null>("kolo.providerId", null)), []);

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-4 py-3">
      <div className="flex items-baseline gap-3">
        <Link href="/" className="rounded text-2xl font-bold tracking-tight text-stone-900 focus-visible:outline-3 focus-visible:outline-orange-500">
          Kolo <span className="text-orange-600">◯</span>
        </Link>
        <span className="hidden text-sm text-stone-500 md:inline">{t("tagline")}</span>
      </div>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="ui-lang">{t("uiLanguage")}</label>
        <select
          id="ui-lang"
          value={lang}
          onChange={(e) => setLang(e.target.value as typeof lang)}
          className="min-h-11 rounded-full border border-stone-300 bg-white px-3 text-sm"
        >
          {UI_LANGS.map((l) => (
            <option key={l} value={l}>🌐 {translate(l, "langName")}</option>
          ))}
        </select>
        {showOffer && (
          <Link
            href={myId ? `/her/${myId}` : "/join"}
            className="flex min-h-11 items-center rounded-full bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
          >
            {myId ? `📋 ${t("myListing")}` : `✋ ${t("offer")} →`}
          </Link>
        )}
      </div>
    </header>
  );
}
