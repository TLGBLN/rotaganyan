import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import AdminNav from "@/components/admin/AdminNav";
import AdminMobileNav from "@/components/admin/AdminMobileNav";
import { hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";
import { LogOut, Bell } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/giris");
  if (!hasRole(session.user.role as Role, "EDITOR")) redirect("/");

  const unreadCount = await db.notification.count({
    where: { userId: session.user.id, read: false },
  });

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-brand/20 bg-[#0d0d14] lg:flex lg:flex-col">
        <div className="border-b border-brand/20 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-brand text-[10px] font-black text-black">
                A
              </div>
              <Link href="/" className="text-sm font-bold tracking-wide text-foreground">
                ROTAGANYAN
              </Link>
            </div>
            <Link
              href="/panel/bildirimler"
              className="relative flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-hit px-1 text-[9px] font-bold text-black">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="rounded-sm bg-brand/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-brand">
              Admin
            </span>
            <span className="text-[10px] text-muted-foreground">Kontrol Paneli</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <AdminNav />
        </div>
        <div className="border-t border-brand/20 p-3">
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/20 text-[10px] font-bold text-brand">
              {session.user.name?.[0]?.toUpperCase() ?? "A"}
            </div>
            <p className="truncate text-xs font-medium text-foreground">{session.user.name ?? "Admin"}</p>
          </div>
          <p className="truncate text-[10px] text-muted-foreground">{session.user.email}</p>
          <Link
            href="/api/auth/signout"
            className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-3 w-3" /> Çıkış Yap
          </Link>
        </div>
      </aside>

      {/* Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex items-center justify-between border-b border-brand/20 bg-[#0d0d14] px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <span className="rounded-sm bg-brand/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-brand">Admin</span>
            <Link href="/" className="text-sm font-bold text-foreground">ROTAGANYAN</Link>
          </div>
          <AdminMobileNav userName={session.user.name} userEmail={session.user.email} />
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
