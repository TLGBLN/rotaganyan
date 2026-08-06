import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSameTurkeyDay } from "@/lib/tz";
import { getTodaysFollowedRaces } from "@/server/actions/horse-follow";
import { Button } from "@/components/ui/button";
import MobileNav from "./MobileNav";
import HeaderUserMenu from "./HeaderUserMenu";
import LiveTvPlayer from "@/components/home/LiveTvPlayer";
import NotificationBell from "./NotificationBell";
import IntroTour from "./IntroTour";
import FollowedHorsesPopup from "./FollowedHorsesPopup";
import OnlineCounter from "./OnlineCounter";
import Wordmark from "./Wordmark";
import LocaleToggle from "./LocaleToggle";
import HeaderLabel from "./HeaderLabel";

export default async function Header() {
  const session = await auth();
  const user = session?.user;

  const [followedHorses, dbUser, todaysFollowedRaces] = await Promise.all([
    user?.id
      ? db.horseFollow.findMany({
          where: { userId: user.id },
          select: { horseName: true, note: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    user?.id ? db.user.findUnique({ where: { id: user.id }, select: { hasSeenIntro: true, followPopupShownAt: true } }) : Promise.resolve(null),
    user?.id ? getTodaysFollowedRaces() : Promise.resolve([]),
  ]);
  const showIntroTour = !!user && dbUser?.hasSeenIntro === false;
  // Takip edilen atlar bugün koşuyorsa girişte bir kez popup — aynı gün içinde tekrar
  // gösterilmez (followPopupShownAt), ertesi gün yeniden koşulan bir at varsa tekrar açılır.
  const showFollowPopup =
    !!user &&
    todaysFollowedRaces.length > 0 &&
    (!dbUser?.followPopupShownAt || !isSameTurkeyDay(dbUser.followPopupShownAt, new Date()));

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 print:hidden">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
        {/* Logo */}
        <Link href="/program" className="flex shrink-0 items-center gap-2.5">
          <Wordmark />
        </Link>

        {/* Hızlı erişim */}
        <nav className="hidden flex-1 items-center gap-2 md:flex">
          <Button asChild size="sm" className="bg-brand hover:bg-brand/90 text-brand-foreground">
            <Link href="/program" data-tour="program"><HeaderLabel k="program" /></Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/rotaganyansiralamasi" data-tour="puantablosu"><HeaderLabel k="puanTablosu" /></Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/altili" data-tour="altili"><HeaderLabel k="altiliNeVerir" /></Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/tahmin-onerileri" data-tour="banko"><HeaderLabel k="bankoOnerileri" /></Link>
          </Button>
          <LiveTvPlayer compact />
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <OnlineCounter />
          {user && <span data-tour="bildirim"><NotificationBell /></span>}
          {user ? (
            <span data-tour="hesap"><HeaderUserMenu name={user.name} email={user.email} role={user.role} /></span>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
                <Link href="/giris"><HeaderLabel k="girisYap" /></Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="hidden bg-brand hover:bg-brand/90 text-brand-foreground md:inline-flex"
              >
                <Link href="/kayit"><HeaderLabel k="kayitOl" /></Link>
              </Button>
            </>
          )}
          {/* Dar mobil ekranlarda bildirim/hesap/hamburger ile birlikte sıkışıyordu —
              mobilde dil seçimi artık MobileNav sheet'i içinde bir kart olarak yer alıyor. */}
          <div className="hidden md:block">
            <LocaleToggle />
          </div>
          <MobileNav isLoggedIn={!!user} followedHorses={followedHorses} />
        </div>
      </div>
      {showIntroTour && <IntroTour />}
      {showFollowPopup && <FollowedHorsesPopup races={todaysFollowedRaces} />}
    </header>
  );
}
