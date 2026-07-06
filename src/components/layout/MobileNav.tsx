"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Bookmark, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

type FollowedHorse = { horseName: string; note?: string | null };
type Props = { isLoggedIn?: boolean; followedHorses?: FollowedHorse[] };

export default function MobileNav({ isLoggedIn, followedHorses = [] }: Props) {
  const [horsesOpen, setHorsesOpen] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Menü</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <SheetHeader>
          <SheetTitle className="text-left text-lg font-bold">
            ROTA<span className="text-brand">GANYAN</span>
          </SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-1">
          <Link
            href="/program"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Yarış Programı
          </Link>
          <Link
            href="/tahmin-onerileri"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Banko Önerileri
          </Link>

          {isLoggedIn && followedHorses.length > 0 && (
            <div className="border-t pt-3 pb-1">
              <button
                onClick={() => setHorsesOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <span className="flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-brand" />
                  Takip Atlarım
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
                    Tümünü gör →
                  </Link>
                </div>
              )}
            </div>
          )}

          <div className="border-t pt-4">
            {isLoggedIn ? (
              <>
                <Link
                  href="/panel"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  Panelim
                </Link>
                <button
                  onClick={() => { setOpen(false); signOut({ callbackUrl: "/" }); }}
                  className="w-full rounded-md px-3 py-2.5 text-left text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  Çıkış Yap
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/giris"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  Giriş Yap
                </Link>
                <Link
                  href="/kayit"
                  onClick={() => setOpen(false)}
                  className="mt-1 block rounded-md bg-brand px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand/90"
                >
                  Kayıt Ol
                </Link>
              </>
            )}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
