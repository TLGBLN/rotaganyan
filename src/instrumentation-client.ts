import * as Sentry from "@sentry/nextjs";

// DSN ayarlanmadıkça Sentry SDK kendi kendine sessizce devre dışı kalır (resmi davranış) —
// hesap açılıp NEXT_PUBLIC_SENTRY_DSN eklenene kadar bu dosya hiçbir şeyi bozmaz.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
