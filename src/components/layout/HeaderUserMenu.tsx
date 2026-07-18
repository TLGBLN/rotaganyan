"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { User, LayoutDashboard, LogOut, ShieldCheck, Bookmark } from "lucide-react";

type Props = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

export default function HeaderUserMenu({ name, email, role }: Props) {
  const isEditor = role === "EDITOR" || role === "ADMIN";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <User className="h-3.5 w-3.5" />
          <span className="hidden max-w-40 truncate sm:block">Hoşgeldin, {name ?? email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium">{name ?? "—"}</p>
          <p className="text-[10px] text-muted-foreground truncate">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/panel">
            <LayoutDashboard className="mr-2 h-3.5 w-3.5" />
            Panelim
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/panel/takip-atlarim">
            <Bookmark className="mr-2 h-3.5 w-3.5" />
            Takip Atlarım
          </Link>
        </DropdownMenuItem>
        {isEditor && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheck className="mr-2 h-3.5 w-3.5" />
              Admin Panel
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-miss focus:text-miss"
        >
          <LogOut className="mr-2 h-3.5 w-3.5" />
          Çıkış Yap
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
