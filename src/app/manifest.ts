import type { MetadataRoute } from "next";

// PWA manifest — kullanıcı talebi 2026-08-03: "bu site gibi bende web app olarak sitenin
// indirilebilmesini istiyorum" (dedeanaliz.com'un "Uygulamayı yükle" uyarısı örnek
// gösterildi). Next.js App Router bu dosyayı otomatik olarak /manifest.webmanifest'te
// sunar ve <link rel="manifest"> etiketini kendisi ekler, ayrı bir bağlama gerekmiyor.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ROTAGANYAN",
    short_name: "ROTAGANYAN",
    description: "At yarışı analiz ve tahmin platformu",
    start_url: "/",
    display: "standalone",
    background_color: "#0F1B29",
    theme_color: "#0F1B29",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
