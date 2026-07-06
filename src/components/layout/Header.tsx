import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import MobileNav from "./MobileNav";
import HeaderUserMenu from "./HeaderUserMenu";
import LiveTvPlayer from "@/components/home/LiveTvPlayer";
import NotificationBell from "./NotificationBell";

export default async function Header() {
  const session = await auth();
  const user = session?.user;

  const followedHorses = user?.id
    ? await db.horseFollow.findMany({
        where: { userId: user.id },
        select: { horseName: true, note: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="text-base font-bold tracking-tight leading-none">
            <span className="text-white">ROTA</span>
            <span
              style={{
                background:
                  "linear-gradient(90deg,#5b9bd5 0%,#a8c8e8 30%,#e4ddc8 50%,#d4b45a 65%,#c8971e 85%,#b8820a 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              GANYAN
            </span>
          </span>
        </Link>

        {/* Hızlı erişim */}
        <nav className="hidden flex-1 items-center gap-2 md:flex">
          <Button asChild size="sm" className="bg-brand hover:bg-brand/90 text-brand-foreground">
            <Link href="/program">Yarış Programı</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/rotaganyanpuantablosu">Rotaganyan Puan Tablosu</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/altili">Altılı Ne Verir?</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/tahmin-onerileri">Banko Önerileri</Link>
          </Button>
          <LiveTvPlayer compact />
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {user && <NotificationBell />}
          {user ? (
            <HeaderUserMenu name={user.name} email={user.email} role={user.role} />
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
                <Link href="/giris">Giriş Yap</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="hidden bg-brand hover:bg-brand/90 text-brand-foreground md:inline-flex"
              >
                <Link href="/kayit">Kayıt Ol</Link>
              </Button>
            </>
          )}
          <MobileNav isLoggedIn={!!user} followedHorses={followedHorses} />
        </div>
      </div>
    </header>
  );
}
