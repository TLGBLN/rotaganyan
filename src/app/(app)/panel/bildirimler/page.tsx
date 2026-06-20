import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Bell, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import MarkAllReadButton from "./MarkAllReadButton";

export default async function BildirimlerPage() {
  const session = await auth();
  if (!session?.user) return null;

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Bildirimler</h2>
        {hasUnread && <MarkAllReadButton userId={session.user.id} />}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Bell className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Henüz bildirim yok.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3",
                !n.read && "border-brand/30 bg-brand/5"
              )}
            >
              {n.read ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
              ) : (
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {format(new Date(n.createdAt), "d MMM yyyy, HH:mm", { locale: tr })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
