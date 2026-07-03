import Image from "next/image";
import { db } from "@/lib/db";

export default async function HeroBanner() {
  const setting = await db.siteSetting.findUnique({ where: { key: "banner_url" } });
  const src = setting?.value ?? "/banner-v3.png";

  const isExternal = src.startsWith("http");

  return (
    <div className="w-full">
      <div className="relative w-full">
        <Image
          src={src}
          alt="ROTAGANYAN — Analiz · Tahmin · Strateji"
          width={2191}
          height={718}
          className="w-full h-auto"
          priority
          unoptimized={isExternal}
        />
      </div>
    </div>
  );
}
