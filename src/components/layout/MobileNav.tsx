"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { signOut } from "next-auth/react";

type Props = { isLoggedIn?: boolean };

export default function MobileNav({ isLoggedIn }: Props) {
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
            href="/kosular"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Günün Koşuları
          </Link>
          <Link
            href="/tahmin-onerileri"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Banko Önerileri
          </Link>

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
