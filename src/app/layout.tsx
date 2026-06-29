import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Barlow_Condensed } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import SessionProvider from "@/components/providers/SessionProvider";
import VersionWatcher from "@/components/layout/VersionWatcher";
import ScrollToTopButton from "@/components/layout/ScrollToTopButton";
import { auth } from "@/lib/auth";
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

export const metadata: Metadata = {
  title: {
    default: "ROTAGANYAN — At Yarışı Analiz Platformu",
    template: "%s | ROTAGANYAN",
  },
  description:
    "Veri odaklı, şeffaf at yarışı analizleri. Pedigri, galop ve istatistik tabanlı rasyonel tahminler.",
  keywords: ["at yarışı", "analiz", "tahmin", "pedigri", "galop", "TJK"],
  authors: [{ name: "ROTAGANYAN" }],
  metadataBase: new URL(BASE_URL),
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "ROTAGANYAN",
    images: [{ url: "/logo.png", width: 400, height: 400, alt: "ROTAGANYAN" }],
  },
  twitter: {
    card: "summary",
    images: ["/logo.png"],
  },
  icons: {
    icon: "/logo.png?v=3",
    apple: "/logo.png?v=3",
  },
  robots: { index: true, follow: true },
};

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

  return (
    <html lang="tr" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${barlowCondensed.variable} antialiased min-h-screen bg-background text-foreground`}
        suppressHydrationWarning
      >
        <SessionProvider session={session}>
          <TooltipProvider>
            {children}
            <Toaster richColors position="bottom-right" />
            <VersionWatcher />
            <ScrollToTopButton />
          </TooltipProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
