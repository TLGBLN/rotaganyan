"use client";

import { useEffect, useRef } from "react";

const CHECK_INTERVAL_MS = 60_000;

async function fetchBuildId(): Promise<string | null> {
  try {
    const res = await fetch("/api/build-info", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.buildId ?? null;
  } catch {
    return null;
  }
}

/**
 * Yeni bir deploy çıktığında açık sekmeleri otomatik yeniler — ziyaretçiler
 * eski sürümü görmek için elle hard-refresh yapmak zorunda kalmasın.
 */
export default function VersionWatcher() {
  const initialBuildId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchBuildId().then((id) => {
      if (!cancelled) initialBuildId.current = id;
    });

    const interval = setInterval(async () => {
      const current = await fetchBuildId();
      if (
        !cancelled &&
        current &&
        initialBuildId.current &&
        current !== initialBuildId.current &&
        document.visibilityState === "visible"
      ) {
        window.location.reload();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return null;
}
