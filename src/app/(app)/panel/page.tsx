import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Star } from "lucide-react";
import type { Role, Plan } from "@prisma/client";

export const dynamic = "force-dynamic";

const PLAN_LABEL: Record<Plan, string> = { FREE: "Ücretsiz", PREMIUM: "Premium" };
const ROLE_LABEL: Record<Role, string> = { USER: "Üye", EDITOR: "Editör", ADMIN: "Admin" };

export default async function PanelPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [notifications, followedHorses] = await Promise.all([
    db.notification.findMany({
      where: { userId: session.user.id, read: false },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.horseFollow.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, plan: true, role: true, createdAt: true },
  });
  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* User card */}
      <div className="rounded-lg border p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold">{user.name ?? "—"}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex gap-1.5">
            <Badge variant="outline">{PLAN_LABEL[user.plan]}</Badge>
            <Badge variant="secondary">{ROLE_LABEL[user.role]}</Badge>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Üyelik tarihi: {format(new Date(user.createdAt), "d MMMM yyyy", { locale: tr })}
        </p>
      </div>

      {/* Notifications preview */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Bildirimler</h2>
          <Link href="/panel/bildirimler" className="text-xs text-brand hover:underline">
            Tümü →
          </Link>
        </div>
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">Okunmamış bildirim yok.</p>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-2 rounded-lg border p-3">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                <div>
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {format(new Date(n.createdAt), "d MMM HH:mm", { locale: tr })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Takip Listem */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            Takip Listem
          </h2>
          <Link href="/panel/takip-atlarim" className="text-xs text-brand hover:underline">
            Tümünü gör →
          </Link>
        </div>
        {followedHorses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Henüz takip ettiğin at yok. Yarış programında atlara tıklayarak takibe alabilirsin.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {followedHorses.map((h) => (
              <div
                key={h.id}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
              >
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 shrink-0" />
                <span className="font-medium">{h.horseName}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
