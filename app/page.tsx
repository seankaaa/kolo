"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { speak } from "@/components/useSpeech";
import { SPEECH_LANG } from "@/lib/areas";
import { translate, UI_LANGS, useUILang } from "@/lib/i18n";
import { useSession } from "@/lib/session";

/** Entry: pick a language (if none saved yet), then one of two big choices. */
export default function Entry() {
  const { lang, setLang, t } = useUILang();
  const { user } = useSession();
  const [choosingLang, setChoosingLang] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("kolo.lang") && !sessionStorage.getItem("kolo.lang")) setChoosingLang(true);
    } catch {}
  }, []);

  const offerHref = user ? "/join" : "/login?next=/join";
  const card =
    "flex min-h-[240px] flex-col items-start justify-between gap-6 rounded-[28px] border-[3px] border-transparent p-8 text-left transition hover:border-ink focus-visible:border-ink";

  return (
    <main className="min-h-screen bg-paper px-5 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-3xl text-ink">
            <span className="font-serif font-semibold tracking-[-0.02em]">Kolo</span>{" "}
            <span aria-hidden className="kolo-ring relative inline-block h-6 w-6 align-middle"><span className="absolute inset-[6px] rounded-full bg-paper" /></span>
          </Link>
          {!choosingLang && (
            <button onClick={() => setChoosingLang(true)} className="min-h-11 rounded-full px-3 text-base text-muted underline underline-offset-4 hover:text-ink">
              🌐 {t("changeLanguage")}
            </button>
          )}
        </div>

        {choosingLang ? (
          <section className="mt-12">
            <h1 className="font-serif text-[34px] leading-tight text-ink">🌐 {t("chooseLanguage")}</h1>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {UI_LANGS.map((l) => (
                <button
                  key={l}
                  lang={l}
                  onClick={() => { setLang(l); setChoosingLang(false); }}
                  className="min-h-24 rounded-[22px] border-2 border-line-strong bg-white text-3xl font-semibold text-ink hover:border-ink"
                >
                  {translate(l, "langName")}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="mt-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="font-serif text-[34px] leading-tight text-ink">{t("entryQ")}</h1>
              <button
                onClick={() => speak([t("entryQ"), t("findService"), t("offerServices")].join(". "), SPEECH_LANG[lang])}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-sand px-5 text-base font-semibold text-ink"
              >
                🔊 {t("listenAll")}
              </button>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <Link href="/explore" className={`${card} bg-cleaning-tint`}>
                <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-white text-4xl" aria-hidden>🛍️</span>
                <span>
                  <span className="block text-[26px] font-semibold leading-tight text-ink">{t("findService")}</span>
                  <span className="mt-2 block text-lg text-ink-2">{t("findServiceSub")}</span>
                </span>
              </Link>
              <Link href={offerHref} className={`${card} bg-beauty-tint`}>
                <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-white text-4xl" aria-hidden>🎤</span>
                <span>
                  <span className="block text-[26px] font-semibold leading-tight text-ink">{t("offerServices")}</span>
                  <span className="mt-2 block text-lg text-ink-2">{t("offerServicesSub")}</span>
                </span>
              </Link>
            </div>
            {user && (
              <p className="mt-8 text-center text-base text-muted">
                👤 {t("loggedInAs", { name: user.name })} · <Link href="/me" className="font-semibold text-pine underline">{t("navProfile")}</Link>
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
