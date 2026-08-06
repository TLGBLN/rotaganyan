"use client";

import { useEffect } from "react";

/**
 * PWA yüklenebilirliği (kullanıcı talebi 2026-08-03: "bu site gibi bende web app olarak
 * sitenin indirilebilmesini istiyorum") — tarayıcıların "Uygulamayı yükle" istemini
 * gösterebilmesi için bir service worker'ın KAYITLI olması gerekiyor (bkz. public/sw.js —
 * kasıtlı olarak hiçbir şeyi önbelleklemiyor, yalnız yüklenebilirlik kriterini karşılıyor).
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sessizce yut — PWA yüklenemezliği siteyi hiçbir şekilde bozmamalı.
      });
    }
  }, []);

  return null;
}
