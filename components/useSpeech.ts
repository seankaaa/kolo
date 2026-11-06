"use client";

import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function speechSupported() {
  return typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

/** Minimal Web Speech API wrapper: start() listens once and calls onText with the final transcript. */
export function useSpeech(lang: string, onText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  function start() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      const text = Array.from(e.results).map((r: any) => r[0].transcript).join(" ");
      if (text.trim()) onText(text.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return { listening, start };
}

export function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  window.speechSynthesis.speak(u);
}

/**
 * Tap-to-start / tap-to-stop dictation with live captions, built for long answers.
 *
 * Chrome's Web Speech ends sessions on its own (pauses, ~60s limit, "no-speech",
 * "network", "aborted"). While she hasn't tapped stop, we restart immediately and keep
 * every word. Only a denied mic permission stops for good. Web Speech recognizes one
 * language at a time, so switchLang() restarts in another language, keeping her words.
 */
export function useDictation(defaultLang: string, onUpdate: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState(defaultLang);
  const [status, setStatus] = useState(""); // last recognition event, shown small for debugging
  const recRef = useRef<any>(null);
  const textRef = useRef("");
  const wantRef = useRef(false);
  const langRef = useRef(defaultLang);
  const restartsRef = useRef<number[]>([]);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    setLang(defaultLang);
    langRef.current = defaultLang;
  }, [defaultLang]);
  useEffect(() => () => { wantRef.current = false; recRef.current?.abort?.(); }, []);

  function stop() {
    wantRef.current = false;
    const rec = recRef.current;
    recRef.current = null;
    try { rec?.stop(); } catch {}
    setListening(false);
    setStatus("");
  }

  function begin(useLang: string) {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = useLang;
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    const base = textRef.current.trim();
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      textRef.current = [base, text.trim()].filter(Boolean).join(" ");
      onUpdateRef.current(textRef.current);
    };
    rec.onerror = (e: any) => {
      const code = e?.error || "error";
      console.warn("[kolo-mic] error:", code);
      setStatus(code);
      if (code === "not-allowed" || code === "service-not-allowed") wantRef.current = false;
    };
    rec.onend = () => {
      if (recRef.current !== rec) return;
      recRef.current = null;
      if (!wantRef.current) {
        setListening(false);
        return;
      }
      // Never give up on our own; just back off if Chrome keeps ending instantly
      // (e.g. the mic is busy in another app). Only her tap or a denied permission stops it.
      const now = Date.now();
      restartsRef.current = [...restartsRef.current.filter((t) => now - t < 5000), now];
      const delay = restartsRef.current.length > 6 ? 1000 : 0;
      if (delay) setStatus("reconnecting");
      setTimeout(() => wantRef.current && !recRef.current && begin(langRef.current), delay);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (err) {
      console.warn("[kolo-mic] start failed:", err);
      recRef.current = null;
      setTimeout(() => wantRef.current && !recRef.current && begin(langRef.current), 300);
    }
  }

  function start(prefix = "", useLang = langRef.current) {
    window.speechSynthesis?.cancel();
    wantRef.current = true;
    langRef.current = useLang;
    textRef.current = prefix.trim();
    restartsRef.current = [];
    setStatus("");
    begin(useLang);
  }

  /**
   * Change recognition language mid-recording. We let the current session finish
   * (so its last words land), and onend restarts in the new language. Starting a new
   * session while the old one is still alive is silently rejected by Chrome.
   */
  function switchLang(next: string, _currentText?: string) {
    void _currentText;
    setLang(next);
    langRef.current = next;
    setStatus("");
    const rec = recRef.current;
    if (wantRef.current && rec) {
      try { rec.stop(); } catch { /* onend will still fire */ }
    }
  }

  return {
    listening,
    lang,
    status,
    start,
    stop,
    switchLang,
    toggle: (prefix = "") => (wantRef.current ? stop() : start(prefix)),
  };
}
