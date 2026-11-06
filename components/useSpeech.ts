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
 * Tap-to-start / tap-to-stop dictation with live captions.
 * Web Speech recognizes one language per session, so switchLang() restarts
 * recognition in another language and keeps everything said so far.
 */
export function useDictation(defaultLang: string, onUpdate: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState(defaultLang);
  const recRef = useRef<any>(null);
  const textRef = useRef("");
  // True from her tap-to-start until her tap-to-stop. Chrome ends sessions on its own after
  // pauses or ~60s, so while this is set we silently restart and keep her words.
  const wantRef = useRef(false);
  const langRef = useRef(defaultLang);
  useEffect(() => {
    setLang(defaultLang);
    langRef.current = defaultLang;
  }, [defaultLang]);

  function stop() {
    wantRef.current = false;
    const rec = recRef.current;
    recRef.current = null;
    rec?.stop();
    setListening(false);
  }

  function start(prefix = "", useLang = langRef.current) {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    wantRef.current = true;
    langRef.current = useLang;
    window.speechSynthesis?.cancel();
    const rec = new SR();
    rec.lang = useLang;
    rec.interimResults = true;
    rec.continuous = true;
    const base = prefix.trim();
    textRef.current = base;
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      textRef.current = [base, text.trim()].filter(Boolean).join(" ");
      onUpdate(textRef.current);
    };
    rec.onend = () => {
      if (recRef.current !== rec) return;
      recRef.current = null;
      if (wantRef.current) {
        // Chrome stopped by itself: keep going from where she was.
        setTimeout(() => wantRef.current && !recRef.current && start(textRef.current, langRef.current), 150);
      } else {
        setListening(false);
      }
    };
    rec.onerror = (e: any) => {
      // Permission denied or no mic: stop for real instead of looping.
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed" || e?.error === "audio-capture") wantRef.current = false;
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  /** Change recognition language; if recording, continue seamlessly in the new language. */
  function switchLang(next: string, currentText: string) {
    setLang(next);
    langRef.current = next;
    if (recRef.current) {
      const old = recRef.current;
      recRef.current = null;
      old.onresult = null;
      old.stop();
      start(currentText, next);
    }
  }

  return {
    listening,
    lang,
    start,
    stop,
    switchLang,
    toggle: (prefix = "") => (wantRef.current ? stop() : start(prefix)),
  };
}
