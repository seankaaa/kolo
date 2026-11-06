"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { UI_LANGS, useUILang, translate } from "@/lib/i18n";
import { logout, useSession } from "@/lib/session";

const navBtn =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 text-sm font-medium text-stone-700 hover:bg-stone-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orange-500";

export default function Header({ children }: { showOffer?: boolean; children?: React.ReactNode }) {
  const { lang, setLang, t } = useUILang();
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  function doLogout() {
    setOpen(false);
    logout();
    router.push("/");
  }

  const item = "flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm text-stone-800 hover:bg-orange-50";

  return (
    <header className="relative z-[1200] border-b border-stone-200 bg-white">
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
          {user ? (
            <div ref={menuRef} className="relative">
              <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" className={navBtn}>
                👤 {user.name} ▾
              </button>
              {open && (
                <div role="menu" className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-xl">
                  <Link role="menuitem" href="/me" onClick={() => setOpen(false)} className={item}>👤 {t("navProfile")}</Link>
                  <Link role="menuitem" href="/me#listings" onClick={() => setOpen(false)} className={item}>📋 {t("myListings")}</Link>
                  <Link role="menuitem" href="/me#orders" onClick={() => setOpen(false)} className={item}>🧾 {t("myOrders")}</Link>
                  <button role="menuitem" onClick={doLogout} className={`${item} border-t border-stone-100`}>🚪 {t("logout")}</button>
                </div>
              )}
            </div>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(pathname || "/")}`} className="flex min-h-11 items-center rounded-full bg-stone-900 px-4 text-sm font-semibold text-white hover:bg-stone-700">
              {t("login")}
            </Link>
          )}
        </div>
      </div>
      <nav aria-label="Navigation" className="flex flex-wrap items-center gap-2 border-t border-stone-100 px-4 py-2">
        <button onClick={() => router.back()} className={navBtn}>← {t("navBack")}</button>
        <button onClick={() => window.history.forward()} className={navBtn}>{t("navForward")} →</button>
        <Link href="/" aria-current={pathname === "/" || pathname === "/explore" ? "page" : undefined} className={`${navBtn} aria-[current=page]:border-orange-500 aria-[current=page]:bg-orange-50`}>
          🏠 {t("navHome")}
        </Link>
        <Link href="/join" aria-current={pathname === "/join" ? "page" : undefined} className={`${navBtn} aria-[current=page]:border-orange-500 aria-[current=page]:bg-orange-50`}>
          ✋ {t("offer")}
        </Link>
        {user && (
          <Link href="/me" aria-current={pathname === "/me" ? "page" : undefined} className={`${navBtn} aria-[current=page]:border-orange-500 aria-[current=page]:bg-orange-50`}>
            👤 {t("navProfile")}
          </Link>
        )}
      </nav>
    </header>
  );
}
