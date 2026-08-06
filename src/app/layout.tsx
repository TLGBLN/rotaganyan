import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Barlow_Condensed } from "next/font/google";
import { getLocale, getTranslations } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import SessionProvider from "@/components/providers/SessionProvider";
import LocaleProvider from "@/components/providers/LocaleProvider";
import VersionWatcher from "@/components/layout/VersionWatcher";
import ServiceWorkerRegister from "@/components/layout/ServiceWorkerRegister";
import ScrollToTopButton from "@/components/layout/ScrollToTopButton";
// AiAsistan (bkz. components/layout/AiAsistan.tsx) BİLEREK devre dışı — kullanıcı
// talebi: "not al, devreye alma henüz." Bileşen kodu duruyor, yalnız layout'a
// bağlanmıyor. Kullanıcı hazır olduğunda tek satır (import + <AiAsistan />) ile geri açılır.
import PageTracker from "@/components/layout/PageTracker";
import SplashScreen from "@/components/layout/SplashScreen";
import { auth } from "@/lib/auth";
import type { AppLocale } from "@/i18n/request";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["500", "700", "800", "900"],
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://rotaganyan.com";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("metadata");
  return {
    title: {
      default: t("title"),
      template: "%s | ROTAGANYAN",
    },
    description: t("description"),
    keywords: ["at yarışı", "analiz", "tahmin", "pedigri", "galop", "TJK"],
    authors: [{ name: "ROTAGANYAN" }],
    metadataBase: new URL(BASE_URL),
    openGraph: {
      type: "website",
      locale: locale === "en" ? "en_US" : "tr_TR",
      siteName: "ROTAGANYAN",
      images: [{ url: "/logo.png?v=2", width: 400, height: 400, alt: "ROTAGANYAN" }],
    },
    twitter: {
      card: "summary",
      images: ["/logo.png?v=2"],
    },
    icons: {
      icon: "/logo.png?v=4",
      apple: "/logo.png?v=4",
    },
    robots: { index: true, follow: true },
    // PWA yüklenebilirliği — Next.js src/app/manifest.ts'yi otomatik olarak
    // /manifest.webmanifest'te sunar ve <link rel="manifest"> etiketini ekler.
    manifest: "/manifest.webmanifest",
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F1B29",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const locale = await getLocale();

  return (
    <html lang={locale} className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${barlowCondensed.variable} antialiased min-h-screen bg-background text-foreground`}
        suppressHydrationWarning
      >
        <LocaleProvider initialLocale={locale as AppLocale}>
          <SessionProvider session={session}>
            <TooltipProvider>
              <SplashScreen />
              {children}
              <Toaster richColors position="bottom-right" />
              <VersionWatcher />
              <ServiceWorkerRegister />
              <ScrollToTopButton />
              <PageTracker />
            </TooltipProvider>
          </SessionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
