"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Header from "@/components/Header";
import { speak } from "@/components/useSpeech";
import { SPEECH_LANG } from "@/lib/areas";
import { useUILang, type UIKey } from "@/lib/i18n";
import { authHeaders, useSession } from "@/lib/session";

/*
 * MOCK identity verification — view only. Nothing is checked, sent, or stored:
 * every value lives in this component's state and is dropped on finish/leave.
 * The only network call marks the listing verified at the very end.
 * Never asks about immigration status, visa type, or citizenship.
 */

type Step = "choose" | "details" | "tax" | "photo" | "selfie" | "consent" | "checking" | "partner" | "confirming" | "done";
const A_STEPS: Step[] = ["details", "tax", "photo", "selfie", "consent"];
const ID_TYPES: UIKey[] = ["vId_dl", "vId_state", "vId_passport", "vId_consular", "vId_work"];
const PARTNERS = ["Bay Area Women's Worker Center (demo)", "Ukrainian Community Center SF (demo)", "Mission Neighborhood Resource Hub (demo)", "Slavic Families Network Sacramento (demo)"];
const CHECKS: UIKey[] = ["vC1", "vC2", "vC3", "vC4"];

const EMPTY = { first: "", last: "", dob: "", phone: "", zip: "", last4: "", idType: "", front: false, back: false, selfie: false, consent: false, partner: "", code: "" };

const cta = "flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-pine px-5 text-xl font-bold text-white hover:bg-pine-dark disabled:opacity-40 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-pine";
const big = "mt-1 min-h-14 w-full rounded-2xl border-2 border-line-strong bg-white px-4 text-xl focus:border-pine focus:outline-none";
const lbl = "block text-lg font-semibold text-ink-2";

