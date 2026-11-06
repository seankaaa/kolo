"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { load, save, UI_LANGS, useUILang, translate } from "@/lib/i18n";

const navBtn =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 text-sm font-medium text-stone-700 hover:bg-stone-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orange-500";

export default function Header({ showOffer = true, children }: { showOffer?: boolean; children?: React.ReactNode }) {
  const { lang, setLang, t } = useUILang();
  const router = useRouter();
  const pathname = usePathname();
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    // Only offer "My profile" if that provider still exists (demo data can be reset).
    const id = load<string | null>("kolo.providerId", null);
    if (!id) return;
    fetch(`/api/providers/${id}`).then((r) => {
      if (r.ok) setMyId(id);
      else save("kolo.providerId", null);
    });
  }, []);

  const profileHref = myId ? `/her/${myId}` : "/join";
  const [isCustomer, setIsCustomer] = useState(false);
  useEffect(() => {
    const check = () => setIsCustomer(!!load<string | null>("kolo.customerId", null));
    check();
    window.addEventListener("kolo-customer", check);
    return () => window.removeEventListener("kolo-customer", check);
  }, []);

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="rounded text-2xl font-bold tracking-tight text-stone-900 focus-visible:outline-3 focus-visible:outline-orange-500">
            Kolo <span className="text-orange-600">◯</span>
          </Link>
          <span className="hidden text-sm text-stone-500 lg:inline">{t("tagline")}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {children}
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
            <Link href="/her/oksana" className={`${navBtn} hidden sm:inline-flex`} title="Demo: open a sample provider's inbox">
              👩 {t("providerView")}
            </Link>
          )}
          {showOffer && !myId && (
            <Link
              href="/join"
              className="flex min-h-11 items-center rounded-full bg-orange-600 px-4 text-sm font-semibold text-white hover:bg-orange-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
            >
              ✋ {t("offer")} →
            </Link>
          )}
        </div>
      </div>
      <nav aria-label="Navigation" className="flex flex-wrap items-center gap-2 border-t border-stone-100 px-4 py-2">
        <button onClick={() => router.back()} className={navBtn}>← {t("navBack")}</button>
        <button onClick={() => window.history.forward()} className={navBtn}>{t("navForward")} →</button>
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={`${navBtn} aria-[current=page]:border-orange-500 aria-[current=page]:bg-orange-50`}>
          🏠 {t("navHome")}
        </Link>
        <Link
          href={profileHref}
          aria-current={pathname.startsWith("/her/") || pathname === "/join" ? "page" : undefined}
          className={`${navBtn} aria-[current=page]:border-orange-500 aria-[current=page]:bg-orange-50`}
        >
          👤 {myId ? t("navProfile") : t("offer")}
        </Link>
        {isCustomer && (
          <Link href="/orders" aria-current={pathname === "/orders" ? "page" : undefined} className={`${navBtn} aria-[current=page]:border-orange-500 aria-[current=page]:bg-orange-50`}>
            🧾 {t("myOrders")}
          </Link>
        )}
      </nav>
    </header>
  );
}
