"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Menu, Bookmark, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import LocaleToggle from "./LocaleToggle";

type FollowedHorse = { horseName: string; note?: string | null };
type Props = { isLoggedIn?: boolean; followedHorses?: FollowedHorse[] };

export default function MobileNav({ isLoggedIn, followedHorses = [] }: Props) {
  const t = useTranslations("mobileNav");
  const [horsesOpen, setHorsesOpen] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">{t("menu")}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <SheetHeader>
          <SheetTitle className="text-left text-lg font-bold">
            <Link href="/program" onClick={() => setOpen(false)}>
              ROTA<span className="text-brand">GANYAN</span>
            </Link>
          </SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-1">
          <Link
            href="/program"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {t("program")}
          </Link>
          <Link
            href="/rotaganyansiralamasi"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {t("puanTablosu")}
          </Link>
          <Link
            href="/altili"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {t("altiliNeVerir")}
          </Link>
          <Link
            href="/tahmin-onerileri"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {t("bankoOnerileri")}
          </Link>

          {isLoggedIn && followedHorses.length > 0 && (
            <div className="border-t pt-3 pb-1">
              <button
                onClick={() => setHorsesOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <span className="flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-brand" />
                  {t("takipAtlarim")}
                  <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                    {followedHorses.length}
                  </span>
                </span>
                {horsesOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>

              {horsesOpen && (
                <div className="ml-3 mt-1 border-l pl-3 space-y-0.5">
                  {followedHorses.map((h) => (
                    <div key={h.horseName} className="py-1.5">
                      <p className="text-sm font-medium">{h.horseName}</p>
                      {h.note && (
                        <p className="text-[11px] text-muted-foreground">{h.note}</p>
                      )}
                    </div>
                  ))}
                  <Link
                    href="/panel/takip-atlarim"
                    onClick={() => setOpen(false)}
                    className={cn(
                      "mt-1 block rounded-md px-2 py-1.5 text-xs font-medium text-brand hover:bg-brand/10"
                    )}
                  >
                    {t("tumunuGor")}
                  </Link>
                </div>
              )}
            </div>
          )}

          <div className="border-t pt-4 pb-3">
            <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2.5">
              <span className="text-sm font-medium text-muted-foreground">{t("dil")}</span>
              <LocaleToggle />
            </div>
          </div>

          <div className="border-t pt-4">
            {isLoggedIn ? (
              <>
                <Link
                  href="/panel"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  {t("panelim")}
                </Link>
                <button
                  onClick={() => { setOpen(false); signOut({ callbackUrl: "/" }); }}
                  className="w-full rounded-md px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  {t("cikisYap")}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/giris"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  {t("girisYap")}
                </Link>
                <Link
                  href="/kayit"
                  onClick={() => setOpen(false)}
                  className="mt-1 block rounded-md bg-brand px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand/90"
                >
                  {t("kayitOl")}
                </Link>
              </>
            )}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
