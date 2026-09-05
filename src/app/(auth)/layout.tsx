import Link from "next/link";
import Image from "next/image";
import Wordmark from "@/components/layout/Wordmark";
import OnlineCounter from "@/components/layout/OnlineCounter";

// 2026-08-24 kullanıcı bulgusu: "zaten giriş yapmışsa engelle" kontrolü buradan
// kaldırıldı — bu layout /sifre-sifirla ve /sifre-sifirla/[token]'ı da kapsıyordu,
// oturumu açık bir kullanıcı şifre sıfırlamak istediğinde form hiç görünmeden
// /panel'e atılıyordu. Kontrol artık yalnız giriş/kayıt sayfalarında (bkz.
// redirectIfLoggedIn, src/lib/auth.ts) uygulanıyor.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Link href="/" className="mb-8 flex flex-col items-center gap-3">
        <Image
          src="/horse-icon-gold.png"
          alt="ROTAGANYAN"
          width={80}
          height={80}
          priority
        />
        <Wordmark className="text-xl" showIcon={false} />
      </Link>
      {/* 2026-09-05 kullanıcı talebi: yeni üye olan kullanıcıların gördüğü ekranlarda
          (giriş/kayıt/kayıt-doğrulama/şifre-sıfırlama — bu layout hepsini kapsıyor) çevrimiçi
          sayacı hiç görünmüyordu, çünkü bu layout paylaşılan Header'ı KULLANMIYOR (kendi sade
          logo ekranı). OnlineCounter kendi kendine yeten bir "use client" bileşen olduğu için
          doğrudan buraya eklenebildi. */}
      <div className="-mt-4 mb-4">
        <OnlineCounter />
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
