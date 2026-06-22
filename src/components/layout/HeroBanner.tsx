import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";
import BannerCountdown from "./BannerCountdown";

const GAZI_KOSUSU_TARGET = "2026-06-28T17:15:00+03:00";

export default async function HeroBanner() {
  const session = await auth();
  const isLoggedIn = !!session?.user;
  const isGaziUpcoming = Date.now() < new Date(GAZI_KOSUSU_TARGET).getTime();

  const bannerImage = (
    <Image
      src="/gazi%20banner.png"
      alt="ROTAGANYAN — Analiz · Tahmin · Strateji"
      width={2170}
      height={725}
      className="w-full h-auto"
      priority
    />
  );

  return (
    <div className="w-full">
      <div className="relative w-full">
        {/* Banner görseli — geri sayım bitene kadar Gazi Koşusu sayfasına bağlı */}
        {isGaziUpcoming ? (
          <Link href="/gazi-kosusu" className="block">
            {bannerImage}
          </Link>
        ) : (
          bannerImage
        )}

        {/* 100. Gazi Koşusu geri sayım — ROTAGANYAN yazısının üzerinde */}
        <div className="absolute left-[34%] top-[5%] -translate-x-1/2 flex flex-col items-center gap-1 sm:left-[33%] sm:top-[6%]">
          {isGaziUpcoming && (
            <Link
              href="/gazi-kosusu"
              className="text-[9px] font-semibold uppercase tracking-wide text-brand hover:underline sm:text-xs"
            >
              Gaziye Doğru →
            </Link>
          )}
          <BannerCountdown target={GAZI_KOSUSU_TARGET} />
        </div>

        {/* Butonlar — sadece giriş yapmamış ziyaretçilere */}
        {!isLoggedIn && (
          <div className="absolute bottom-[6%] right-[3%] flex items-center gap-1.5 sm:bottom-[12%] sm:right-[5%] sm:gap-3">
            <Link
              href="/giris"
              className="rounded-md border border-white/50 bg-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 sm:px-5 sm:py-2.5 sm:text-sm"
            >
              Giriş Yap
            </Link>
            <Link
              href="/kayit"
              className="rounded-md px-2.5 py-1.5 text-[10px] font-semibold text-white transition sm:px-5 sm:py-2.5 sm:text-sm"
              style={{ background: "linear-gradient(135deg,#c8971e,#e0b84a)" }}
            >
              Kayıt Ol
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
