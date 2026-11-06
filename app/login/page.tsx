"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { LANG_NAMES } from "@/lib/areas";
import { useUILang } from "@/lib/i18n";
import { setSession } from "@/lib/session";
import type { Lang, User } from "@/lib/types";

const DEMO = [
  { email: "maria@example.com", name: "María T.", language: "es" as Lang, role: "providerRole" as const, flag: "🧹" },
  { email: "oksana@example.com", name: "Oksana K.", language: "uk" as Lang, role: "providerRole" as const, flag: "💅" },
  { email: "alex@example.com", name: "Alex", language: "en" as Lang, role: "customerRole" as const, flag: "🛒" },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/me";
  const { lang, setLang, t } = useUILang();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<Lang>("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setLanguage(lang), [lang]);

  async function login(body: { email: string; name: string; language: Lang }) {
    setBusy(true);
    setError("");
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) {
      setBusy(false);
      return setError(t("errRequired"));
    }
    const u: User = await r.json();
    setSession(u.id);
    setLang(u.language);
    router.push(next.startsWith("/") ? next : "/me");
  }

  const field = "h-16 w-full rounded-[18px] border-2 border-line-strong bg-white px-4 text-[20px] focus:border-ink focus:outline-none";
  return (
    <main className="mx-auto max-w-[520px] px-4 py-10 text-[17px]">
      <h1 className="font-serif text-[32px] font-semibold text-ink">{t("login")}</h1>
      <p className="mt-1 rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-ink">🧪 {t("demoLogin")}</p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          login({ email, name, language });
        }}
      >
        <label className="block text-base font-semibold text-ink-2">
          {t("email")}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={`${field} mt-1`} />
        </label>
        <label className="block text-base font-semibold text-ink-2">
          {t("firstNameShort")}
          <input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" className={`${field} mt-1`} />
        </label>
        <label className="block text-base font-semibold text-ink-2">
          {t("language")}
          <select value={language} onChange={(e) => setLanguage(e.target.value as Lang)} className={`${field} mt-1`}>
            {Object.entries(LANG_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <button disabled={busy} className="h-[68px] w-full rounded-full bg-pine text-[20px] font-semibold text-white hover:bg-pine-dark disabled:opacity-50">
          {t("continue")} →
        </button>
      </form>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-faint">{t("demoAccounts")}</h2>
      <div className="mt-2 grid gap-2">
        {DEMO.map((d) => (
          <button key={d.email} disabled={busy} onClick={() => login(d)} className="flex min-h-12 items-center justify-between rounded-xl border border-line-strong bg-white px-4 text-left hover:border-white/30 hover:bg-sand">
            <span>{d.flag} <b>{d.name}</b> <span className="text-muted">· {t(d.role)} · {LANG_NAMES[d.language]}</span></span>
            <span aria-hidden>→</span>
          </button>
        ))}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
