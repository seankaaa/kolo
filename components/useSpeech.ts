"use client";

import { useRef, useState } from "react";

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
 * onUpdate receives the full transcript so far (final + interim) while she speaks.
 */
export function useDictation(lang: string, onUpdate: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  function stop() {
    recRef.current?.stop();
  }

  function start(prefix = "") {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    window.speechSynthesis?.cancel();
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      onUpdate((prefix ? prefix + " " : "") + text.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return { listening, start, stop, toggle: (prefix?: string) => (listening ? stop() : start(prefix)) };
}
