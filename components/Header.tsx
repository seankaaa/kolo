"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { UI_LANGS, useUILang, translate } from "@/lib/i18n";
import { logout, useSession } from "@/lib/session";

const navBtn =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line-strong bg-white px-3 text-sm font-medium text-ink-2 hover:bg-sand focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink";

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

  const item = "flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm text-ink-2 hover:bg-sand";

  return (
    <header className="relative z-[1200] border-b border-line bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="rounded text-2xl font-bold tracking-tight text-ink focus-visible:outline-3 focus-visible:outline-ink">
            <span className="font-serif font-semibold tracking-[-0.02em]">Kolo</span>{" "}
            <span aria-hidden className="kolo-ring relative inline-block h-5 w-5 align-middle"><span className="absolute inset-[5px] rounded-full bg-paper" /></span>
          </Link>
          <span className="hidden text-sm text-muted lg:inline">{t("tagline")}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {children}
          <label className="sr-only" htmlFor="ui-lang">{t("uiLanguage")}</label>
          <select
            id="ui-lang"
            value={lang}
            onChange={(e) => setLang(e.target.value as typeof lang)}
            className="min-h-11 rounded-full border border-line-strong bg-white px-3 text-sm"
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
                <div role="menu" className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-line-strong bg-white py-1 shadow-xl">
                  <Link role="menuitem" href="/me" onClick={() => setOpen(false)} className={item}>👤 {t("navProfile")}</Link>
                  <Link role="menuitem" href="/me#listings" onClick={() => setOpen(false)} className={item}>📋 {t("myListings")}</Link>
                  <Link role="menuitem" href="/me#orders" onClick={() => setOpen(false)} className={item}>🧾 {t("myOrders")}</Link>
                  <button role="menuitem" onClick={doLogout} className={`${item} border-t border-line`}>🚪 {t("logout")}</button>
                </div>
              )}
            </div>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(pathname || "/")}`} className="flex min-h-11 items-center rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-ink-2">
              {t("login")}
            </Link>
          )}
        </div>
      </div>
      <nav aria-label="Navigation" className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2">
        <button onClick={() => router.back()} className={navBtn}>← {t("navBack")}</button>
        <button onClick={() => window.history.forward()} className={navBtn}>{t("navForward")} →</button>
        <Link href="/" aria-current={pathname === "/" || pathname === "/explore" ? "page" : undefined} className={`${navBtn} aria-[current=page]:border-ink aria-[current=page]:bg-sand`}>
          🏠 {t("navHome")}
        </Link>
        <Link href="/join" aria-current={pathname === "/join" ? "page" : undefined} className={`${navBtn} aria-[current=page]:border-ink aria-[current=page]:bg-sand`}>
          ✋ {t("offer")}
        </Link>
        {user && (
          <Link href="/me" aria-current={pathname === "/me" ? "page" : undefined} className={`${navBtn} aria-[current=page]:border-ink aria-[current=page]:bg-sand`}>
            👤 {t("navProfile")}
          </Link>
        )}
      </nav>
    </header>
  );
}
