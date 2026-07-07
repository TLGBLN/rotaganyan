"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function PageTracker() {
  const pathname = usePathname();
  const viewIdRef = useRef<string | null>(null);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname.startsWith("/api")) return;

    startRef.current = Date.now();
    viewIdRef.current = null;

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
    })
      .then((r) => r.json())
      .then((data: { id?: string }) => {
        viewIdRef.current = data.id ?? null;
      })
      .catch(() => {});

    return () => {
      const id = viewIdRef.current;
      if (!id) return;
      const duration = (Date.now() - startRef.current) / 1000;
      if (duration < 2) return;
      navigator.sendBeacon(
        "/api/track",
        JSON.stringify({ id, duration: Math.round(duration) })
      );
    };
  }, [pathname]);

  useEffect(() => {
    const onHide = () => {
      const id = viewIdRef.current;
      if (!id) return;
      const duration = (Date.now() - startRef.current) / 1000;
      if (duration < 2) return;
      navigator.sendBeacon(
        "/api/track",
        JSON.stringify({ id, duration: Math.round(duration) })
      );
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onHide();
    });
  }, []);

  return null;
}
