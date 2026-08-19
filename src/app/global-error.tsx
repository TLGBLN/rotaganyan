"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

// Kök layout'un KENDİSİ çökerse devreye girer (error.tsx bunu yakalayamaz, o yalnız
// route segment'leri içindeki hataları yakalar) — bu yüzden kendi <html>/<body>'sini
// kurmak zorunda, normal layout'a güvenemez.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="tr">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
