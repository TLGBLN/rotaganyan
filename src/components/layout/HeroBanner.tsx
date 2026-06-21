import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";
import BannerCountdown from "./BannerCountdown";

const GAZI_KOSUSU_TARGET = "2026-06-28T17:15:00+03:00";

export default async function HeroBanner() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <div className="w-full">
      <div className="relative w-full">
        {/* Banner görseli */}
        <Image
          src="/gazi%20banner.png"
          alt="ROTAGANYAN — Analiz · Tahmin · Strateji"
          width={2170}
          height={725}
          className="w-full h-auto"
          priority
        />

        {/* 100. Gazi Koşusu geri sayım — ROTAGANYAN yazısının üzerinde */}
        <div className="absolute left-[34%] top-[5%] -translate-x-1/2 sm:left-[33%] sm:top-[6%]">
          <BannerCountdown target={GAZI_KOSUSU_TARGET} />
        </div>

        {/* Butonlar — sadece giriş yapmamış ziyaretçilere */}
        {!isLoggedIn && (
          <div className="absolute bottom-[12%] right-[5%] flex items-center gap-3">
            <Link
              href="/giris"
              className="rounded-md border border-white/50 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              Giriş Yap
            </Link>
            <Link
              href="/kayit"
              className="rounded-md px-5 py-2.5 text-sm font-semibold text-white transition"
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
