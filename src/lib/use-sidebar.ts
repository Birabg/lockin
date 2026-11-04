"use client";

import { useSyncExternalStore } from "react";
import { SIDEBAR_COLLAPSED, SIDEBAR_COOKIE } from "./sidebar";

const listeners = new Set<() => void>();
let unsaved: string | null = null; // where the choice lives if the browser blocks storage

function saved() {
  try {
    return localStorage.getItem(SIDEBAR_COOKIE) ?? unsaved;
  } catch {
    return unsaved;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function save(collapsed: boolean) {
  const value = collapsed ? SIDEBAR_COLLAPSED : "open";
  unsaved = value;
  try {
    localStorage.setItem(SIDEBAR_COOKIE, value);
  } catch {}
  document.cookie = `${SIDEBAR_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
  listeners.forEach((listener) => listener());
}

/** The browser's saved choice wins. The server's reading of the cookie covers the first paint. */
export function useSidebarCollapsed(initial: boolean) {
  const value = useSyncExternalStore(subscribe, saved, () => null);
  return [value === null ? initial : value === SIDEBAR_COLLAPSED, save] as const;
}
