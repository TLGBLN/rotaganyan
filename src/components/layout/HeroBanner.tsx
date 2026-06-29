import Image from "next/image";
import Link from "next/link";
import BannerCountdown from "./BannerCountdown";

const GAZI_KOSUSU_TARGET = "2026-06-28T17:15:00+03:00";
// Gazi Koşusu banner'ı 29.06.2026'dan itibaren eski standart banner'a döner.
const GAZI_BANNER_END = "2026-06-29T00:00:00+03:00";

export default function HeroBanner() {
  const now = Date.now();
  const showGaziBanner = now < new Date(GAZI_BANNER_END).getTime();

  if (!showGaziBanner) {
    return (
      <div className="w-full">
        <div className="relative w-full">
          <Image
            src="/banner.png"
            alt="ROTAGANYAN — Analiz · Tahmin · Strateji"
            width={2172}
            height={724}
            className="w-full h-auto"
            priority
          />
        </div>
      </div>
    );
  }

  const isGaziUpcoming = now < new Date(GAZI_KOSUSU_TARGET).getTime();

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
        <div className="absolute left-[34%] top-[5%] -translate-x-1/2 sm:left-[33%] sm:top-[6%]">
          <BannerCountdown target={GAZI_KOSUSU_TARGET} size="sm" />
        </div>

        {/* Gaziye Doğru linki — banner'ın sol alt köşesi */}
        {isGaziUpcoming && (
          <Link
            href="/gazi-kosusu"
            className="absolute bottom-[3%] left-[3%] text-[11px] font-semibold uppercase tracking-wide text-brand hover:underline sm:bottom-[7%] sm:left-[5%] sm:text-sm"
          >
            Gaziye Doğru →
          </Link>
        )}
      </div>
    </div>
  );
}
