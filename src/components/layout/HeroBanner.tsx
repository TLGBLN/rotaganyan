import Image from "next/image";
import { db } from "@/lib/db";
import BannerSlider from "./BannerSlider";

const FALLBACK = { id: "default", url: "/banner-v3.png" };

export default async function HeroBanner() {
  const slides = await db.bannerSlide.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    select: { id: true, url: true },
  });

  if (slides.length === 0) {
    return (
      <div className="w-full">
        <Image
          src={FALLBACK.url}
          alt="ROTAGANYAN — Analiz · Tahmin · Strateji"
          width={2191}
          height={718}
          className="w-full h-auto"
          priority
        />
      </div>
    );
  }

  if (slides.length === 1) {
    return (
      <div className="w-full">
        <Image
          src={slides[0].url}
          alt="ROTAGANYAN — Analiz · Tahmin · Strateji"
          width={2191}
          height={718}
          className="w-full h-auto"
          priority
          unoptimized
        />
      </div>
    );
  }

  return <BannerSlider slides={slides} />;
}
