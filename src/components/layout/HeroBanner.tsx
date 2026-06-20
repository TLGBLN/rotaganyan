import Image from "next/image";
import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function HeroBanner() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <div className="w-full">
      <div className="relative w-full">
        {/* Banner görseli */}
        <Image
          src="/banner.png"
          alt="ROTAGANYAN — Analiz · Tahmin · Strateji"
          width={3616}
          height={1184}
          className="w-full h-auto"
          priority
        />

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
