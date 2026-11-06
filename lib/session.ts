"use client";

import { useEffect, useState } from "react";
import type { User } from "./types";

/** Demo login only: the session is just { userId } in this browser. No passwords, no email sent. */
const KEY = "kolo_session_v2";
const EVT = "kolo-session";
const LEGACY = ["kolo.providerId", "kolo.draft", "kolo.customerId"];

export function getSessionUserId(): string | null {
  try {
    return (JSON.parse(localStorage.getItem(KEY) || "null") as { userId?: string } | null)?.userId ?? null;
  } catch {
    return null;
  }
}

export function setSession(userId: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ userId }));
  } catch {}
  window.dispatchEvent(new Event(EVT));
}

/** Remove every intake draft (all users) from this browser. */
export function clearDrafts() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("kolo.draft")) localStorage.removeItem(k);
  } catch {}
}

export function logout() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  clearDrafts();
  window.dispatchEvent(new Event(EVT));
}

/** One-time cleanup of pre-login state (old provider id, old drafts, old customer id). */
function migrate() {
  try {
    if (localStorage.getItem("kolo.migrated_v2")) return;
    for (const k of LEGACY) localStorage.removeItem(k);
    clearDrafts();
    localStorage.setItem("kolo.migrated_v2", "1");
  } catch {}
}

/** Current user (fetched from the server), kept in sync across components. */
export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    migrate();
    const load = () => {
      const id = getSessionUserId();
      if (!id) {
        setUser(null);
        setReady(true);
        return;
      }
      fetch(`/api/users/${id}`).then(async (r) => {
        if (r.ok) setUser(await r.json());
        else {
          logout(); // stale session (demo data reset)
          setUser(null);
        }
        setReady(true);
      });
    };
    load();
    window.addEventListener(EVT, load);
    return () => window.removeEventListener(EVT, load);
  }, []);
  return { user, ready, setUser };
}

/** Header for owner-checked API calls (mock auth). */
export const authHeaders = (): Record<string, string> => ({ "Content-Type": "application/json", "x-kolo-user": getSessionUserId() || "" });

// Intake drafts are keyed by user + draft id.
export const draftKey = (userId: string, draftId: string) => `kolo.draft.${userId}.${draftId}`;
export function listDrafts(userId: string): string[] {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(`kolo.draft.${userId}.`))
      .map((k) => k.slice(`kolo.draft.${userId}.`.length));
  } catch {
    return [];
  }
}
