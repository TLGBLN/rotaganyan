import Link from "next/link";
import { Bell } from "lucide-react";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export default async function NotificationBell() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const unread = await db.notification.count({
    where: { userId: session.user.id, read: false },
  });

  return (
    <Link
      href="/panel/bildirimler"
      className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      title="Bildirimler"
    >
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
