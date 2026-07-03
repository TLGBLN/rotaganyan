import Image from "next/image";

export default function HeroBanner() {
  return (
    <div className="w-full">
      <div className="relative w-full">
        <Image
          src="/banner-v3.png"
          alt="ROTAGANYAN — Analiz · Tahmin · Strateji"
          width={2191}
          height={718}
          className="w-full h-auto"
          priority
        />
      </div>
    </div>
  );
}
