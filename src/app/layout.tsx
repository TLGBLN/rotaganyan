import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono, Barlow_Condensed } from "next/font/google";
import localFont from "next/font/local";
import { getLocale, getTranslations } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import SessionProvider from "@/components/providers/SessionProvider";
import LocaleProvider from "@/components/providers/LocaleProvider";
import ThemeProvider from "@/components/providers/ThemeProvider";
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

// 2026-09-17 kullanıcı kararı (İKİ AŞAMALI): önce Computer Modern Roman denendi (sitewide),
// ama gerçek tarayıcıda render sorunları netleşmeden ("Georgia/Inter gibi görünüyor")
// önce bir CSS scope bug'ı bulunup düzeltildi, sonra kullanıcı pratik/güvenilirlik
// gerekçesiyle Roman denemesinden TAMAMEN vazgeçip Inter'e geçmeye karar verdi — yalnız
// matematiksel formül/skor gösterimi Computer Modern Math Italic olarak KALDI (KaTeX'in
// "KaTeX_Math-Italic" fontu, LaTeX'in cmmi10'unun web karşılığı, MIT lisanslı).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const cmMathItalic = localFont({
  variable: "--font-cm-math-italic",
  src: "../../public/fonts/CMMathItalic.woff2",
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
  // 2026-09-11 — açık/koyu tema seçimiyle birlikte tarayıcı çubuğu rengi de OS
  // tercihine göre iki değer alıyor (next-themes'in class'ı ile birebir senkron
  // değil ama pratikte örtüşüyor, varsayılan zaten koyu).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F5F1" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1B29" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      // 2026-09-17 BUG DÜZELTMESİ (genel next/font+Tailwind v4 kuralı, hâlâ geçerli):
      // next/font'un ürettiği --font-* değişkenleri eskiden yalnız <body>'de tanımlıydı —
      // ama Tailwind v4 --font-sans/--default-font-family'i :root (yani <html>) seviyesinde
      // tanımlıyor. CSS custom property'ler TANIMLANDIĞI elementte çözümlenir: :root'taki
      // "var(--font-...)" referansı :root'ta bu değişken YOK diye GEÇERSİZ oluyor, bu
      // geçersizlik <body>'ye miras kalıyor — sonuç Tailwind'in kendi yedek sans-serif
      // yığınına düşülmesi. Font değişkenleri bu yüzden <html>'de tanımlanıyor —
      // --font-sans'ın tanımlandığı AYNI element.
      className={`${inter.variable} ${cmMathItalic.variable} ${geistMono.variable} ${barlowCondensed.variable}`}
      suppressHydrationWarning
    >
      <body
        className="antialiased min-h-screen bg-background text-foreground"
        suppressHydrationWarning
      >
        <ThemeProvider>
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
        </ThemeProvider>
      </body>
    </html>
  );
}