function Flow() {
  const router = useRouter();
  const params = useSearchParams();
  const listingId = params.get("listing");
  const { lang, t } = useUILang();
  const { user } = useSession();
  const [step, setStep] = useState<Step>("choose");
  const [f, setF] = useState(EMPTY);
  const [showTax, setShowTax] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [checked, setChecked] = useState(0);
  const set = (patch: Partial<typeof EMPTY>) => setF((cur) => ({ ...cur, ...patch }));

  async function finish() {
    setF(EMPTY); // drop every entered value
    if (listingId) await fetch(`/api/providers/${listingId}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ verified: true }) });
    setStep("done");
  }

  // Clear everything when leaving the page.
  useEffect(() => () => setF(EMPTY), []);

  // Animated checklist (~1s each), then mark verified.
  useEffect(() => {
    if (step !== "checking") return;
    if (checked < CHECKS.length) {
      const timer = setTimeout(() => setChecked((c) => c + 1), 1000);
      return () => clearTimeout(timer);
    }
    finish();
  }, [step, checked]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step !== "confirming") return;
    const timer = setTimeout(finish, 2000);
    return () => clearTimeout(timer);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDemo = !!user?.email.endsWith("@example.com");
  const demoFill = () =>
    set({ first: user?.name.split(" ")[0] || "María", last: "Torres", dob: "1990-01-01", phone: "555-0100", zip: "94112", last4: "0000", idType: "vId_state" });

  const aIndex = A_STEPS.indexOf(step);
  const title: Record<Step, UIKey> = {
    choose: "vChoose", details: "vDetails", tax: "vTax", photo: "vPhotoId", selfie: "vSelfie", consent: "vConsent",
    checking: "vChecking", partner: "vPartnerPick", confirming: "vPartnerConfirming", done: "vDone",
  };
  const helpFor: Partial<Record<Step, UIKey>> = { details: "vDetailsHelp", tax: "vTaxHelp", selfie: "vSelfieHelp", consent: "vConsentNote", partner: "vReferralHelp", done: "vDoneSub" };
  const listenText = [t(title[step]), helpFor[step] ? t(helpFor[step]!) : ""].join(". ");
  const back = () => setStep(aIndex > 0 ? A_STEPS[aIndex - 1] : "choose");
  const next = () => setStep(A_STEPS[aIndex + 1] ?? "checking");

  const canNext: Partial<Record<Step, boolean>> = {
    details: !!(f.first && f.last && f.dob && f.phone && f.zip),
    tax: /^\d{4}$/.test(f.last4),
    photo: !!(f.idType && f.front && f.back),
    selfie: f.selfie,
    consent: f.consent,
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-6 text-lg">
      <p role="note" className="rounded-2xl bg-warn-bg px-4 py-3 text-base font-medium text-warn-fg">🧪 {t("vDemoBanner")}</p>

      <div className="mt-5 flex items-center justify-between gap-2">
        {aIndex >= 0 || step === "partner" ? (
          <button onClick={step === "partner" ? () => setStep("choose") : back} className="min-h-11 rounded-full border border-line-strong bg-white px-4 text-base font-semibold">← {t("vBack")}</button>
        ) : <span />}
        <button onClick={() => speak(listenText, SPEECH_LANG[lang])} className="min-h-11 rounded-full border border-line-strong bg-white px-4 text-base font-semibold">🔊 {t("vListen")}</button>
      </div>

      {aIndex >= 0 && (
        <div className="mt-4">
          <p className="text-base text-muted">{t("vStepOf", { n: aIndex + 1, total: A_STEPS.length })}</p>
          <div className="mt-1 flex gap-1.5" aria-hidden>
            {A_STEPS.map((s, i) => <div key={s} className={`h-2 flex-1 rounded-full ${i <= aIndex ? "bg-pine" : "bg-line-strong"}`} />)}
          </div>
        </div>
      )}

      <h1 aria-live="polite" className="mt-5 text-[28px] font-bold leading-snug text-ink">{t(title[step])}</h1>
      {helpFor[step] && step !== "consent" && <p className="mt-1 text-muted">{t(helpFor[step]!)}</p>}

      {step === "choose" && (
        <div className="mt-6 space-y-3">
          {!listingId && <p className="rounded-xl bg-sand p-3 text-base text-muted">{t("vNoListing")}</p>}
          <button onClick={() => setStep("details")} className="flex min-h-20 w-full items-center gap-4 rounded-2xl border-2 border-line-strong bg-white p-4 text-left hover:border-pine">
            <span className="text-4xl">🪪</span>
            <span><span className="block text-xl font-bold">{t("vPathId")}</span><span className="text-base text-muted">≈ {t("vPathIdTime")}</span></span>
          </button>
          <button onClick={() => setStep("partner")} className="flex min-h-20 w-full items-center gap-4 rounded-2xl border-2 border-line-strong bg-white p-4 text-left hover:border-pine">
            <span className="text-4xl">🤝</span>
            <span><span className="block text-xl font-bold">{t("vPathPartner")}</span><span className="text-base text-muted">{t("vPathPartnerSub")}</span></span>
          </button>
        </div>
      )}

      {step === "details" && (
        <div className="mt-5 space-y-4">
          {isDemo && <button onClick={demoFill} className="min-h-11 rounded-full bg-pine-soft px-4 text-base font-semibold text-pine">✨ {t("vDemoFill")}</button>}
          <label className={lbl}>{t("vLegalFirst")}<input value={f.first} onChange={(e) => set({ first: e.target.value })} autoComplete="off" className={big} /></label>
          <label className={lbl}>{t("vLegalLast")}<input value={f.last} onChange={(e) => set({ last: e.target.value })} autoComplete="off" className={big} /></label>
          <label className={lbl}>{t("vDob")}<input type="date" value={f.dob} onChange={(e) => set({ dob: e.target.value })} className={big} /></label>
          <label className={lbl}>{t("vPhone")}<input type="tel" inputMode="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} autoComplete="off" className={big} /></label>
          <label className={lbl}>{t("vZip")}<input inputMode="numeric" maxLength={5} value={f.zip} onChange={(e) => set({ zip: e.target.value.replace(/\D/g, "") })} autoComplete="off" className={big} /></label>
        </div>
      )}

      {step === "tax" && (
        <div className="mt-5">
          <label className={lbl} htmlFor="last4">{t("vTaxLabel")}</label>
          <div className="mt-1 flex gap-2">
            <input
              id="last4"
              type={showTax ? "text" : "password"}
              inputMode="numeric"
              maxLength={4}
              autoComplete="off"
              value={f.last4}
              onChange={(e) => set({ last4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              className={`${big} mt-0 flex-1 tracking-[0.5em]`}
            />
            <button onClick={() => setShowTax(!showTax)} aria-pressed={showTax} className="min-h-14 rounded-2xl border-2 border-line-strong bg-white px-4 text-base font-semibold">
              {showTax ? "🙈" : "👁"} {showTax ? t("vHide") : t("vShow")}
            </button>
          </div>
          {isDemo && !f.last4 && <button onClick={() => set({ last4: "0000" })} className="mt-3 min-h-11 rounded-full bg-pine-soft px-4 text-base font-semibold text-pine">✨ {t("vDemoFill")}</button>}
        </div>
      )}

      {step === "photo" && (
        <div className="mt-5 space-y-4">
          <fieldset>
            <legend className={lbl}>{t("vIdType")}</legend>
            <div className="mt-2 grid gap-2">
              {ID_TYPES.map((k) => (
                <label key={k} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 ${f.idType === k ? "border-pine bg-pine-soft" : "border-line-strong bg-white"}`}>
                  <input type="radio" name="idtype" checked={f.idType === k} onChange={() => set({ idType: k })} className="h-6 w-6 accent-pine" />
                  <span className="text-lg">{t(k)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            {(["front", "back"] as const).map((side) => (
              <button
                key={side}
                // Drop zone is decorative: no file is read or uploaded.
                onClick={() => set({ [side]: true })}
                className={`flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-3 ${f[side] ? "border-pine bg-pine-soft" : "border-line-strong bg-white hover:border-pine"}`}
              >
                <span className="text-base font-semibold">{side === "front" ? t("vFront") : t("vBackSide")}</span>
                {f[side] ? (
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-pine">📎 {side}.jpg ✓</span>
                ) : (
                  <span className="text-sm text-muted">📷 {t("vTapUpload")}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "selfie" && (
        <div className="mt-6 flex flex-col items-center gap-5">
          <div className={`grid h-64 w-52 place-items-center rounded-[50%] border-4 border-dashed ${f.selfie ? "border-pine bg-pine-soft" : capturing ? "animate-pulse border-pine" : "border-line-strong bg-white"}`}>
            <span className="text-7xl" aria-hidden>{f.selfie ? "✅" : "🙂"}</span>
          </div>
          {f.selfie ? (
            <p className="text-xl font-semibold text-pine">✓ {t("vSelfieDone")}</p>
          ) : (
            <button
              disabled={capturing}
              // No camera access: a fake 2-second capture.
              onClick={() => { setCapturing(true); setTimeout(() => { setCapturing(false); set({ selfie: true }); }, 2000); }}
              className={`${cta} max-w-xs`}
            >
              📸 {capturing ? t("vCapturing") : t("vTakeSelfie")}
            </button>
          )}
        </div>
      )}

      {step === "consent" && (
        <div className="mt-5 space-y-4">
          <label className="flex min-h-14 cursor-pointer items-start gap-4 rounded-2xl border-2 border-line-strong bg-white p-4">
            <input type="checkbox" checked={f.consent} onChange={(e) => set({ consent: e.target.checked })} className="mt-1 h-7 w-7 shrink-0 accent-pine" />
            <span className="text-xl font-semibold text-ink">{t("vConsentBox")}</span>
          </label>
          <p className="rounded-2xl bg-pine-soft p-4 text-lg text-pine">ℹ️ {t("vConsentNote")}</p>
        </div>
      )}

      {step === "checking" && (
        <ul className="mt-6 space-y-3" aria-live="polite">
          {CHECKS.map((k, i) => (
            <li key={k} className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 text-xl transition ${i < checked ? "border-pine bg-pine-soft text-pine" : i === checked ? "animate-pulse border-line-strong bg-white text-muted" : "border-line-strong bg-white text-faint"}`}>
              <span aria-hidden>{i < checked ? "✓" : "…"}</span> {t(k)}
            </li>
          ))}
        </ul>
      )}

      {step === "partner" && (
        <div className="mt-5 space-y-4">
          <div className="grid gap-2">
            {PARTNERS.map((p) => (
              <label key={p} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 ${f.partner === p ? "border-pine bg-pine-soft" : "border-line-strong bg-white"}`}>
                <input type="radio" name="partner" checked={f.partner === p} onChange={() => set({ partner: p })} className="h-6 w-6 accent-pine" />
                <span className="text-lg">🤝 {p}</span>
              </label>
            ))}
          </div>
          <label className={lbl}>{t("vReferral")}
            <input value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase().slice(0, 12) })} placeholder="DEMO-1234" autoComplete="off" className={`${big} font-mono`} />
          </label>
          <button disabled={!f.partner || f.code.length < 4} onClick={() => setStep("confirming")} className={cta}>{t("vNext")} →</button>
        </div>
      )}

      {step === "confirming" && (
        <div className="mt-10 flex justify-center" aria-live="polite">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-pine-soft border-t-pine" />
        </div>
      )}

      {step === "done" && (
        <div className="mt-6 space-y-4 text-center">
          <div className="text-6xl">🎉</div>
          <div className="mx-auto max-w-sm rounded-2xl border border-line-strong bg-white p-4 text-left">
            <span className="inline-flex items-center gap-1 rounded-full bg-pine-soft px-2 py-0.5 text-sm font-semibold text-pine">✓ {t("verified")}</span>
            <p className="mt-2 font-semibold text-ink">{user?.name}</p>
          </div>
          <Link href="/me" className={cta}>👤 {t("vToProfile")}</Link>
          {listingId && <Link href={`/explore?live=${listingId}`} className="flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-pine px-5 text-xl font-bold text-pine">🗺️ {t("vToMap")}</Link>}
        </div>
      )}

      {aIndex >= 0 && (
        <button disabled={!canNext[step]} onClick={next} className={`${cta} mt-8`}>
          {step === "consent" ? `🔒 ${t("vStartCheck")}` : `${t("vNext")} →`}
        </button>
      )}
      {step === "choose" && <button onClick={() => router.back()} className="mt-6 text-base text-muted underline">← {t("vBack")}</button>}
    </main>
  );
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <Suspense>
        <Flow />
      </Suspense>
    </div>
  );
}
