"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, LogOut, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import AdminNav from "./AdminNav";

type Props = {
  userName: string | null | undefined;
  userEmail: string | null | undefined;
  unreadCount: number;
};

export default function AdminMobileNav({ userName, userEmail, unreadCount }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Menü</span>
      </Button>
      <SheetContent side="left" className="w-64 border-brand/20 bg-[#0d0d14] p-0">
        <SheetHeader className="border-b border-brand/20">
          <div className="flex items-center justify-between gap-2 pr-7">
            <SheetTitle className="text-left text-sm font-bold text-foreground">
              <Link href="/program" onClick={() => setOpen(false)} className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-brand text-[10px] font-black text-black">
                  A
                </span>
                ROTAGANYAN
              </Link>
            </SheetTitle>
            <Link
              href="/admin/bildirimler"
              onClick={() => setOpen(false)}
              className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-hit px-1 text-[9px] font-bold text-black">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-sm bg-brand/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-brand">
              Admin
            </span>
            <span className="text-[10px] text-muted-foreground">Kontrol Paneli</span>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          <AdminNav onNavigate={() => setOpen(false)} />
        </div>
        <div className="border-t border-brand/20 p-3">
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/20 text-[10px] font-bold text-brand">
              {userName?.[0]?.toUpperCase() ?? "A"}
            </div>
            <p className="truncate text-xs font-medium text-foreground">{userName ?? "Admin"}</p>
          </div>
          <p className="truncate text-[10px] text-muted-foreground">{userEmail}</p>
          <Link
            href="/api/auth/signout"
            onClick={() => setOpen(false)}
            className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-3 w-3" /> Çıkış Yap
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
