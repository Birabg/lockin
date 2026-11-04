"use client";

import { useEffect } from "react";
import { markNotificationsRead } from "@/app/actions/social";

/** Marks everything read a moment after the page shows, so the dots are still visible on arrival. */
export function MarkRead() {
  useEffect(() => {
    const id = setTimeout(() => void markNotificationsRead(), 1500);
    return () => clearTimeout(id);
  }, []);
  return null;
}
